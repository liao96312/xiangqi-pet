import { pieceLabelView } from './PieceLabel';
import type { Board, PieceType, Side } from '../game/xiangqi';

const startingCount: Record<PieceType, number> = {
  king: 1,
  advisor: 2,
  elephant: 2,
  horse: 2,
  rook: 2,
  cannon: 2,
  pawn: 5
};

const capturedOrder: PieceType[] = ['rook', 'cannon', 'horse', 'elephant', 'advisor', 'pawn', 'king'];

export function PlayerStrip({
  side,
  board,
  turn,
  autoAi,
  playerSide
}: {
  side: Side;
  board: Board;
  turn: Side;
  autoAi: boolean;
  playerSide: Side;
}) {
  const captured = capturedBy(side, board);
  const role = autoAi ? (side === playerSide ? '你' : 'AI 陪练') : '自由对弈';
  const active = turn === side;

  return (
    <section className={`player-strip ${side} ${active ? 'active' : ''}`} aria-label={`${side === 'red' ? '红方' : '黑方'}信息`}>
      <span className="player-seal" aria-hidden="true">
        {side === 'red' ? '帅' : '将'}
      </span>
      <div className="player-copy">
        <span>{role}</span>
        <strong>{side === 'red' ? '红方' : '黑方'}</strong>
      </div>
      <div className="captured-pieces" aria-label={captured.length ? `已吃 ${captured.length} 子` : '尚未吃子'}>
        {captured.length ? (
          captured.map((piece, index) => (
            <span className={piece.side} key={`${piece.type}-${index}`}>
              {pieceLabelView(piece)}
            </span>
          ))
        ) : (
          <small>尚未吃子</small>
        )}
      </div>
      <span className="turn-mark">{active ? '行棋' : '候场'}</span>
    </section>
  );
}

function capturedBy(side: Side, board: Board) {
  const capturedSide: Side = side === 'red' ? 'black' : 'red';
  const remaining: Record<PieceType, number> = {
    king: 0,
    advisor: 0,
    elephant: 0,
    horse: 0,
    rook: 0,
    cannon: 0,
    pawn: 0
  };

  for (const row of board) {
    for (const piece of row) {
      if (piece?.side === capturedSide) remaining[piece.type] += 1;
    }
  }

  return capturedOrder.flatMap((type) =>
    Array.from({ length: Math.max(0, startingCount[type] - remaining[type]) }, () => ({ side: capturedSide, type }))
  );
}
