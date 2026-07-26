/**
 * Build transparent logo + large taskbar/window icons + NSIS installer bitmaps.
 * Usage: npm run icons
 */
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcOriginal = path.join(root, "src/assets/brand/logo-original.png");
const fallbackLogo = path.join(root, "src/assets/brand/logo.png");
const outLogo = path.join(root, "src/assets/brand/logo.png");
const outMark = path.join(root, "src/assets/brand/logo-mark.png");
const outIconSrc = path.join(root, "src-tauri/icons/app-icon-source.png");
const outPublic = path.join(root, "public/logo.png");
const outFaviconPng = path.join(root, "public/favicon.png");

/** Knock near-black background to transparent; keep purple glyph. */
async function toTransparentGlyph(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.from(data);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      const sat = max - min;

      const isBg = lum < 28 && sat < 28;
      if (isBg) {
        out[i + 3] = 0;
        continue;
      }

      if (out[i + 3] > 20) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX) throw new Error("No glyph found after knockout");

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  console.log(
    `Glyph ${maxX - minX + 1}x${maxY - minY + 1} (transparent) from ${width}x${height}`,
  );

  return sharp(out, { raw: { width, height, channels: 4 } })
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png()
    .toBuffer();
}

async function transparentSquare(glyphBuf, size, fillRatio) {
  const fitted = await sharp(glyphBuf)
    .resize({
      width: Math.round(size * fillRatio),
      height: Math.round(size * fillRatio),
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = Math.round((size - fitted.info.width) / 2);
  const top = Math.round((size - fitted.info.height) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: fitted.data, left, top }])
    .png()
    .toBuffer();
}

async function windowIconSquare(glyphBuf, size) {
  return transparentSquare(glyphBuf, size, 0.92);
}

/** 24-bit BMP (NSIS Modern UI requires bitmap, not PNG). */
function encodeBmp24(width, height, rgba) {
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const fileSize = 54 + pixelSize;
  const buf = Buffer.alloc(fileSize);

  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(54, 10);

  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelSize, 34);

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    let dest = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const i = (srcY * width + x) * 4;
      const a = rgba[i + 3] / 255;
      const br = 28;
      const bg = 30;
      const bb = 36;
      const r = Math.round(rgba[i] * a + br * (1 - a));
      const g = Math.round(rgba[i + 1] * a + bg * (1 - a));
      const b = Math.round(rgba[i + 2] * a + bb * (1 - a));
      buf[dest++] = b;
      buf[dest++] = g;
      buf[dest++] = r;
    }
  }
  return buf;
}

async function writeNsisAssets(glyphBuf) {
  const outDir = path.join(root, "src-tauri/icons/nsis");
  fs.mkdirSync(outDir, { recursive: true });

  const sideW = 164;
  const sideH = 314;
  const sideCanvas = await sharp({
    create: {
      width: sideW,
      height: sideH,
      channels: 4,
      background: { r: 28, g: 30, b: 36, alpha: 255 },
    },
  })
    .png()
    .toBuffer();

  const sideGlyph = await sharp(glyphBuf)
    .resize({
      width: 110,
      height: 110,
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const sideRgba = await sharp(sideCanvas)
    .composite([
      {
        input: sideGlyph.data,
        left: Math.round((sideW - sideGlyph.info.width) / 2),
        top: Math.round(sideH * 0.28 - sideGlyph.info.height / 2),
      },
    ])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  fs.writeFileSync(
    path.join(outDir, "sidebar.bmp"),
    encodeBmp24(sideRgba.info.width, sideRgba.info.height, sideRgba.data),
  );

  const headW = 150;
  const headH = 57;
  const headCanvas = await sharp({
    create: {
      width: headW,
      height: headH,
      channels: 4,
      background: { r: 28, g: 30, b: 36, alpha: 255 },
    },
  })
    .png()
    .toBuffer();

  const headGlyph = await sharp(glyphBuf)
    .resize({
      width: 40,
      height: 40,
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const headRgba = await sharp(headCanvas)
    .composite([
      {
        input: headGlyph.data,
        left: 10,
        top: Math.round((headH - headGlyph.info.height) / 2),
      },
    ])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  fs.writeFileSync(
    path.join(outDir, "header.bmp"),
    encodeBmp24(headRgba.info.width, headRgba.info.height, headRgba.data),
  );

  console.log(`NSIS assets → ${outDir}/sidebar.bmp + header.bmp`);
}

async function main() {
  if (!fs.existsSync(srcOriginal) && fs.existsSync(fallbackLogo)) {
    fs.copyFileSync(fallbackLogo, srcOriginal);
  }
  const input = fs.existsSync(srcOriginal) ? srcOriginal : fallbackLogo;
  console.log(`Source: ${input}`);

  const glyph = await toTransparentGlyph(input);

  const ui512 = await transparentSquare(glyph, 512, 0.96);
  fs.writeFileSync(outLogo, ui512);
  fs.writeFileSync(outMark, ui512);
  fs.writeFileSync(outPublic, ui512);
  fs.writeFileSync(outFaviconPng, await transparentSquare(glyph, 256, 0.96));

  const icon1024 = await windowIconSquare(glyph, 1024);
  fs.writeFileSync(outIconSrc, icon1024);

  console.log("Running tauri icon…");
  execFileSync("npx", ["tauri", "icon", outIconSrc], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });

  fs.copyFileSync(
    path.join(root, "src-tauri/icons/icon.ico"),
    path.join(root, "public/favicon.ico"),
  );

  await writeNsisAssets(glyph);
  console.log("Done. Fully quit Gitorade (and restart Explorer if needed) to refresh taskbar icon.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
