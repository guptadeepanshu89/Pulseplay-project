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
import cricketRoutes from './modules/cricket/routes';
import demoRoutes from './modules/demo/routes';
import { buildReadiness } from './realtime/health';
import { realtimeAttached, realtimeConnections } from './realtime/hub';
import { httpMetrics, noteHttp } from './realtime/runtime';

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
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      const elapsedMs = Date.now() - started;
      noteHttp(res.statusCode, elapsedMs);
      if (res.statusCode >= 500 || elapsedMs >= 1000) {
        console.info(JSON.stringify({ scope: 'http', method: req.method, path: req.path, status: res.statusCode, ms: elapsedMs }));
      }
    });
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true, role: 'live' }));
  app.get('/health/live', (_req, res) => res.json({ ok: true, role: 'live' }));
  app.get('/health/ready', async (_req, res) => {
    const result = await buildReadiness({ attached: realtimeAttached(), connections: realtimeConnections() });
    res.status(result.status).json(result.body);
  });
  app.get('/metrics', (_req, res) => {
    const http = httpMetrics();
    res.type('text/plain').send(
      [
        '# PulsePlay process metrics. No secrets.',
        `pulseplay_http_requests ${http.requests}`,
        `pulseplay_http_errors ${http.errors}`,
        `pulseplay_http_average_ms ${http.averageMs}`,
        `pulseplay_socket_connections ${realtimeConnections()}`,
        `pulseplay_process_rss_bytes ${process.memoryUsage().rss}`,
      ].join('\n'),
    );
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/events', eventsRoutes);
  app.use('/api/v1/markets', marketsRoutes);
  app.use('/api/v1/crypto', cryptoRoutes);
  app.use('/api/v1/wallet', walletRoutes);
  app.use('/api/v1/bets', betsRoutes);
  app.use('/api/v1/notifications', notificationsRoutes);
  app.use('/api/v1/cricket', cricketRoutes);
  app.use('/api/v1/demo', demoRoutes);
  app.use('/api/v1/admin/clients', adminClientsRoutes);
  app.use('/api/v1/admin/users', adminUsersRoutes);
  app.use('/api/v1/admin/wallet-requests', adminFundRequestsRoutes);
  app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
  app.use('/api/v1/admin/bets', adminBetsRoutes);
  app.use('/api/v1/admin/markets', adminMarketsRoutes);

  app.use(errorHandler);

  return app;
}
