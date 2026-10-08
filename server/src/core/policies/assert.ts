import { AppError } from '../errors';
import { Action, can, PolicyActor, PolicyTarget } from './index';

// Service-side wrapper: a denied policy is a 403. (Objects outside the actor's
// tenant never get this far — they are a 404 from the scoped lookup — so a
// 403 here means "you can see it, you may not do that to it".)
export function assertCan(action: Action, actor: PolicyActor, target: PolicyTarget = {}): void {
  if (!can(action, actor, target)) throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that');
}
