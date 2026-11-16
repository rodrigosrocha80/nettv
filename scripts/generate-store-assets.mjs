import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const outDir = resolve(process.cwd(), 'store-assets');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, colorType, pixelBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colorType; // 2 = RGB, 6 = RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // pHYs chunk: 72 DPI (~2835 pixels/meter)
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(2835, 0);
  phys.writeUInt32BE(2835, 4);
  phys[8] = 1;

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter None
    pixelBuffer.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('pHYs', phys),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawRoundedPlayMark(buf, width, height, channels, cx, cy, size, withBg) {
  const half = size / 2;
  const radius = size * 0.22;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      if (withBg) {
        // Gradiente escuro elegante (#0B1220 -> #1E293B)
        const t = y / height;
        buf[idx] = Math.round(11 + t * 19);
        buf[idx + 1] = Math.round(18 + t * 23);
        buf[idx + 2] = Math.round(32 + t * 27);
        if (channels === 4) buf[idx + 3] = 255;
      }

      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const inner = half - radius;
      const inBox =
        (dx <= inner && dy <= half) ||
        (dy <= inner && dx <= half) ||
        (dx > inner && dy > inner && (dx - inner) ** 2 + (dy - inner) ** 2 <= radius ** 2);

      if (inBox) {
        // Triângulo de Play centralizado dentro do emblema azul (#0EA5E9)
        const relX = (x - cx) / half;
        const relY = (y - cy) / half;
        const inPlay = relX >= -0.28 && relX <= 0.44 && Math.abs(relY) <= (0.44 - relX) * 0.62;

        if (inPlay) {
          buf[idx] = 248;
          buf[idx + 1] = 250;
          buf[idx + 2] = 252;
        } else {
          buf[idx] = 14;
          buf[idx + 1] = 165;
          buf[idx + 2] = 233;
        }
        if (channels === 4) buf[idx + 3] = 255;
      }
    }
  }
}

// 1. Background 1920x1080 (24-bit RGB)
const bgBuf = Buffer.alloc(1920 * 1080 * 3);
for (let y = 0; y < 1080; y++) {
  const t = y / 1080;
  const r = Math.round(11 + t * 19);
  const g = Math.round(18 + t * 23);
  const b = Math.round(32 + t * 27);
  for (let x = 0; x < 1920; x++) {
    const idx = (y * 1920 + x) * 3;
    bgBuf[idx] = r;
    bgBuf[idx + 1] = g;
    bgBuf[idx + 2] = b;
  }
}
const bgPath = resolve(outDir, 'icon-1920x1080-background.png');
writeFileSync(bgPath, encodePng(1920, 1080, 2, bgBuf));

// 2. Foreground 1920x1080 (32-bit RGBA transparente)
const fgBuf = Buffer.alloc(1920 * 1080 * 4);
drawRoundedPlayMark(fgBuf, 1920, 1080, 4, 960, 540, 420, false);
const fgPath = resolve(outDir, 'icon-1920x1080-foreground.png');
writeFileSync(fgPath, encodePng(1920, 1080, 6, fgBuf));

// 3. Secondary Icon 512x423 (32-bit RGBA com fundo)
const secBuf = Buffer.alloc(512 * 423 * 4);
drawRoundedPlayMark(secBuf, 512, 423, 4, 256, 211, 220, true);
const secPath = resolve(outDir, 'icon-512x423.png');
writeFileSync(secPath, encodePng(512, 423, 6, secBuf));

for (const p of [bgPath, fgPath, secPath]) {
  const kb = (statSync(p).size / 1024).toFixed(1);
  console.log(`[store-assets] Generated ${p} (${kb} KB)`);
}
