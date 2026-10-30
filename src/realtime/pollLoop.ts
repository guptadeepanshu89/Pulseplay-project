export const LIVE_POLL_MS = 8000;

export function shouldPoll(input: { socketConnected: boolean; screenActive: boolean; appActive: boolean }): boolean {
  return input.screenActive && input.appActive && !input.socketConnected;
}

export interface PollClock {
  setInterval: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearInterval: (timer: ReturnType<typeof setInterval>) => void;
}

const defaultClock: PollClock = {
  setInterval: (handler, ms) => setInterval(handler, ms),
  clearInterval: (timer) => clearInterval(timer),
};

export interface LivePollOptions {
  onUpdate: (event: { type: string; entityId: number }) => void;
  connected: () => boolean;
  appActive?: boolean;
  clock?: PollClock;
}

// One subscription owns at most one interval. Disconnect starts it, reconnect
// or background or unsubscribe clears it, and a second sync never stacks another.
export function createLivePoll(options: LivePollOptions) {
  const clock = options.clock ?? defaultClock;
  let poll: ReturnType<typeof setInterval> | undefined;
  let appActive = options.appActive ?? true;
  let screenActive = true;
  let stopped = false;

  const sync = () => {
    const polling = screenActive && appActive && !stopped && !options.connected();
    if (polling) {
      if (!poll) poll = clock.setInterval(() => options.onUpdate({ type: 'poll', entityId: 0 }), LIVE_POLL_MS);
      return;
    }
    if (poll) {
      clock.clearInterval(poll);
      poll = undefined;
    }
  };

  return {
    sync,
    setAppActive(active: boolean) {
      const wasActive = appActive;
      appActive = active;
      if (active && !wasActive && !stopped) options.onUpdate({ type: 'app.foreground', entityId: 0 });
      sync();
    },
    stop() {
      stopped = true;
      screenActive = false;
      if (poll) clock.clearInterval(poll);
      poll = undefined;
    },
    isPolling() {
      return poll != null;
    },
  };
}
