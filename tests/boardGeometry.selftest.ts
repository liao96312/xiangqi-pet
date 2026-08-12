import assert from 'node:assert/strict';
import { boardToWorld, homeFacingYaw, lerpYaw, movementFacingYaw, worldToBoard } from '../src/three/boardGeometry';
import { PIECE_LABELS, TACTICAL_TOKEN_TYPES, tacticalTokenStyle } from '../src/three/tacticalTokens';
import { solveBoardFraming, type BoardView } from '../src/three/viewport';

assert.deepEqual(boardToWorld({ row: 0, col: 0 }), [-4, 0.12, -4.5]);
assert.deepEqual(boardToWorld({ row: 9, col: 8 }), [4, 0.12, 4.5]);

for (let row = 0; row < 10; row += 1) {
  for (let col = 0; col < 9; col += 1) {
    const [x, , z] = boardToWorld({ row, col });
    assert.deepEqual(worldToBoard(x, z), { row, col });
  }
}

assert.equal(worldToBoard(5, 0), null);
assert.equal(homeFacingYaw('black'), 0);
assert.equal(homeFacingYaw('red'), Math.PI);
assert.equal(movementFacingYaw([0, 0, 0], [1, 0, 0]), Math.PI / 2);
assert.ok(Math.abs(lerpYaw(Math.PI * 0.9, -Math.PI * 0.9, 0.5) - Math.PI) < 1e-9);

assert.equal(TACTICAL_TOKEN_TYPES.length, 7);
assert.equal(new Set(TACTICAL_TOKEN_TYPES).size, 7);
for (const type of TACTICAL_TOKEN_TYPES) {
  assert.ok(PIECE_LABELS[type].red);
  assert.ok(PIECE_LABELS[type].black);
  const red = tacticalTokenStyle({ type, side: 'red' });
  const black = tacticalTokenStyle({ type, side: 'black' });
  assert.equal(red.label, PIECE_LABELS[type].red);
  assert.equal(black.label, PIECE_LABELS[type].black);
  assert.notEqual(red.sides, black.sides);
  assert.notEqual(red.body, black.body);
}

const views: BoardView[] = ['seat', 'overhead', 'cinematic', 'tactical'];
for (const view of views) {
  for (const [width, height] of [[2560, 1440], [1920, 1080], [1366, 768], [900, 900], [430, 620]]) {
    const red = solveBoardFraming(width, height, false, view);
    const black = solveBoardFraming(width, height, true, view);
    const radius = Math.hypot(red.position[0] - red.target[0], red.position[1] - red.target[1], red.position[2] - red.target[2]);
    const verticalReach = Math.tan((red.fov * Math.PI) / 360) * radius;
    const horizontalReach = verticalReach * (width / height);
    assert.ok(red.fov >= 28 && red.fov <= 78, `${view} ${width}x${height} fov`);
    assert.ok(verticalReach >= 6.9 && horizontalReach >= 6.9, `${view} ${width}x${height} contains the board and FX safety margin`);
    assert.ok(red.maxDistance > red.minDistance, `${view} distance limits`);
    assert.ok(red.maxPolarAngle <= 1.2, `${view} cannot reach a ground-level angle`);
    assert.equal(Math.sign(red.position[2]), -Math.sign(black.position[2]), `${view} mirrors by side`);
    assert.equal(red.position[1], black.position[1], `${view} keeps height by side`);
    if (view === 'seat' || view === 'cinematic') {
      assert.ok(Number.isFinite(red.minAzimuthAngle) && Number.isFinite(red.maxAzimuthAngle), `${view} horizontal orbit is confined`);
      assert.ok(red.maxAzimuthAngle - red.minAzimuthAngle <= 0.96, `${view} horizontal orbit stays inside the battlefield seat`);
      assert.ok(red.maxDistance <= 20.5, `${view} cannot back into scenery`);
      assert.ok(red.minDistance >= 10.5, `${view} cannot enter the pieces`);
    }
  }
}
assert.equal(solveBoardFraming(1920, 1080, false, 'seat').position[0], 0);
assert.ok(solveBoardFraming(1920, 1080, false, 'cinematic').position[0] > 0);
assert.ok(solveBoardFraming(1920, 1080, false, 'overhead').position[1] < solveBoardFraming(1920, 1080, false, 'tactical').position[1]);
