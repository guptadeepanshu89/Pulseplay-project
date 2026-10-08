import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';

import { errorHandler } from './core/errors';
import authRoutes from './modules/auth/routes';
import eventsRoutes from './routes/events';
import marketsRoutes from './routes/markets';
import cryptoRoutes from './routes/crypto';
import walletRoutes from './routes/wallet';
import betsRoutes from './routes/bets';
import notificationsRoutes from './routes/notifications';
import adminClientsRoutes from './modules/clients/routes';
import adminUsersRoutes from './modules/users/routes';
import adminFundRequestsRoutes from './modules/fundRequests/routes';
import adminDashboardRoutes from './modules/dashboard/routes';
import adminBetsRoutes from './modules/bets/routes';
import adminMarketsRoutes from './modules/markets/routes';

// The Express app on its own — no listen(), no background workers — so tests
// can drive it in-process (supertest) and index.ts can boot it for real.
export function createApp() {
  const app = express();
  // `credentials: true` is required so the browser sends/accepts the httpOnly auth
  // cookie cross-origin; that in turn requires reflecting the real Origin instead
  // of `*` (the CORS spec disallows the wildcard on credentialed requests).
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/events', eventsRoutes);
  app.use('/api/v1/markets', marketsRoutes);
  app.use('/api/v1/crypto', cryptoRoutes);
  app.use('/api/v1/wallet', walletRoutes);
  app.use('/api/v1/bets', betsRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/admin/clients', adminClientsRoutes);
  app.use('/api/v1/admin/users', adminUsersRoutes);
  app.use('/api/v1/admin/wallet-requests', adminFundRequestsRoutes);
  app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
  app.use('/api/v1/admin/bets', adminBetsRoutes);
  app.use('/api/v1/admin/markets', adminMarketsRoutes);

  app.use(errorHandler);

  return app;
}
