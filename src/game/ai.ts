import { applyMove, getBestMove, getLegalMoves, type GameState } from './xiangqi';

export const difficulties = [
  { key: 'book', label: '谱招练习', depth: 1, blunderRate: 0, delay: 120, engineTime: 0, useEngine: false },
  { key: 'rookie', label: '入门', depth: 1, blunderRate: 0.8, delay: 120, engineTime: 0, useEngine: false },
  { key: 'normal', label: '普通', depth: 1, blunderRate: 0.35, delay: 180, engineTime: 0, useEngine: false },
  { key: 'advanced', label: '进阶', depth: 2, blunderRate: 0.08, delay: 240, engineTime: 900, useEngine: true },
  { key: 'strong', label: '强一些', depth: 3, blunderRate: 0, delay: 320, engineTime: 2200, useEngine: true }
] as const;

export type DifficultyProfile = (typeof difficulties)[number];
export type DifficultyKey = DifficultyProfile['key'];

export function getDifficultyProfile(key: DifficultyKey): DifficultyProfile {
  return difficulties.find((item) => item.key === key) ?? difficulties[2];
}

export function chooseAiMove(board: GameState['board'], side: GameState['turn'], depth: number, blunderRate = 0) {
  const allMoves = getLegalMoves(board, side);
  if (blunderRate >= 0.7 && allMoves.length > 0 && Math.random() < blunderRate) {
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }
  const best = getBestMove(board, side, depth);
  if (!best || blunderRate <= 0 || Math.random() > blunderRate) return best;

  const legal = allMoves
    .map((move) => {
      const reply = getBestMove(applyMove(board, move), side === 'red' ? 'black' : 'red', Math.max(1, depth - 1));
      return { ...move, score: -(reply?.score ?? 0) + (move.capture ? 40 : 0) };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (legal.length <= 1) return best;
  const pool = legal.slice(0, Math.min(4, legal.length));
  return pool[Math.floor(Math.random() * pool.length)];
}
