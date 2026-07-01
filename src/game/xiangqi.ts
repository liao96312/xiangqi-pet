export type Side = 'red' | 'black';
export type PieceType = 'king' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'pawn';

export interface Piece {
  side: Side;
  type: PieceType;
}

export interface Pos {
  row: number;
  col: number;
}

export interface Move {
  from: Pos;
  to: Pos;
  capture?: Piece;
  score?: number;
}

export type Board = Array<Array<Piece | null>>;

export interface GameState {
  board: Board;
  turn: Side;
  winner: Side | null;
  message: string;
  history: Move[];
}

export interface CheckmateTactic {
  move: Move;
  name: string;
  description: string;
}

const pieceValue: Record<PieceType, number> = {
  king: 10000,
  rook: 600,
  cannon: 350,
  horse: 300,
  pawn: 80,
  advisor: 120,
  elephant: 120
};

const redRiver = 5;
const blackRiver = 4;

export function createInitialState(): GameState {
  return {
    board: createInitialBoard(),
    turn: 'red',
    winner: null,
    message: '红方先行',
    history: []
  };
}

export function createInitialBoard(): Board {
  const board = emptyBoard();
  const put = (row: number, col: number, side: Side, type: PieceType) => {
    board[row][col] = { side, type };
  };

  const back: PieceType[] = ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook'];
  back.forEach((type, col) => {
    put(0, col, 'black', type);
    put(9, col, 'red', type);
  });
  [1, 7].forEach((col) => {
    put(2, col, 'black', 'cannon');
    put(7, col, 'red', 'cannon');
  });
  [0, 2, 4, 6, 8].forEach((col) => {
    put(3, col, 'black', 'pawn');
    put(6, col, 'red', 'pawn');
  });
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  const piece = next[move.from.row][move.from.col];
  next[move.from.row][move.from.col] = null;
  next[move.to.row][move.to.col] = piece;
  return next;
}

export function makeMove(state: GameState, move: Move): GameState {
  if (state.winner) return state;
  const legal = getLegalMoves(state.board, state.turn);
  const matched = legal.find((item) => samePos(item.from, move.from) && samePos(item.to, move.to));
  if (!matched) return { ...state, message: '这步不合法' };

  const nextBoard = applyMove(state.board, matched);
  const nextTurn = opposite(state.turn);
  const winner = findKing(nextBoard, nextTurn) ? null : state.turn;
  const isCheck = !winner && isInCheck(nextBoard, nextTurn);
  const nextMoves = winner ? [] : getLegalMoves(nextBoard, nextTurn);
  const noMoveLoss = !winner && nextMoves.length === 0;
  const finalWinner = winner ?? (noMoveLoss ? state.turn : null);

  return {
    board: nextBoard,
    turn: nextTurn,
    winner: finalWinner,
    message: finalWinner
      ? `${sideName(finalWinner)}胜利，${sideName(nextTurn)}${isCheck ? '被将死' : '无子可走'}`
      : isCheck
        ? `${sideName(nextTurn)}被将军`
        : `${sideName(nextTurn)}行棋`,
    history: [...state.history, matched]
  };
}

export function getLegalMoves(board: Board, side: Side): Move[] {
  const pseudo = getPseudoMoves(board, side);
  return pseudo.filter((move) => !isInCheck(applyMove(board, move), side));
}

export function getBestMove(board: Board, side: Side, depth = 2): Move | null {
  const moves = orderMoves(getLegalMoves(board, side));
  if (moves.length === 0) return null;

  let best: Move | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const move of moves) {
    const nextBoard = applyMove(board, move);
    const rival = opposite(side);
    if (!findKing(nextBoard, rival) || getLegalMoves(nextBoard, rival).length === 0) {
      return { ...move, score: 999999 };
    }
    const score = -search(nextBoard, rival, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
    if (score > bestScore) {
      bestScore = score;
      best = { ...move, score };
    }
  }
  return best;
}

