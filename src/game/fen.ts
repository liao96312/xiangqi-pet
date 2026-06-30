import type { Board, Move, Piece, Pos } from './xiangqi';

const pieceToFen: Record<string, string> = {
  red_king: 'K',
  red_advisor: 'A',
  red_elephant: 'B',
  red_horse: 'N',
  red_rook: 'R',
  red_cannon: 'C',
  red_pawn: 'P',
  black_king: 'k',
  black_advisor: 'a',
  black_elephant: 'b',
  black_horse: 'n',
  black_rook: 'r',
  black_cannon: 'c',
  black_pawn: 'p'
};

export function boardToFen(board: Board, turn: 'red' | 'black') {
  const rows = board.map((row) => {
    let empty = 0;
    let text = '';
    for (const piece of row) {
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        text += String(empty);
        empty = 0;
      }
      text += pieceToFen[`${piece.side}_${piece.type}`];
    }
    return text + (empty > 0 ? String(empty) : '');
  });
  return `${rows.join('/')} ${turn === 'red' ? 'w' : 'b'} - - 0 1`;
}

export function moveToUci(move: Move) {
  return `${posToUci(move.from)}${posToUci(move.to)}`;
}

export function uciToMove(text: string, board: Board): Move | null {
  if (!/^[a-i][0-9][a-i][0-9]/.test(text)) return null;
  const from = uciToPos(text.slice(0, 2));
  const to = uciToPos(text.slice(2, 4));
  if (!from || !to) return null;
  return { from, to, capture: board[to.row][to.col] ?? undefined };
}

function posToUci(pos: Pos) {
  return `${String.fromCharCode(97 + pos.col)}${9 - pos.row}`;
}

function uciToPos(text: string): Pos | null {
  const col = text.charCodeAt(0) - 97;
  const row = 9 - Number(text[1]);
  if (col < 0 || col > 8 || row < 0 || row > 9 || Number.isNaN(row)) return null;
  return { row, col };
}

export function pieceFen(piece: Piece) {
  return pieceToFen[`${piece.side}_${piece.type}`];
}
