export function applyDemoSnapshot<T extends { version: number; updatedAt: string }>(current: T | null, incoming: T | null): T | null {
  if (!incoming) return current;
  if (!current) return incoming;
  if (incoming.version < current.version) return current;
  if (incoming.version === current.version && incoming.updatedAt === current.updatedAt) return current;
  return incoming;
}

export function connectionLabel(state: 'connected' | 'connecting' | 'reconnecting' | 'disconnected'): 'Live' | 'Connecting' | 'Reconnecting' | 'Offline' {
  if (state === 'connected') return 'Live';
  if (state === 'connecting') return 'Connecting';
  if (state === 'reconnecting') return 'Reconnecting';
  return 'Offline';
}

export function demoScreenView(input: { loading: boolean; error: string | null; hasSnapshot: boolean }): {
  showLoading: boolean;
  showError: boolean;
  showEmpty: boolean;
  showSnapshot: boolean;
} {
  const showLoading = input.loading && !input.hasSnapshot;
  return {
    showLoading,
    showError: Boolean(input.error) && !showLoading,
    showEmpty: !showLoading && !input.error && !input.hasSnapshot,
    showSnapshot: input.hasSnapshot && !showLoading,
  };
}
