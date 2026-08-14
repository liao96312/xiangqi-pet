const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const distAssets = path.join(root, 'dist', 'assets');
const manifestPath = path.join(distAssets, 'HY3_RUNTIME_ASSET_MANIFEST.json');

if (!fs.existsSync(manifestPath)) throw new Error(`Missing runtime asset manifest: ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const allowed = new Set(manifest.assets.map((asset) => path.basename(asset.file)));
if (allowed.size !== 14) throw new Error(`Expected 14 runtime GLBs, found ${allowed.size}`);

const environmentAssets = path.join(distAssets, 'environment');
const expectedEnvironment = new Set([
  'banner-black-hy3-v1.glb',
  'banner-red-hy3-v1.glb',
  'brazier-hy3-v1.glb',
  'cheval-de-frise-hy3-v1.glb',
  'command-platform-hy3-v1.glb',
  'rubble-brick-a-hy3-v1.glb',
  'rubble-charred-b-hy3-v1.glb',
  'supply-cart-hy3-v1.glb',
  'tent-black-hy3-v1.glb',
  'tent-red-hy3-v1.glb',
  'war-drum-black-hy3-v1.glb',
  'war-drum-red-hy3-v1.glb',
  'wall-long-hy3-v1.glb',
  'wall-short-hy3-v1.glb',
  'watchtower-hy3-v1.glb',
  'weapon-rack-hy3-v1.glb'
]);
if (!fs.existsSync(environmentAssets)) throw new Error(`Missing environment assets: ${environmentAssets}`);
const packagedEnvironment = fs.readdirSync(environmentAssets).filter((filename) => filename.toLowerCase().endsWith('.glb'));
const missingEnvironment = [...expectedEnvironment].filter((filename) => !packagedEnvironment.includes(filename));
if (missingEnvironment.length || packagedEnvironment.length !== expectedEnvironment.size) {
  throw new Error(`Environment GLB whitelist mismatch; missing=${missingEnvironment.join(',')}; packaged=${packagedEnvironment.length}`);
}

for (const filename of fs.readdirSync(distAssets)) {
  if (filename.toLowerCase().endsWith('.glb') && !allowed.has(filename)) {
    fs.rmSync(path.join(distAssets, filename));
  }
}

const packaged = fs.readdirSync(distAssets).filter((filename) => filename.toLowerCase().endsWith('.glb'));
const missing = [...allowed].filter((filename) => !packaged.includes(filename));
if (missing.length || packaged.length !== allowed.size) {
  throw new Error(`Runtime GLB whitelist mismatch; missing=${missing.join(',')}; packaged=${packaged.length}`);
}

console.log(`runtime asset whitelist ok: ${packaged.length} piece GLBs + ${packagedEnvironment.length} environment GLBs`);
