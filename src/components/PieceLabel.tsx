import type { UseXiangqiGameReturn } from '../game/useXiangqiGame';

const labels = {
  red: {
    king: '帅',
    advisor: '仕',
    elephant: '相',
    horse: '傌',
    rook: '俥',
    cannon: '炮',
    pawn: '兵'
  },
  black: {
    king: '将',
    advisor: '士',
    elephant: '象',
    horse: '马',
    rook: '车',
    cannon: '砲',
    pawn: '卒'
  }
} as const;

export type Piece = NonNullable<UseXiangqiGameReturn['state']['board'][number][number]>;

export function pieceLabelView(piece: Piece) {
  return labels[piece.side][piece.type];
}
