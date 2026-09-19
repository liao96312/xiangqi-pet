const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const electron = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const output = path.join(root, 'tmp', 'qa-dynamic');
const target = `${output}.png`;

if (!fs.existsSync(electron)) throw new Error(`Electron not found: ${electron}`);
fs.mkdirSync(path.dirname(output), { recursive: true });

const result = spawnSync(electron, [
  '.',
  `--qa-capture=${target}`,
  '--qa-scenario=dynamic',
  '--qa-theme=overcast',
  '--qa-side=red',
  '--qa-view=seat',
  '--qa-width=1920',
  '--qa-height=1080'
], { cwd: root, stdio: 'inherit' });

const reportPath = `${output}.json`;
if (!fs.existsSync(reportPath)) throw new Error('Dynamic QA report was not generated');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
if (result.status !== 0 || !report.passed) {
  throw new Error(`Dynamic QA failed (${result.status}): ${JSON.stringify(report, null, 2)}`);
}

const expected = [
  ['initial', 32],
  ['red-move', 32],
  ['black-move', 32],
  ['capture', 31],
  ['flipped', 31],
  ['overhead', 31],
  ['cinematic', 31],
  ['orbit-zoom', 31],
  ['resized-1366x768', 31],
  ['undo', 32],
  ['reset', 32],
  ['ai-response', 32]
];

if (report.steps.length !== expected.length) throw new Error(`Expected ${expected.length} QA steps, got ${report.steps.length}`);
for (let index = 0; index < expected.length; index += 1) {
  const [name, occupiedCount] = expected[index];
  const step = report.steps[index];
  if (step.name !== name || step.diagnostics.occupiedCount !== occupiedCount || !step.diagnostics.mode3d) {
    throw new Error(`Unexpected QA step ${index}: ${JSON.stringify(step, null, 2)}`);
  }
  if (!step.diagnostics.renderer || step.diagnostics.renderer.includes('SwiftShader')) {
    throw new Error(`Hardware WebGL validation failed at ${name}: ${step.diagnostics.renderer}`);
  }
}

console.log(`Dynamic 3D QA passed: ${report.steps.length} steps, ${report.steps[0].diagnostics.renderer}`);