export function isPieceProtected(board: Board, pos: Pos): boolean {
  const piece = board[pos.row][pos.col];
  if (!piece) return false;

  let protectedByOwnPiece = false;
  forEachPiece(board, (candidate, from) => {
    if (protectedByOwnPiece) return;
    if (candidate.side !== piece.side || samePos(from, pos)) return;
    protectedByOwnPiece = getPieceTargets(board, from, candidate).some((target) => samePos(target, pos));
  });
  return protectedByOwnPiece;
}

export function isPieceHanging(board: Board, pos: Pos): boolean {
  const piece = board[pos.row][pos.col];
  if (!piece || isPieceProtected(board, pos)) return false;
  return getLegalMoves(board, opposite(piece.side)).some((move) => samePos(move.to, pos));
}

export function getCheckmateMove(board: Board, side: Side): Move | null {
  for (const move of orderMoves(getLegalMoves(board, side))) {
    const nextBoard = applyMove(board, move);
    const rival = opposite(side);
    const rivalMoves = getLegalMoves(nextBoard, rival);
    if (!findKing(nextBoard, rival) || rivalMoves.length === 0) return move;
  }
  return null;
}

export function getCheckmateTactic(board: Board, side: Side): CheckmateTactic | null {
  const move = getCheckmateMove(board, side);
  if (!move) return null;
  const nextBoard = applyMove(board, move);
  const rival = opposite(side);
  const king = findKing(nextBoard, rival) ?? findKing(board, rival);
  const moved = nextBoard[move.to.row][move.to.col];
  if (moved?.type === 'king' && move.capture?.type === 'king') return { move, name: '对面笑', description: '将帅同线无阻，借规则成杀' };
  if (move.capture?.type === 'king' && hasRookHorseAttack(board, side, move.to)) return { move, name: '列马车', description: '车马配合成杀' };
  if (!king || !moved) return { move, name: '绝杀', description: '一步成杀' };

  const attackers = attackingPieces(nextBoard, side, king);
  const sameLineCannons = piecesOnKingLine(nextBoard, side, king, 'cannon');
  const rooks = attackers.filter((item) => item.piece.type === 'rook');
  const horses = attackers.filter((item) => item.piece.type === 'horse');
  const blockedByOwnAdvisor = palacePieces(nextBoard, rival).some((item) => item.piece.type === 'advisor');

  if (!isInCheck(nextBoard, rival)) return { move, name: '困毙', description: '对方无子可走' };
  if (sameLineCannons.length >= 2) return { move, name: '重炮', description: '双炮同线成杀' };
  if (moved.type === 'horse' && isCrouchingHorse(move.to, rival)) return { move, name: '卧槽马', description: '马入肋道，直接控将' };
  if (moved.type === 'horse' && isFishingHorse(move.to, rival)) return { move, name: '钓鱼马', description: '马挂角控制将门' };
  if (rooks.length >= 2 || (moved.type === 'rook' && countPieces(nextBoard, side, 'rook') >= 2)) return { move, name: '双车错', description: '双车交错压杀' };
  if (isSideTiger(nextBoard, side, rival, king, rooks)) return { move, name: '侧面虎', description: '车在侧面照将，马控将门成杀' };
  if (rooks.length > 0 && horses.length > 0) return { move, name: '列马车', description: '车马配合成杀' };
  if (moved.type === 'cannon' && countPieces(nextBoard, side, 'cannon') >= 2 && countPieces(nextBoard, side, 'rook') > 0) return { move, name: '夹车炮', description: '车炮夹击将门' };
  if (isSeaBottomMoon(nextBoard, side, rival, move)) return { move, name: '海底捞月', description: '车炮借帅力，炮沉底线成杀' };
  if (blockedByOwnAdvisor) return { move, name: '闷宫', description: '借对方士象堵宫成杀' };
  if (moved.type === 'rook' || moved.type === 'cannon') return { move, name: '铁门栓', description: '封住将门成杀' };
  return { move, name: '绝杀', description: '一步成杀' };
}

