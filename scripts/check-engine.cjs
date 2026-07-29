const fs = require('node:fs');
const path = require('node:path');

const enginesDir = path.join(__dirname, '..', 'engines', 'pikafish-official');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const engines = walk(enginesDir).filter((file) => {
  const name = path.basename(file).toLowerCase();
  return name.endsWith('.exe') && name.includes('pikafish') && !name.includes('setup') && !name.includes('proxy');
});

const names = engines.map((file) => path.basename(file).toLowerCase());
if (!names.some((name) => name.includes('avx2')) || !names.some((name) => name.includes('sse41'))) {
  console.error('Installer requires both AVX2 and SSE4.1 Pikafish builds under engines/pikafish-official/.');
  process.exit(1);
}

console.log(`Pikafish engines: ${engines.map((file) => path.basename(file)).join(', ')}`);
