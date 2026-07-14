import { isPieceHanging, isPieceProtected, posKey, type Move, type Pos } from '../game/xiangqi';
import type { UseXiangqiGameReturn } from '../game/useXiangqiGame';
import { BoardLines } from './BoardLines';
import { CaptureBurst } from './CaptureBurst';
import { MovingPiece } from './MovingPiece';
import { PieceSVG } from './PieceSVG';

type MoveAnimation = {
  key: string;
  move: Move;
  reverse?: boolean;
};

export function Board({
  board,
  selected,
  legalTargetKeys,
  hint,
  checkmateMove,
  lastMove,
  moveAnimation,
  settleAnimation,
  captureBurst,
  flipped,
  onChoose
}: {
  board: UseXiangqiGameReturn['state']['board'];
  selected: Pos | null;
  legalTargetKeys: Set<string>;
  hint: UseXiangqiGameReturn['hint'];
  checkmateMove: Move | null;
  lastMove: UseXiangqiGameReturn['state']['history'][number] | null;
  moveAnimation: MoveAnimation | null;
  settleAnimation: { key: string; pos: Pos } | null;
  captureBurst: { key: string; pos: Pos } | null;
  flipped: boolean;
  onChoose: (pos: Pos) => void;
}) {
  const hintFrom = hint ? posKey(hint.from) : '';
  const hintTo = hint ? posKey(hint.to) : '';
  const mateFrom = checkmateMove ? posKey(checkmateMove.from) : '';
  const mateTo = checkmateMove ? posKey(checkmateMove.to) : '';
  const lastFrom = lastMove ? posKey(lastMove.from) : '';
  const lastTo = lastMove ? posKey(lastMove.to) : '';
  const lastWasCapture = !!lastMove?.capture;
  const selectedKey = selected ? posKey(selected) : '';
  const selectedUnprotected = selected && board[selected.row][selected.col] ? !isPieceProtected(board, selected) : false;
  const selectedHanging = selected ? isPieceHanging(board, selected) : false;
  const displayPos = (pos: Pos) => (flipped ? { row: 9 - pos.row, col: 8 - pos.col } : pos);
  const point = (pos: Pos) => {
    const display = displayPos(pos);
    return {
      left: `${5.5556 + display.col * 11.1111}%`,
      top: `${9 + display.row * 9}%`
    };
  };
  const movingPiece = moveAnimation
    ? moveAnimation.reverse
      ? board[moveAnimation.move.from.row][moveAnimation.move.from.col]
      : board[moveAnimation.move.to.row][moveAnimation.move.to.col]
    : null;
  const movingArrivalKey = moveAnimation ? posKey(moveAnimation.reverse ? moveAnimation.move.from : moveAnimation.move.to) : '';
  const settleKey = settleAnimation ? posKey(settleAnimation.pos) : '';

  return (
    <section className="board-wrap" aria-label="中国象棋棋盘">
      <div className="xiangqi-board">
        <BoardLines flipped={flipped} />
        {captureBurst ? <CaptureBurst key={captureBurst.key} point={point(captureBurst.pos)} /> : null}
        {movingPiece && moveAnimation ? (
          <MovingPiece
            key={moveAnimation.key}
            piece={movingPiece}
            from={point(moveAnimation.reverse ? moveAnimation.move.to : moveAnimation.move.from)}
            to={point(moveAnimation.reverse ? moveAnimation.move.from : moveAnimation.move.to)}
            reverse={moveAnimation.reverse}
          />
        ) : null}
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const pos = { row: rowIndex, col: colIndex };
            const key = posKey(pos);
            const classes = [
              'cell',
              selectedKey === key ? 'selected' : '',
              selectedKey === key && selectedUnprotected ? 'unprotected' : '',
              selectedKey === key && selectedHanging ? 'hanging' : '',
              legalTargetKeys.has(key) ? 'legal' : '',
              lastFrom === key ? 'last-from' : '',
              lastTo === key ? 'last-to' : '',
              lastTo === key && lastWasCapture ? 'capture-to' : '',
              movingArrivalKey === key ? 'move-arriving' : '',
              settleKey === key ? 'move-settled' : '',
              hintFrom === key ? 'hint-from' : '',
              hintTo === key ? 'hint-to' : '',
              mateFrom === key ? 'mate-from' : '',
              mateTo === key ? 'mate-to' : ''
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button className={classes} key={key} style={point(pos)} type="button" onClick={() => onChoose(pos)} aria-label={`位置 ${colIndex + 1},${rowIndex + 1}`}>
                {piece ? <PieceSVG piece={piece} /> : null}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
