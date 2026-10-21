export interface DemoSnapshot {
  demo: true;
  synthetic: true;
  settlesBets: false;
  id: 'demo-market';
  title: 'Demo market';
  status: 'OPEN';
  version: number;
  price: number;
  updatedAt: string;
}

const byUser = new Map<number, DemoSnapshot>();

export function demoSnapshot(userId: number): DemoSnapshot {
  const existing = byUser.get(userId);
  if (existing) return existing;
  const created: DemoSnapshot = {
    demo: true,
    synthetic: true,
    settlesBets: false,
    id: 'demo-market',
    title: 'Demo market',
    status: 'OPEN',
    version: 1,
    price: 1.5,
    updatedAt: new Date().toISOString(),
  };
  byUser.set(userId, created);
  return created;
}

export function tickDemo(userId: number): DemoSnapshot {
  const current = demoSnapshot(userId);
  const next: DemoSnapshot = {
    ...current,
    version: current.version + 1,
    price: Number((current.price + 0.01).toFixed(2)),
    updatedAt: new Date().toISOString(),
  };
  byUser.set(userId, next);
  return next;
}

export function resetDemo(): void {
  byUser.clear();
}
