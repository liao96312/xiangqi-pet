import type { Pos, Side } from '../game/xiangqi';

export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;
export const BOARD_SPACING = 1;
export const BOARD_TOP = 0.12;
export const BOARD_MARK_Y = BOARD_TOP + 0.002;
export const BOARD_SHADOW_Y = BOARD_TOP + 0.006;
export const BOARD_RING_Y = BOARD_TOP + 0.012;
export const BOARD_HIGHLIGHT_Y = BOARD_TOP + 0.018;

export type BoardPoint = [number, number, number];

/** Logical board coordinates never change when the camera is flipped. */
export function boardToWorld(pos: Pos, y = BOARD_TOP): BoardPoint {
  return [
    (pos.col - (BOARD_COLS - 1) / 2) * BOARD_SPACING,
    y,
    (pos.row - (BOARD_ROWS - 1) / 2) * BOARD_SPACING
  ];
}

export function worldToBoard(x: number, z: number): Pos | null {
  const col = Math.round(x / BOARD_SPACING + (BOARD_COLS - 1) / 2);
  const row = Math.round(z / BOARD_SPACING + (BOARD_ROWS - 1) / 2);
  if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) return null;
  return { row, col };
}

/** Canonical models face local +Z. Red advances toward -Z; black toward +Z. */
export function homeFacingYaw(side: Side): number {
  return side === 'red' ? Math.PI : 0;
}

export function movementFacingYaw(from: BoardPoint, to: BoardPoint): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

export function lerpYaw(from: number, to: number, amount: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * Math.min(1, Math.max(0, amount));
}
