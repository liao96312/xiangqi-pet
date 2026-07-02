const fs = require('node:fs');
const path = require('node:path');

const enginesDir = path.join(__dirname, '..', 'engines');

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

if (engines.length === 0) {
  console.error('Pikafish engine missing. Put a real pikafish*.exe under engines/ before building the installer.');
  process.exit(1);
}

console.log(`Pikafish engine: ${path.relative(path.join(__dirname, '..'), engines[0])}`);
