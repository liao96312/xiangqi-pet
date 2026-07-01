/**
 * Electron launcher that strips ELECTRON_RUN_AS_NODE from the environment.
 *
 * WorkBuddy and some other tools set ELECTRON_RUN_AS_NODE=1, which forces
 * Electron to behave as a plain Node.js runtime with no GUI / Electron API.
 * This wrapper removes that variable before spawning Electron so the app
 * starts normally regardless of the host environment.
 */
const { spawn } = require('child_process');
const electronPath = require('electron');

const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env,
  windowsHide: false
});

child.on('close', (code) => process.exit(code != null ? code : 0));
