import { Actor, clientIdOf } from './actor';

// The one place that decides which client a scoped admin query is restricted to.
//
//   SUPER_ADMIN   whatever they asked for (`?clientId=`); undefined = every client
//   CLIENT_ADMIN  always their own client — a requested value is never honoured
//                 (the query schemas reject `clientId` for them outright)
//
// Every list and every `:id` lookup applies this in the SAME query as the rest of
// its filter (`where: { id, ...scope }`), never as a check after loading the
// row: an object outside the tenant is then indistinguishable from one that
// does not exist.
export function clientScope(actor: Actor, requested?: number): number | undefined {
  if (actor.role === 'SUPER_ADMIN') return requested;
  return clientIdOf(actor);
}

// `where: { ...clientWhere(scope) }` — an empty filter for "every client".
export const clientWhere = (scope: number | undefined) => (scope === undefined ? {} : { clientId: scope });
