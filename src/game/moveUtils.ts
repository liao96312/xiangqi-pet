import { getLegalMoves, type GameState, type Move, type Pos } from './xiangqi';

export function sameSquare(a: Pos, b: Pos) {
  return a.row === b.row && a.col === b.col;
}

export function sameMove(a: Move, b: Move) {
  return sameSquare(a.from, b.from) && sameSquare(a.to, b.to);
}

export function findMatchingLegalMove(state: GameState, move: Move) {
  return getLegalMoves(state.board, state.turn).find((legal) => sameMove(legal, move));
}
