/**
 * Responsive perspective framing adapted from King's Gambit viewport.ts (MIT).
 * Copyright (c) 2026 King's Gambit contributors.
 */

export type BoardView = 'seat' | 'overhead' | 'cinematic' | 'tactical';

export type BoardFraming = {
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  rotateSpeed: number;
};

// The 9 x 10 intersection board is longer than a western 8 x 8 board. This
// sphere also leaves room for the outer-rank figures, weapons and selection FX.
const BOARD_REACH = 6.92;
const DEFAULT_FOV = 44;
const TACTICAL_FOV = 28;
const MAX_LENS_FOV = 78;

type ViewportProfile = {
  aspect: number;
  handheld: boolean;
  portrait: boolean;
};

function readViewport(width: number, height: number): ViewportProfile {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  return {
    aspect: safeWidth / safeHeight,
    handheld: safeWidth <= 620,
    portrait: safeWidth < safeHeight
  };
}

function fitFov(reach: number, distance: number, aspect: number) {
  const half = reach / Math.max(0.001, distance);
  const forHeight = Math.atan(half);
  const forWidth = Math.atan(half / Math.max(0.05, aspect));
  return (Math.max(forHeight, forWidth) * 360) / Math.PI;
}

function fitDistance(reach: number, fov: number, aspect: number) {
  const halfHeight = Math.tan((fov * Math.PI) / 360);
  const halfWidth = halfHeight * Math.max(0.05, aspect);
  return reach / Math.max(0.05, Math.min(halfHeight, halfWidth));
}

function lensCeiling(viewport: ViewportProfile, base: number) {
  if (viewport.handheld) return Math.max(base, viewport.portrait ? 68 : 58);
  return Math.max(base, viewport.aspect < 1 ? 62 : 52);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function solveBoardFraming(width: number, height: number, flipped: boolean, view: BoardView): BoardFraming {
  const viewport = readViewport(width, height);
  const side = flipped ? -1 : 1;

  if (view === 'tactical' || view === 'overhead') {
    const authoredFov = view === 'tactical' ? TACTICAL_FOV : 34;
    const radius = Math.max(view === 'tactical' ? 26.7 : 22.5, fitDistance(BOARD_REACH, authoredFov, viewport.aspect));
    const target: [number, number, number] = [0, view === 'tactical' ? 0 : 0.2, 0];
    return {
      fov: authoredFov,
      position: [target[0], target[1] + radius, target[2] + side * 0.55],
      target,
      minDistance: radius * 0.68,
      maxDistance: radius * 1.4,
      minPolarAngle: 0,
      maxPolarAngle: 0.03,
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: Infinity,
      rotateSpeed: 0
    };
  }

  if (view === 'cinematic') {
    const authored = { x: 8.6, y: 8.25, z: 11.8 * side };
    const authoredLength = Math.hypot(authored.x, authored.y, authored.z);
    const radius = Math.min(24, Math.max(authoredLength, fitDistance(BOARD_REACH, lensCeiling(viewport, 46), viewport.aspect)));
    const scale = radius / authoredLength;
    const target: [number, number, number] = [0, 0.42, -0.15 * side];
    const centreAzimuth = Math.atan2(authored.x, authored.z);
    return {
      fov: clamp(fitFov(BOARD_REACH, radius, viewport.aspect), 46, MAX_LENS_FOV),
      position: [target[0] + authored.x * scale, target[1] + authored.y * scale, target[2] + authored.z * scale],
      target,
      minDistance: viewport.handheld ? 11 : 10.5,
      maxDistance: Math.min(20, radius * 1.2),
      minPolarAngle: viewport.handheld ? 0.38 : 0.32,
      maxPolarAngle: viewport.handheld ? 1.06 : 1.18,
      minAzimuthAngle: centreAzimuth - 0.3,
      maxAzimuthAngle: centreAzimuth + 0.3,
      rotateSpeed: viewport.handheld ? 0.38 : 0.5
    };
  }

  // The normal play view is deliberately centred behind the player's army.
  // This keeps the long Xiangqi board rectangular and every file/rank readable;
  // the oblique showcase angle is attractive for a menu, but wastes play space.
  // Our HY3 units are substantially taller than the reference chess pieces,
  // so the same azimuth needs a higher and slightly more distant seat.
  const authored = { x: 0, y: 9.45, z: 14.25 * side };
  const authoredLength = Math.hypot(authored.x, authored.y, authored.z);
  let radius = Math.max(authoredLength, fitDistance(BOARD_REACH, lensCeiling(viewport, DEFAULT_FOV), viewport.aspect));
  radius = Math.min(radius, 24);

  const authoredPhi = Math.acos(authored.y / authoredLength);
  const phi = viewport.handheld ? Math.min(authoredPhi, viewport.portrait ? 0.72 : 0.88) : authoredPhi;
  const horizontal = Math.sin(phi) * radius;
  const azimuthLength = Math.hypot(authored.x, authored.z);
  const target: [number, number, number] = [0, 0.35, 0];
  const position: [number, number, number] = [
    target[0] + (authored.x / azimuthLength) * horizontal,
    target[1] + Math.cos(phi) * radius,
    target[2] + (authored.z / azimuthLength) * horizontal
  ];
  const fov = clamp(fitFov(BOARD_REACH, radius, viewport.aspect), DEFAULT_FOV, MAX_LENS_FOV);
  const centreAzimuth = side > 0 ? 0 : Math.PI;

  return {
    fov,
    position,
    target,
    minDistance: viewport.handheld ? 11.5 : 10.5,
    maxDistance: Math.min(20.5, radius * 1.2),
    minPolarAngle: viewport.handheld ? 0.36 : 0.3,
    maxPolarAngle: viewport.handheld ? 1.04 : 1.2,
    minAzimuthAngle: centreAzimuth - (viewport.handheld ? 0.34 : 0.48),
    maxAzimuthAngle: centreAzimuth + (viewport.handheld ? 0.34 : 0.48),
    rotateSpeed: viewport.handheld ? 0.4 : 0.55
  };
}
