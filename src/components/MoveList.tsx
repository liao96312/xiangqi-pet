import { useMemo } from 'react';
import { applyMove, createInitialBoard } from '../game/xiangqi';
import { moveNotation } from '../game/notation';
import type { Move } from '../game/xiangqi';

export function MoveList({ history }: { history: Move[] }) {
  const items = useMemo(() => {
    let board = createInitialBoard();
    return history.map((move, index) => {
      const label = moveNotation(board, move);
      board = applyMove(board, move);
      return {
        index,
        label,
        round: Math.floor(index / 2) + 1,
        side: index % 2 === 0 ? '红' : '黑'
      };
    });
  }, [history]);

  if (items.length === 0) {
    return <section className="move-list empty">尚未走子</section>;
  }

  return (
    <section className="move-list" aria-label="走法列表">
      {items.map((item) => (
        <span className="move-list-item" key={item.index}>
          {item.round}.{item.side} {item.label}
        </span>
      ))}
    </section>
  );
}
