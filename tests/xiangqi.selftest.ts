import { strict as assert } from 'node:assert';
import { createInitialState, getCheckmateTactic, getLegalMoves, makeMove, type Board, type Move, type Piece } from '../src/game/xiangqi';

function emptyBoard(): Board {
  return Array.from({ length: 10 }, () => Array.from<Piece | null>({ length: 9 }).fill(null));
}

function hasMove(moves: Move[], from: [number, number], to: [number, number]) {
  return moves.some((move) => move.from.row === from[0] && move.from.col === from[1] && move.to.row === to[0] && move.to.col === to[1]);
}

function expectTactic(name: string, board: Board) {
  assert.equal(getCheckmateTactic(board, 'red')?.name, name);
}

function illegalMoveKeepsBoard() {
  const state = createInitialState();
  const next = makeMove(state, { from: { row: 6, col: 0 }, to: { row: 6, col: 1 } });
  assert.equal(next.history.length, 0);
  assert.equal(next.board[6][0]?.type, 'pawn');
  assert.equal(next.message, '这步不合法');
}

function horseLegBlocksJump() {
  const board = emptyBoard();
  board[9][4] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[5][4] = { side: 'red', type: 'horse' };
  board[4][4] = { side: 'red', type: 'pawn' };
  const moves = getLegalMoves(board, 'red');
  assert.equal(hasMove(moves, [5, 4], [3, 3]), false);
  assert.equal(hasMove(moves, [5, 4], [3, 5]), false);
}

function cannonNeedsScreen() {
  const board = emptyBoard();
  board[9][4] = { side: 'red', type: 'king' };
  board[0][0] = { side: 'black', type: 'king' };
  board[5][4] = { side: 'red', type: 'cannon' };
  board[2][4] = { side: 'black', type: 'rook' };
  assert.equal(hasMove(getLegalMoves(board, 'red'), [5, 4], [2, 4]), false);

  board[4][4] = { side: 'red', type: 'pawn' };
  assert.equal(hasMove(getLegalMoves(board, 'red'), [5, 4], [2, 4]), true);
}

function cannotExposeKings() {
  const board = emptyBoard();
  board[9][4] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[5][4] = { side: 'red', type: 'rook' };
  const moves = getLegalMoves(board, 'red');
  assert.equal(hasMove(moves, [5, 4], [5, 5]), false);
}

function rookBottomMateIsNotSeaBottomMoon() {
  const board = emptyBoard();
  board[9][4] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[1][3] = { side: 'red', type: 'rook' };
  const tactic = getCheckmateTactic(board, 'red');
  assert.notEqual(tactic?.name, '海底捞月');
}

function flyingKingMateIsFaceToFace() {
  const board = emptyBoard();
  board[9][4] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  expectTactic('对面笑', board);
}

function crouchingHorseMate() {
  const board = emptyBoard();
  board[9][0] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[0][3] = { side: 'black', type: 'advisor' };
  board[0][5] = { side: 'black', type: 'advisor' };
  board[1][4] = { side: 'black', type: 'pawn' };
  board[4][4] = { side: 'red', type: 'horse' };
  expectTactic('卧槽马', board);
}

function fishingHorseMate() {
  const board = emptyBoard();
  board[9][0] = { side: 'red', type: 'king' };
  board[0][3] = { side: 'black', type: 'king' };
  board[0][4] = { side: 'black', type: 'pawn' };
  board[1][3] = { side: 'black', type: 'pawn' };
  board[3][4] = { side: 'red', type: 'horse' };
  expectTactic('钓鱼马', board);
}

function doubleRookMate() {
  const board = emptyBoard();
  board[9][0] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[0][3] = { side: 'black', type: 'pawn' };
  board[0][5] = { side: 'black', type: 'pawn' };
  board[1][4] = { side: 'black', type: 'pawn' };
  board[3][4] = { side: 'red', type: 'rook' };
  board[4][4] = { side: 'red', type: 'rook' };
  expectTactic('双车错', board);
}

function rookHorseMate() {
  const board = emptyBoard();
  board[9][0] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[0][3] = { side: 'black', type: 'pawn' };
  board[0][5] = { side: 'black', type: 'pawn' };
  board[2][3] = { side: 'red', type: 'horse' };
  board[3][4] = { side: 'red', type: 'rook' };
  expectTactic('列马车', board);
}

function smotheredPalaceMate() {
  const board = emptyBoard();
  board[9][0] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[0][3] = { side: 'black', type: 'pawn' };
  board[0][5] = { side: 'black', type: 'pawn' };
  board[1][3] = { side: 'black', type: 'advisor' };
  board[1][4] = { side: 'black', type: 'pawn' };
  board[3][3] = { side: 'red', type: 'horse' };
  board[3][4] = { side: 'red', type: 'rook' };
  expectTactic('闷宫', board);
}

function ironBoltMate() {
  const board = emptyBoard();
  board[9][0] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[0][3] = { side: 'black', type: 'pawn' };
  board[0][5] = { side: 'black', type: 'pawn' };
  board[1][4] = { side: 'black', type: 'pawn' };
  board[3][3] = { side: 'red', type: 'horse' };
  board[3][4] = { side: 'red', type: 'rook' };
  expectTactic('铁门栓', board);
}

function doubleCannonMate() {
  const board = emptyBoard();
  board[9][0] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[1][4] = { side: 'black', type: 'advisor' };
  board[3][4] = { side: 'red', type: 'cannon' };
  board[4][4] = { side: 'red', type: 'cannon' };
  expectTactic('重炮', board);
}

function rookCannonClampMate() {
  const board = emptyBoard();
  board[9][0] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[1][4] = { side: 'black', type: 'advisor' };
  board[3][4] = { side: 'red', type: 'cannon' };
  board[5][3] = { side: 'red', type: 'cannon' };
  board[5][4] = { side: 'red', type: 'rook' };
  expectTactic('夹车炮', board);
}

function seaBottomMoonMate() {
  const board = emptyBoard();
  board[9][4] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[1][4] = { side: 'black', type: 'rook' };
  board[3][4] = { side: 'red', type: 'cannon' };
  board[5][4] = { side: 'red', type: 'rook' };
  expectTactic('海底捞月', board);
}

function stalemateMate() {
  const board = emptyBoard();
  board[9][0] = { side: 'red', type: 'king' };
  board[0][4] = { side: 'black', type: 'king' };
  board[1][3] = { side: 'red', type: 'rook' };
  board[1][5] = { side: 'red', type: 'rook' };
  expectTactic('困毙', board);
}

illegalMoveKeepsBoard();
horseLegBlocksJump();
cannonNeedsScreen();
cannotExposeKings();
rookBottomMateIsNotSeaBottomMoon();
flyingKingMateIsFaceToFace();
crouchingHorseMate();
fishingHorseMate();
doubleRookMate();
rookHorseMate();
smotheredPalaceMate();
ironBoltMate();
doubleCannonMate();
rookCannonClampMate();
seaBottomMoonMate();
stalemateMate();

console.log('xiangqi selftest ok');
