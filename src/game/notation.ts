import type { Board, Move, Piece } from './xiangqi';

const redFiles = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
const blackFiles = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function moveNotation(board: Board, move: Move) {
  const piece = board[move.from.row][move.from.col];
  if (!piece) return fallbackNotation(move);

  const sameFilePieces = board
    .map((row, rowIndex) => ({ piece: row[move.from.col], row: rowIndex }))
    .filter((item) => item.piece?.side === piece.side && item.piece.type === piece.type);
  const prefix =
    sameFilePieces.length > 1 ? `${frontBackPrefix(piece, move.from.row, sameFilePieces.map((item) => item.row))}${commonPieceLabel(piece)}` : commonPieceLabel(piece);
  const file = fileName(piece, move.from.col);
  const action = actionName(piece, move);
  const target = targetName(piece, move);
  return `${prefix}${sameFilePieces.length > 1 ? '' : file}${action}${target}`;
}

function frontBackPrefix(piece: Piece, row: number, rows: number[]) {
  const sorted = [...rows].sort((a, b) => (piece.side === 'red' ? a - b : b - a));
  return row === sorted[0] ? '前' : '后';
}

function fileName(piece: Piece, col: number) {
  return piece.side === 'red' ? redFiles[col] : blackFiles[col];
}

function actionName(piece: Piece, move: Move) {
  if (piece.type === 'horse' || piece.type === 'elephant' || piece.type === 'advisor') {
    const forward = piece.side === 'red' ? move.to.row < move.from.row : move.to.row > move.from.row;
    return forward ? '进' : '退';
  }
  if (move.from.col === move.to.col) {
    const forward = piece.side === 'red' ? move.to.row < move.from.row : move.to.row > move.from.row;
    return forward ? '进' : '退';
  }
  return '平';
}

function targetName(piece: Piece, move: Move) {
  if (move.from.col !== move.to.col) return fileName(piece, move.to.col);
  const steps = Math.abs(move.to.row - move.from.row);
  if (piece.type === 'horse' || piece.type === 'elephant' || piece.type === 'advisor') return fileName(piece, move.to.col);
  return piece.side === 'red' ? chineseNums[steps] : String(steps);
}

function commonPieceLabel(piece: Piece) {
  const labels: Record<Piece['side'], Record<Piece['type'], string>> = {
    red: {
      king: '帅',
      advisor: '仕',
      elephant: '相',
      horse: '马',
      rook: '车',
      cannon: '炮',
      pawn: '兵'
    },
    black: {
      king: '将',
      advisor: '士',
      elephant: '象',
      horse: '马',
      rook: '车',
      cannon: '炮',
      pawn: '卒'
    }
  };
  return labels[piece.side][piece.type];
}

function fallbackNotation(move: Move) {
  return `${move.from.col + 1},${move.from.row + 1} → ${move.to.col + 1},${move.to.row + 1}`;
}
