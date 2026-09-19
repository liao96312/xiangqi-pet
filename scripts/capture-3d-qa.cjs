const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const electron = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const output = path.join(root, 'tmp');
const captures = [
  ['qa-red-seat-overcast-1920.png', 'overcast', 'red', 'seat', 1920, 1080],
  ['qa-black-seat-overcast-1920.png', 'overcast', 'black', 'seat', 1920, 1080],
  ['qa-red-overhead-overcast-1920.png', 'overcast', 'red', 'overhead', 1920, 1080],
  ['qa-black-cinematic-dusk-1920.png', 'dusk', 'black', 'cinematic', 1920, 1080],
  ['qa-red-tactical-overcast-1920.png', 'overcast', 'red', 'tactical', 1920, 1080],
  ['qa-black-tactical-dusk-1920.png', 'dusk', 'black', 'tactical', 1920, 1080],
  ['qa-red-seat-overcast-1366x768.png', 'overcast', 'red', 'seat', 1366, 768],
  ['qa-black-cinematic-dusk-900x900.png', 'dusk', 'black', 'cinematic', 900, 900],
  ['qa-red-tactical-overcast-430x620.png', 'overcast', 'red', 'tactical', 430, 620]
];

if (!fs.existsSync(electron)) throw new Error(`Electron not found: ${electron}`);
fs.mkdirSync(output, { recursive: true });

for (const [filename, theme, side, view, width, height] of captures) {
  const target = path.join(output, filename);
  const result = spawnSync(electron, [
    '.',
    `--qa-capture=${target}`,
    `--qa-theme=${theme}`,
    `--qa-side=${side}`,
    `--qa-view=${view}`,
    `--qa-width=${width}`,
    `--qa-height=${height}`
  ], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Capture failed (${result.status}): ${filename}`);
  const diagnostics = JSON.parse(fs.readFileSync(`${target}.json`, 'utf8'));
  if (!diagnostics.mode3d || !diagnostics.renderer || diagnostics.renderer.includes('SwiftShader') || !diagnostics.canvas || diagnostics.canvas[0] < 1 || diagnostics.canvas[1] < 1) {
    throw new Error(`Hardware WebGL validation failed: ${filename}: ${JSON.stringify(diagnostics)}`);
  }
  console.log(`${filename}: ${diagnostics.renderer}`);
  // Let Electron release the app single-instance mutex before the next case.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
}
