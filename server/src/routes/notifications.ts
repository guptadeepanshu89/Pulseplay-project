import { Router } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../db';
import { actorOf, AuthedRequest } from '../core/actor';
import { authenticate } from '../core/middleware/authenticate';
import { requireRole } from '../core/middleware/requireRole';
import { serialize } from '../lib/serialize';
import { parseId } from '../lib/parseId';
import { asyncHandler } from '../lib/asyncHandler';
import { fetchNotifications } from '../lib/notificationDto';

const router = Router();
router.use(authenticate(['mobile']), requireRole('CLIENT_USER'));

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const notifications = await fetchNotifications(prisma, Prisma.sql`WHERE n."userId" = ${actorOf(req).userId}`);
    res.json(serialize(notifications));
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === undefined) {
      res.status(400).json({ error: 'Invalid notification id' });
      return;
    }
    const result = await prisma.notification.updateMany({
      where: { id, userId: actorOf(req).userId },
      data: { read: true },
    });
    if (result.count === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.status(204).end();
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.notification.updateMany({
      where: { userId: actorOf(req).userId, read: false },
      data: { read: true },
    });
    res.status(204).end();
  }),
);

export default router;
