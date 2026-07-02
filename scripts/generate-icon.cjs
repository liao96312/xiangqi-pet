const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, '..', 'build');
const outFile = path.join(outDir, 'icon.ico');
const sizes = [16, 32, 48, 64, 128, 256];

fs.mkdirSync(outDir, { recursive: true });

function imageFor(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radius = size * 0.47;
  const coinRadius = size * 0.36;
  const innerRadius = size * 0.27;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const offset = (y * size + x) * 4;
      if (distance > radius) continue;

      let r = 96;
      let g = 42;
      let b = 28;
      if (distance <= coinRadius) {
        const t = Math.max(0, Math.min(1, distance / coinRadius));
        r = Math.round(255 - t * 65);
        g = Math.round(224 - t * 86);
        b = Math.round(141 - t * 84);
      }
      if (Math.abs(distance - coinRadius) < size * 0.025 || Math.abs(distance - innerRadius) < size * 0.012) {
        r = 92;
        g = 47;
        b = 22;
      }
      if (isRedMark(x, y, size)) {
        r = 153;
        g = 28;
        b = 25;
      }
      pixels[offset] = b;
      pixels[offset + 1] = g;
      pixels[offset + 2] = r;
      pixels[offset + 3] = 255;
    }
  }

  return dibFor(size, pixels);
}

function isRedMark(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const line = Math.max(1, size * 0.022);
  const span = size * 0.22;
  const river = Math.abs(y - cy) < line && Math.abs(x - cx) < span;
  const vertical = Math.abs(x - cx) < line && Math.abs(y - cy) < span;
  const slashA = Math.abs((x - cx) - (y - cy)) < line && Math.abs(x - cx) < span * 0.8;
  const slashB = Math.abs((x - cx) + (y - cy)) < line && Math.abs(x - cx) < span * 0.8;
  return river || vertical || slashA || slashB;
}

function dibFor(size, pixels) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(size * size * 4, 20);

  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const sourceStart = y * size * 4;
    const targetStart = (size - 1 - y) * size * 4;
    pixels.copy(xor, targetStart, sourceStart, sourceStart + size * 4);
  }
  const maskStride = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, xor, Buffer.alloc(maskStride * size)]);
}

const images = sizes.map(imageFor);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

let offset = 6 + images.length * 16;
const directories = images.map((image, index) => {
  const size = sizes[index];
  const dir = Buffer.alloc(16);
  dir.writeUInt8(size === 256 ? 0 : size, 0);
  dir.writeUInt8(size === 256 ? 0 : size, 1);
  dir.writeUInt8(0, 2);
  dir.writeUInt8(0, 3);
  dir.writeUInt16LE(1, 4);
  dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(image.length, 8);
  dir.writeUInt32LE(offset, 12);
  offset += image.length;
  return dir;
});

fs.writeFileSync(outFile, Buffer.concat([header, ...directories, ...images]));
console.log(outFile);
