import type { GameState } from './xiangqi';

export type MoveActor = 'player' | 'ai';

export interface UndoEntry {
  previous: GameState;
  actor: MoveActor;
}

export interface UndoResult {
  state: GameState;
  stack: UndoEntry[];
}

/** Free play always rewinds exactly the most recent move. */
export function undoManual(stack: UndoEntry[]): UndoResult | null {
  const last = stack.at(-1);
  if (!last) return null;
  return {
    state: last.previous,
    stack: stack.slice(0, -1)
  };
}

/**
 * Training mode rewinds one complete player/AI round. If the AI has not
 * replied yet, only the player's latest move exists and that move is undone.
 */
export function undoAutoAi(stack: UndoEntry[]): UndoResult | null {
  const last = stack.at(-1);
  if (!last) return null;

  const previous = stack.at(-2);
  const undoSteps = last.actor === 'ai' && previous?.actor === 'player' ? 2 : 1;
  return {
    state: stack.at(-undoSteps)!.previous,
    stack: stack.slice(0, -undoSteps)
  };
}
