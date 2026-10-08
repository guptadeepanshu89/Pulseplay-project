import { Router } from 'express';

import { actorOf, AuthedRequest } from '../../core/actor';
import { idParam } from '../../core/ids';
import { authenticate } from '../../core/middleware/authenticate';
import { requireRole } from '../../core/middleware/requireRole';
import { parseWith, validateBody } from '../../core/middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import { serialize } from '../../lib/serialize';
import { noBodySchema } from '../users/schemas';
import { createClientSchema, listClientsQuery, updateClientSchema } from './schemas';
import { createClient, deleteClient, getClient, listClients, setClientActive, updateClient } from './service';

const router = Router();
// Client management (create/edit/(de)activate/delete a tenant) is SuperAdmin-only.
router.use(authenticate(['admin']), requireRole('SUPER_ADMIN'));

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await listClients(actorOf(req), parseWith(listClientsQuery, req.query))));
  }),
);

router.post(
  '/',
  validateBody(createClientSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.status(201).json(serialize(await createClient(actorOf(req), req.body)));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await getClient(actorOf(req), idParam(req.params.id))));
  }),
);

router.patch(
  '/:id',
  validateBody(updateClientSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await updateClient(actorOf(req), idParam(req.params.id), req.body)));
  }),
);

router.post(
  '/:id/deactivate',
  validateBody(noBodySchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await setClientActive(actorOf(req), idParam(req.params.id), false)));
  }),
);

router.post(
  '/:id/reactivate',
  validateBody(noBodySchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await setClientActive(actorOf(req), idParam(req.params.id), true)));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    await deleteClient(actorOf(req), idParam(req.params.id));
    res.status(204).end();
  }),
);

export default router;
