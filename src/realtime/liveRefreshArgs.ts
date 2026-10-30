/** Shared option shape for `useLiveRefresh` (kept free of react-native imports for unit tests). */
export interface LiveRefreshOptions {
  marketIds?: number[];
  onOdds?: (event: { type: string; entityId: number; data?: Record<string, unknown> }) => void;
  onEvent?: (event: { type: string; entityId: number; data?: Record<string, unknown> }) => void | boolean;
  /** Only these live types trigger HTTP refresh (default: control resync types). */
  refreshTypes?: readonly string[];
  /** When set, refetch on focus if data is older than this many ms (0 = every focus). */
  staleMs?: number;
  debounceMs?: number;
}

/** Normalize positional (legacy) and options-object `useLiveRefresh` call shapes. */
export function normalizeLiveRefreshArgs(
  optionsOrMarketIds: LiveRefreshOptions | number[] = {},
  onOdds?: LiveRefreshOptions['onOdds'],
  onEvent?: LiveRefreshOptions['onEvent'],
): LiveRefreshOptions {
  if (Array.isArray(optionsOrMarketIds)) {
    return { marketIds: optionsOrMarketIds, onOdds, onEvent };
  }
  return optionsOrMarketIds ?? {};
}
