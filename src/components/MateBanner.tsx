import { getCheckmateTactic, type Move } from '../game/xiangqi';
import { moveNotation } from '../game/notation';
import type { UseXiangqiGameReturn } from '../game/useXiangqiGame';

export function MateBanner({
  tactic,
  board
}: {
  tactic: NonNullable<ReturnType<typeof getCheckmateTactic>>;
  board: UseXiangqiGameReturn['state']['board'];
}) {
  return (
    <section className="mate-banner" aria-live="polite">
      <span>绝杀</span>
      <strong>{tactic.name}</strong>
      <em>{moveNotation(board, tactic.move)} · {tactic.description}</em>
    </section>
  );
}
