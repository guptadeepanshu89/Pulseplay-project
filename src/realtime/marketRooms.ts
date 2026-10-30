/** Diff market room membership for subscribe/unsubscribe emits. */
export function marketRoomDiff(previous: readonly number[], next: readonly number[]): {
  subscribe: number[];
  unsubscribe: number[];
} {
  const prev = new Set(previous);
  const upcoming = new Set(next);
  const subscribe: number[] = [];
  const unsubscribe: number[] = [];
  for (const id of prev) {
    if (!upcoming.has(id)) unsubscribe.push(id);
  }
  for (const id of upcoming) {
    if (!prev.has(id)) subscribe.push(id);
  }
  return { subscribe, unsubscribe };
}
