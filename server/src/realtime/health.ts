import { prisma } from '../db';
import { processSnapshot, providerSnapshot, workerSnapshot, type WorkerBeat } from './runtime';

export interface ReadinessBody {
  ok: boolean;
  role: 'ready';
  database: { ok: boolean; latencyMs: number | null };
  socket: { attached: boolean; connections: number; adapter: 'memory' };
  workers: Record<string, WorkerBeat & { stale: boolean; running: boolean }>;
  providers: ReturnType<typeof providerSnapshot>;
  process: ReturnType<typeof processSnapshot>;
}

export async function buildReadiness(input: {
  attached: boolean;
  connections: number;
  now?: Date;
  probe?: () => Promise<unknown>;
}): Promise<{ status: number; body: ReadinessBody }> {
  const started = Date.now();
  let databaseOk = false;
  try {
    await (input.probe ?? (() => prisma.$queryRaw`SELECT 1`))();
    databaseOk = true;
  } catch (error) {
    console.warn('[health] database probe failed:', error instanceof Error ? error.name : 'error');
  }
  const workers = workerSnapshot(input.now);
  const body: ReadinessBody = {
    ok: databaseOk,
    role: 'ready',
    database: { ok: databaseOk, latencyMs: databaseOk ? Date.now() - started : null },
    socket: { attached: input.attached, connections: input.connections, adapter: 'memory' },
    workers,
    providers: providerSnapshot(input.now),
    process: processSnapshot(),
  };
  return { status: databaseOk ? 200 : 503, body };
}
