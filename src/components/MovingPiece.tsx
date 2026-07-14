import { useEffect, useState } from 'react';
import type { Piece } from './PieceLabel';
import { PieceSVG } from './PieceSVG';

export function MovingPiece({
  piece,
  from,
  to,
  reverse
}: {
  piece: Piece;
  from: { left: string; top: string };
  to: { left: string; top: string };
  reverse?: boolean;
}) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSettled(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <span className={reverse ? 'moving-cell reverse' : 'moving-cell'} style={settled ? to : from} aria-hidden="true">
      <PieceSVG piece={piece} />
    </span>
  );
}
