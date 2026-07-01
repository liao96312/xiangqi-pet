const fs = require('node:fs');

fs.writeFileSync('.selftest/package.json', '{"type":"commonjs"}\n');
