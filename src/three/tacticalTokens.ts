import type { Piece, PieceType } from '../game/xiangqi';

export const PIECE_LABELS: Record<PieceType, { red: string; black: string }> = {
  king: { red: '帅', black: '将' },
  advisor: { red: '仕', black: '士' },
  elephant: { red: '相', black: '象' },
  horse: { red: '马', black: '马' },
  rook: { red: '车', black: '车' },
  cannon: { red: '炮', black: '炮' },
  pawn: { red: '兵', black: '卒' }
};

export const TACTICAL_TOKEN_TYPES: PieceType[] = ['king', 'advisor', 'elephant', 'horse', 'rook', 'cannon', 'pawn'];

export type TacticalTokenStyle = {
  label: string;
  sides: number;
  body: string;
  bodyEdge: string;
  inner: string;
  glyph: string;
  ornament: string;
};

/** Red is round and warm; black is octagonal and cool, so colour is not the only cue. */
export function tacticalTokenStyle(piece: Piece): TacticalTokenStyle {
  if (piece.side === 'red') {
    return {
      label: PIECE_LABELS[piece.type].red,
      sides: 48,
      body: '#761f1b',
      bodyEdge: '#37110f',
      inner: '#a43b2f',
      glyph: '#f4d59a',
      ornament: '#d7a44d'
    };
  }
  return {
    label: PIECE_LABELS[piece.type].black,
    sides: 8,
    body: '#172731',
    bodyEdge: '#091116',
    inner: '#294756',
    glyph: '#d8e4df',
    ornament: '#78a9b8'
  };
}