export function posKey(pos: Pos) {
  return `${pos.row}-${pos.col}`;
}

export function pieceLabel(piece: Piece): string {
  const labels: Record<Side, Record<PieceType, string>> = {
    red: {
      king: '帥',
      advisor: '仕',
      elephant: '相',
      horse: '傌',
      rook: '俥',
      cannon: '炮',
      pawn: '兵'
    },
    black: {
      king: '將',
      advisor: '士',
      elephant: '象',
      horse: '馬',
      rook: '車',
      cannon: '砲',
      pawn: '卒'
    }
  };
  return labels[piece.side][piece.type];
}

export function sideName(side: Side) {
  return side === 'red' ? '红方' : '黑方';
}

export function moveText(move: Move): string {
  return `${coordText(move.from)} → ${coordText(move.to)}`;
}

function coordText(pos: Pos) {
  return `${pos.col + 1},${pos.row + 1}`;
}

function search(board: Board, side: Side, depth: number, alpha: number, beta: number): number {
  if (!findKing(board, side)) return -100000;
  if (!findKing(board, opposite(side))) return 100000;
  if (depth <= 0) return evaluate(board, side);
  const moves = orderMoves(getLegalMoves(board, side));
  if (moves.length === 0) return isInCheck(board, side) ? -99999 - depth : 0;

  let best = Number.NEGATIVE_INFINITY;
  for (const move of moves) {
    const score = -search(applyMove(board, move), opposite(side), depth - 1, -beta, -alpha);
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

function evaluate(board: Board, side: Side): number {
  let score = 0;
  forEachPiece(board, (piece, pos) => {
    const advancement = piece.type === 'pawn' ? pawnAdvance(piece, pos) * 14 : 0;
    const center = 4 - Math.abs(pos.col - 4);
    const activity = activityBonus(piece, pos);
    const value = pieceValue[piece.type] + advancement + center + activity;
    score += piece.side === side ? value : -value;
  });
  if (isInCheck(board, opposite(side))) score += 80;
  if (isInCheck(board, side)) score -= 100;
  return score;
}

function pawnAdvance(piece: Piece, pos: Pos) {
  return piece.side === 'red' ? 6 - pos.row : pos.row - 3;
}

function activityBonus(piece: Piece, pos: Pos) {
  if (piece.type === 'rook' || piece.type === 'cannon') return 10 - Math.abs(pos.col - 4);
  if (piece.type === 'horse') return 8 - Math.abs(pos.col - 4) + (piece.side === 'red' ? 9 - pos.row : pos.row);
  if (piece.type === 'king') return 0;
  return 0;
}

function orderMoves(moves: Move[]) {
  return [...moves].sort((a, b) => (b.capture ? pieceValue[b.capture.type] : 0) - (a.capture ? pieceValue[a.capture.type] : 0));
}

function getPseudoMoves(board: Board, side: Side): Move[] {
  const moves: Move[] = [];
  forEachPiece(board, (piece, from) => {
    if (piece.side !== side) return;
    const targets = getPieceTargets(board, from, piece);
    for (const to of targets) {
      const target = board[to.row][to.col];
      if (!target || target.side !== side) {
        moves.push({ from, to, capture: target ?? undefined });
      }
    }
  });
  return moves;
}

function getPieceTargets(board: Board, from: Pos, piece: Piece): Pos[] {
  if (piece.type === 'rook') return lineMoves(board, from, false);
  if (piece.type === 'cannon') return lineMoves(board, from, true);
  if (piece.type === 'horse') return horseMoves(board, from);
  if (piece.type === 'elephant') return elephantMoves(board, from, piece.side);
  if (piece.type === 'advisor') return advisorMoves(from, piece.side);
  if (piece.type === 'king') return kingMoves(board, from, piece.side);
  return pawnMoves(from, piece.side);
}

function lineMoves(board: Board, from: Pos, cannon: boolean) {
  const result: Pos[] = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  for (const [dr, dc] of dirs) {
    let row = from.row + dr;
    let col = from.col + dc;
    let jumped = false;
    while (inside(row, col)) {
      const occupied = board[row][col];
      if (!cannon) {
        result.push({ row, col });
        if (occupied) break;
      } else if (!jumped) {
        if (occupied) {
          jumped = true;
        } else {
          result.push({ row, col });
        }
      } else if (occupied) {
        result.push({ row, col });
        break;
      }
      row += dr;
      col += dc;
    }
  }
  return result;
}

function horseMoves(board: Board, from: Pos) {
  const result: Pos[] = [];
  const specs = [
    [-2, -1, -1, 0],
    [-2, 1, -1, 0],
    [2, -1, 1, 0],
    [2, 1, 1, 0],
    [-1, -2, 0, -1],
    [1, -2, 0, -1],
    [-1, 2, 0, 1],
    [1, 2, 0, 1]
  ];
  for (const [dr, dc, br, bc] of specs) {
    const blockRow = from.row + br;
    const blockCol = from.col + bc;
    const row = from.row + dr;
    const col = from.col + dc;
    if (inside(row, col) && !board[blockRow][blockCol]) result.push({ row, col });
  }
  return result;
}

function elephantMoves(board: Board, from: Pos, side: Side) {
  const result: Pos[] = [];
  const dirs = [
    [2, 2],
    [2, -2],
    [-2, 2],
    [-2, -2]
  ];
  for (const [dr, dc] of dirs) {
    const row = from.row + dr;
    const col = from.col + dc;
    const eyeRow = from.row + dr / 2;
    const eyeCol = from.col + dc / 2;
    if (!inside(row, col) || board[eyeRow][eyeCol]) continue;
    if (side === 'red' && row < redRiver) continue;
    if (side === 'black' && row > blackRiver) continue;
    result.push({ row, col });
  }
  return result;
}

function advisorMoves(from: Pos, side: Side) {
  return [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ]
    .map(([dr, dc]) => ({ row: from.row + dr, col: from.col + dc }))
    .filter((pos) => inPalace(pos, side));
}

function kingMoves(board: Board, from: Pos, side: Side) {
  const result = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ]
    .map(([dr, dc]) => ({ row: from.row + dr, col: from.col + dc }))
    .filter((pos) => inPalace(pos, side));

  const other = findKing(board, opposite(side));
  if (other && other.col === from.col && clearBetween(board, from, other)) {
    result.push(other);
  }
  return result;
}

function pawnMoves(from: Pos, side: Side) {
  const result: Pos[] = [];
  const forward = side === 'red' ? -1 : 1;
  const front = { row: from.row + forward, col: from.col };
  if (inside(front.row, front.col)) result.push(front);

  const crossed = side === 'red' ? from.row <= blackRiver : from.row >= redRiver;
  if (crossed) {
    for (const dc of [-1, 1]) {
      const pos = { row: from.row, col: from.col + dc };
      if (inside(pos.row, pos.col)) result.push(pos);
    }
  }
  return result;
}

export function isInCheck(board: Board, side: Side): boolean {
  const king = findKing(board, side);
  if (!king) return true;
  return getPseudoMoves(board, opposite(side)).some((move) => samePos(move.to, king));
}

function findKing(board: Board, side: Side): Pos | null {
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const piece = board[row][col];
      if (piece?.side === side && piece.type === 'king') return { row, col };
    }
  }
  return null;
}

