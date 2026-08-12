const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const distAssets = path.join(root, 'dist', 'assets');
const manifestPath = path.join(distAssets, 'HY3_RUNTIME_ASSET_MANIFEST.json');

if (!fs.existsSync(manifestPath)) throw new Error(`Missing runtime asset manifest: ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const allowed = new Set(manifest.assets.map((asset) => path.basename(asset.file)));
if (allowed.size !== 14) throw new Error(`Expected 14 runtime GLBs, found ${allowed.size}`);

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

console.log(`runtime asset whitelist ok: ${packaged.length} GLBs`);
