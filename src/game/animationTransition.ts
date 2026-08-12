import type { Move } from './xiangqi';

export type HistoryAnimationTransition =
  | { kind: 'forward'; move: Move }
  | { kind: 'undo'; move: Move }
  | { kind: 'reset' }
  | { kind: 'none' };

/** Classifies a history change without retaining visual state from an older position. */
export function classifyHistoryAnimation(previous: Move[], current: Move[]): HistoryAnimationTransition {
  if (current.length > previous.length) {
    const move = current.at(-1);
    return move ? { kind: 'forward', move } : { kind: 'none' };
  }

  if (current.length < previous.length) {
    const removed = previous.length - current.length;
    const move = previous.at(-1);
    return removed <= 2 && move ? { kind: 'undo', move } : { kind: 'reset' };
  }

  return { kind: 'none' };
}