function clearBetween(board: Board, a: Pos, b: Pos): boolean {
  const start = Math.min(a.row, b.row) + 1;
  const end = Math.max(a.row, b.row);
  for (let row = start; row < end; row += 1) {
    if (board[row][a.col]) return false;
  }
  return true;
}

function inPalace(pos: Pos, side: Side) {
  const rowOk = side === 'red' ? pos.row >= 7 && pos.row <= 9 : pos.row >= 0 && pos.row <= 2;
  return rowOk && pos.col >= 3 && pos.col <= 5;
}

function attackingPieces(board: Board, side: Side, target: Pos) {
  const result: Array<{ piece: Piece; pos: Pos }> = [];
  forEachPiece(board, (piece, pos) => {
    if (piece.side === side && getPieceTargets(board, pos, piece).some((item) => samePos(item, target))) {
      result.push({ piece, pos });
    }
  });
  return result;
}

function palacePieces(board: Board, side: Side) {
  const result: Array<{ piece: Piece; pos: Pos }> = [];
  forEachPiece(board, (piece, pos) => {
    if (piece.side === side && inPalace(pos, side)) result.push({ piece, pos });
  });
  return result;
}

function countPieces(board: Board, side: Side, type: PieceType) {
  let count = 0;
  forEachPiece(board, (piece) => {
    if (piece.side === side && piece.type === type) count += 1;
  });
  return count;
}

