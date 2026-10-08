import { Router } from 'express';

import { actorOf, AuthedRequest } from '../../core/actor';
import { idParam } from '../../core/ids';
import { authenticate } from '../../core/middleware/authenticate';
import { requireRole } from '../../core/middleware/requireRole';
import { parseWith, validateBody } from '../../core/middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import { serialize } from '../../lib/serialize';
import { createUserSchemaFor, listUsersQueryFor, noBodySchema, updateUserSchema } from './schemas';
import { createUser, deleteUser, getUser, listUsers, resetUserPassword, setUserActive, updateUser } from './service';

const router = Router();
// Scoped: a SuperAdmin manages any client's users, a Client Admin only their own
// (every service function above enforces that — this only gates the role itself).
router.use(authenticate(['admin']), requireRole('SUPER_ADMIN', 'CLIENT_ADMIN'));

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const actor = actorOf(req);
    res.json(serialize(await listUsers(actor, parseWith(listUsersQueryFor(actor), req.query))));
  }),
);

router.post(
  '/',
  validateBody((req) => createUserSchemaFor(actorOf(req as AuthedRequest))),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json(serialize(await createUser(actorOf(req), req.body)));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await getUser(actorOf(req), idParam(req.params.id))));
  }),
);

router.patch(
  '/:id',
  validateBody(updateUserSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await updateUser(actorOf(req), idParam(req.params.id), req.body)));
  }),
);

router.post(
  '/:id/block',
  validateBody(noBodySchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await setUserActive(actorOf(req), idParam(req.params.id), false)));
  }),
);

router.post(
  '/:id/unblock',
  validateBody(noBodySchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await setUserActive(actorOf(req), idParam(req.params.id), true)));
  }),
);

router.post(
  '/:id/reset-password',
  validateBody(noBodySchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await resetUserPassword(actorOf(req), idParam(req.params.id))));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    await deleteUser(actorOf(req), idParam(req.params.id));
    res.status(204).end();
  }),
);

export default router;
