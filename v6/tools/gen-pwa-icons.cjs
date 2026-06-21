// Generates pwa-192.png and pwa-512.png from scratch using Node.js built-ins only.
// Matches the SVG design: dark purple rounded rect + purple lightning bolt.

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── PNG helpers ───────────────────────────────────────────────────────────────

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return (~crc) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, c]);
}

function buildPNG(pixels, size) {
  // IHDR: RGBA 8-bit
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA

  // Raw scanlines: filter byte 0 + RGBA row
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (1 + size * 4) + 1 + x * 4;
      raw[dst]   = pixels[src];
      raw[dst+1] = pixels[src+1];
      raw[dst+2] = pixels[src+2];
      raw[dst+3] = pixels[src+3];
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig  = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  return Buffer.concat([sig, pngChunk('IHDR',ihdr), pngChunk('IDAT',idat), pngChunk('IEND',Buffer.alloc(0))]);
}

// ── Rasteriser ────────────────────────────────────────────────────────────────

// Point-in-polygon (ray casting)
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const sc = size / 192; // scale factor relative to 192-px canvas

  // Background: #1a0533, Bolt fill: #863bff
  const BG   = [0x1a, 0x05, 0x33];
  const BOLT = [0x86, 0x3b, 0xff];

  // Rounded-rect corner radius (matches SVG rx="40")
  const rx = Math.round(40 * sc);

  // Lightning bolt polygon — derived from the SVG path at transform="translate(48,44) scale(2)"
  // Original SVG path points (before transform):
  //   M10.013,0.474  →  t+s  →  (10.013*2+48, 0.474*2+44) / 192 * size
  //   M39.827,0.474
  //   L32.347,11.788
  //   L43.724,11.788   (right tip of upper notch, but actually from path: 1.456→920 inverted sign)
  // Re-derived numerically from the path "d" string in pwa-192.svg:
  // The path (in local coords, before transform):
  //   M 10.013,0.474
  //   L 39.827,0.474    (top edge — top-right corner of bolt head)
  //   L 32.347,10.471   (inner notch right)
  //   L 43.724,10.471   (outer right)
  //   L 25.946,44.938   (bottom tip)
  //   L 22.025,33.937   (inner notch left)
  //   L 10.287,33.937   (outer left)
  //   Z
  // After transform translate(48,44) scale(2), then / 192 * size:
  const raw = [
    [10.013,  0.474],
    [39.827,  0.474],
    [32.347, 10.471],
    [43.724, 10.471],
    [25.946, 44.938],
    [22.025, 33.937],
    [10.287, 33.937],
  ];
  const boltPoly = raw.map(([x, y]) => [(x * 2 + 48) * sc, (y * 2 + 44) * sc]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // ── Rounded rect alpha ────────────────────────────────────────────────
      const nearX = x < rx ? rx : x > size - 1 - rx ? size - 1 - rx : x;
      const nearY = y < rx ? rx : y > size - 1 - rx ? size - 1 - rx : y;
      const d     = Math.sqrt((x - nearX) ** 2 + (y - nearY) ** 2);

      if (d > rx + 0.5) { // fully outside
        pixels[idx+3] = 0;
        continue;
      }
      const alpha = d > rx - 0.5 ? Math.round((rx + 0.5 - d) * 255) : 255;

      // ── Bolt fill ─────────────────────────────────────────────────────────
      const inBolt = pointInPoly(x + 0.5, y + 0.5, boltPoly);
      const [r, g, b] = inBolt ? BOLT : BG;

      pixels[idx]   = r;
      pixels[idx+1] = g;
      pixels[idx+2] = b;
      pixels[idx+3] = alpha;
    }
  }

  return pixels;
}

// ── Generate & write ──────────────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'public');

for (const size of [192, 512]) {
  const pixels = generateIcon(size);
  const png    = buildPNG(pixels, size);
  const dest   = path.join(outDir, `pwa-${size}.png`);
  fs.writeFileSync(dest, png);
  console.log(`✅ wrote ${dest} (${(png.length / 1024).toFixed(1)} KB)`);
}