function piecesAt(board: Board, side: Side, type: PieceType) {
  const result: Array<{ piece: Piece; pos: Pos }> = [];
  forEachPiece(board, (piece, pos) => {
    if (piece.side === side && piece.type === type) result.push({ piece, pos });
  });
  return result;
}

function piecesOnKingLine(board: Board, side: Side, king: Pos, type: PieceType) {
  const result: Array<{ piece: Piece; pos: Pos }> = [];
  forEachPiece(board, (piece, pos) => {
    if (piece.side === side && piece.type === type && (pos.row === king.row || pos.col === king.col)) result.push({ piece, pos });
  });
  return result;
}

function hasRookHorseAttack(board: Board, side: Side, target: Pos) {
  const attackers = attackingPieces(board, side, target);
  return attackers.some((item) => item.piece.type === 'rook') && attackers.some((item) => item.piece.type === 'horse');
}

function isCrouchingHorse(pos: Pos, rival: Side) {
  return rival === 'black' ? pos.row === 2 && (pos.col === 3 || pos.col === 5) : pos.row === 7 && (pos.col === 3 || pos.col === 5);
}

function isFishingHorse(pos: Pos, rival: Side) {
  return rival === 'black' ? pos.row === 2 && (pos.col === 2 || pos.col === 6) : pos.row === 7 && (pos.col === 2 || pos.col === 6);
}

function isSideTiger(board: Board, side: Side, rival: Side, king: Pos, checkingRooks: Array<{ piece: Piece; pos: Pos }>) {
  if (king.col === 4) return false;
  if (!checkingRooks.some((item) => item.pos.row === king.row)) return false;

  const forward = rival === 'black' ? 1 : -1;
  const guard = { row: king.row + forward, col: king.col };
  const outsideCol = king.col < 4 ? king.col - 1 : king.col + 1;
  const tiger = { row: king.row + forward * 3, col: outsideCol };

  return attackingPieces(board, side, guard).some((item) => item.piece.type === 'horse') || piecesAt(board, side, 'horse').some((item) => samePos(item.pos, tiger));
}

function isSeaBottomMoon(board: Board, side: Side, rival: Side, move: Move) {
  const moved = board[move.to.row][move.to.col];
  const ownKing = findKing(board, side);
  const enemyBackRank = rival === 'black' ? 0 : 9;
  return (
    moved?.type === 'cannon' &&
    move.to.row === enemyBackRank &&
    ownKing?.col === 4 &&
    countPieces(board, side, 'rook') > 0 &&
    countPieces(board, side, 'cannon') > 0 &&
    countPieces(board, rival, 'rook') > 0
  );
}

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null));
}

function inside(row: number, col: number) {
  return row >= 0 && row < 10 && col >= 0 && col < 9;
}

function samePos(a: Pos, b: Pos) {
  return a.row === b.row && a.col === b.col;
}

function opposite(side: Side): Side {
  return side === 'red' ? 'black' : 'red';
}

function forEachPiece(board: Board, callback: (piece: Piece, pos: Pos) => void) {
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const piece = board[row][col];
      if (piece) callback(piece, { row, col });
    }
  }
}
