import { Actor } from '../../core/actor';
import { assertCan } from '../../core/policies/assert';
import { clientScope, clientWhere } from '../../core/tenant';
import { prisma } from '../../db';
import { LOOKUP_IDS } from '../../lib/lookupCache';
import { ROLE_IDS } from '../../lib/roleCache';

// Counts only — no PII, so this is the one admin endpoint that needs no list
// pagination. `clientId` narrows for a SuperAdmin; a Client Admin always sees
// their own client's numbers.
export async function getDashboard(actor: Actor, clientId?: number) {
  assertCan('bets.viewAny', actor);
  const scope = clientScope(actor, clientId);
  const where = clientWhere(scope);

  const [activeUsers, pendingRequests, openBets, openStake, clients] = await Promise.all([
    prisma.user.count({ where: { ...where, roleId: ROLE_IDS.CLIENT_USER, isDeleted: 0, isActive: 1 } }),
    prisma.walletRequest.count({ where: { ...where, statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.PENDING } }),
    prisma.bet.count({ where: { ...where, statusId: LOOKUP_IDS.BET_STATUS.OPEN } }),
    prisma.bet.aggregate({ where: { ...where, statusId: LOOKUP_IDS.BET_STATUS.OPEN }, _sum: { stake: true } }),
    scope === undefined ? prisma.client.count({ where: { isDeleted: 0, isActive: 1 } }) : Promise.resolve(undefined),
  ]);

  return {
    activeUsers,
    pendingRequests,
    openBets,
    openStake: openStake._sum.stake ?? 0,
    ...(clients !== undefined && { activeClients: clients }),
  };
}
