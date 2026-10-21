export interface SequencedEvent {
  type: string;
  entityId: number;
  seq?: number;
}

export interface SequenceState {
  last: number | null;
}

export type SequenceAction = 'apply' | 'ignore' | 'resync';

const CONTROL_TYPES = new Set(['socket.reconnected', 'poll', 'app.foreground', 'snapshot.required']);

export function reduceSequence(state: SequenceState, event: SequencedEvent): { state: SequenceState; action: SequenceAction } {
  if (CONTROL_TYPES.has(event.type) || event.seq == null) return { state, action: 'apply' };
  if (state.last != null && event.seq <= state.last) return { state, action: 'ignore' };
  const missed = state.last != null && event.seq > state.last + 1;
  return { state: { last: event.seq }, action: missed ? 'resync' : 'apply' };
}
