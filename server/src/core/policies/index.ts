import { RoleCode } from '../../lib/roleCache';

// The permission matrix as pure functions: no DB, no Express — so every cell
// is unit-testable and the rules read like the plan's table (§5.4).
//
// A policy answers "may this ACTOR perform ACTION on this TARGET?". It does not
// do the tenant filtering of list queries (that's core/tenant) and it does not
// check state guards like "last admin" or "user has funds" (those are service
// rules). Unknown actions throw: authorization fails closed.

export interface PolicyActor {
  userId: number;
  role: RoleCode;
  clientId: number | null;
}

// What the actor is acting on. Which fields matter depends on the action.
export interface PolicyTarget {
  clientId?: number | null;
  userId?: number;
  role?: RoleCode;
}

export type Action =
  | 'client.manage' // create / edit / (de)activate / delete a Client
  | 'user.create' // target.role + target.clientId = the account being created
  | 'user.view'
  | 'user.update'
  | 'user.block'
  | 'user.resetPassword'
  | 'user.delete'
  | 'fundRequest.list'
  | 'fundRequest.resolve' // approve / reject; target.clientId = the request's client
  | 'fundRequest.create'
  | 'bets.viewAny' // admin-side lists of bets / transactions / dashboard
  | 'market.manage' // settle markets, manage events
  | 'bet.place'
  | 'wallet.use';

const isSuperAdmin = (actor: PolicyActor) => actor.role === 'SUPER_ADMIN';
const isClientAdmin = (actor: PolicyActor) => actor.role === 'CLIENT_ADMIN';
const isClientUser = (actor: PolicyActor) => actor.role === 'CLIENT_USER';
const sameClient = (actor: PolicyActor, target: PolicyTarget) =>
  actor.clientId !== null && target.clientId !== undefined && target.clientId !== null && actor.clientId === target.clientId;

type Rule = (actor: PolicyActor, target: PolicyTarget) => boolean;

// Managing a user (edit / block / reset / delete): SuperAdmin manages Client
// Admins and Client Users anywhere — never another SuperAdmin (those are
// bootstrapped out-of-band). A Client Admin manages only Client Users of his
// own client, never a fellow admin.
const manageUser: Rule = (actor, target) => {
  if (isSuperAdmin(actor)) return target.role === 'CLIENT_ADMIN' || target.role === 'CLIENT_USER';
  if (isClientAdmin(actor)) return target.role === 'CLIENT_USER' && sameClient(actor, target);
  return false;
};

const RULES: Record<Action, Rule> = {
  'client.manage': (actor) => isSuperAdmin(actor),

  // Creating: SuperAdmin makes Client Admins/Users (for a client that must be named);
  // a Client Admin makes only Client Users, only in his own client. Nobody
  // creates a SuperAdmin through the API.
  'user.create': (actor, target) => {
    const forAClient = target.clientId !== undefined && target.clientId !== null;
    if (isSuperAdmin(actor)) return forAClient && (target.role === 'CLIENT_ADMIN' || target.role === 'CLIENT_USER');
    if (isClientAdmin(actor)) return target.role === 'CLIENT_USER' && sameClient(actor, target);
    return false;
  },
  'user.view': (actor, target) => isSuperAdmin(actor) || (isClientAdmin(actor) && sameClient(actor, target)),
  'user.update': manageUser,
  'user.block': manageUser,
  'user.resetPassword': manageUser,
  'user.delete': manageUser,

  'fundRequest.list': (actor) => isSuperAdmin(actor) || isClientAdmin(actor),
  'fundRequest.resolve': (actor, target) => isSuperAdmin(actor) || (isClientAdmin(actor) && sameClient(actor, target)),
  'fundRequest.create': (actor) => isClientUser(actor),

  'bets.viewAny': (actor) => isSuperAdmin(actor) || isClientAdmin(actor),
  'market.manage': (actor) => isSuperAdmin(actor),
  'bet.place': (actor) => isClientUser(actor),
  'wallet.use': (actor) => isClientUser(actor),
};

export function can(action: Action, actor: PolicyActor, target: PolicyTarget = {}): boolean {
  const rule = RULES[action];
  if (!rule) throw new Error(`Unknown policy action "${action}"`);
  return rule(actor, target);
}

export const ACTIONS = Object.keys(RULES) as Action[];
