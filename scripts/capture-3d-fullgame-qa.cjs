const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const electron = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const output = path.join(root, 'tmp', 'qa-fullgame');
const result = spawnSync(electron, [
  '.', `--qa-capture=${output}.png`, '--qa-scenario=fullgame', '--qa-theme=overcast',
  '--qa-side=red', '--qa-view=seat', '--qa-width=1920', '--qa-height=1080'
], { cwd: root, stdio: 'inherit' });
const report = JSON.parse(fs.readFileSync(`${output}.json`, 'utf8'));
if (result.status !== 0 || !report.passed) throw new Error(`Full-game 3D QA failed (${result.status}): ${JSON.stringify(report, null, 2)}`);
if (report.outcome.winner !== 'red' || report.outcome.historyLength !== 39 || report.checkpoints.length !== 4) throw new Error(`Unexpected full-game report: ${JSON.stringify(report, null, 2)}`);
console.log(`Full-game 3D QA passed: ${report.outcome.historyLength} plies, ${report.outcome.result}`);
