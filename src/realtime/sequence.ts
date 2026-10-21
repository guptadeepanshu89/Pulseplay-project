export interface SequencedEvent {
  type: string;
  entityId: number;
  seq?: number;
  instanceId?: string;
}

export interface SequenceState {
  last: number | null;
  instanceId: string | null;
}

export type SequenceAction = 'apply' | 'ignore' | 'resync';

const CONTROL_TYPES = new Set(['socket.reconnected', 'socket.connected', 'poll', 'app.foreground', 'snapshot.required']);

export function reduceSequence(state: SequenceState, event: SequencedEvent): { state: SequenceState; action: SequenceAction } {
  if (CONTROL_TYPES.has(event.type) || event.seq == null) {
    const instanceId = event.instanceId ?? state.instanceId;
    return { state: { ...state, instanceId }, action: 'apply' };
  }
  // A new API process resets seq. Snapshots restore current state; missed events are not replayed.
  if (event.instanceId && state.instanceId && event.instanceId !== state.instanceId) {
    return { state: { last: event.seq, instanceId: event.instanceId }, action: 'resync' };
  }
  if (state.last != null && event.seq <= state.last) return { state, action: 'ignore' };
  const missed = state.last != null && event.seq > state.last + 1;
  return {
    state: { last: event.seq, instanceId: event.instanceId ?? state.instanceId },
    action: missed ? 'resync' : 'apply',
  };
}
