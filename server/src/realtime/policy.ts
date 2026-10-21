export const LIVE_POLL_MS = 8000;

// Mirrors the mobile fallback in src/realtime/live.ts.
export function shouldPoll(input: { socketConnected: boolean; screenActive: boolean; appActive: boolean }): boolean {
  return input.screenActive && input.appActive && !input.socketConnected;
}
