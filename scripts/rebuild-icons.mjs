/**
 * Build transparent logo + large taskbar/window icons from brand source.
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

      // Solid / near-black plate → transparent
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

/** Place glyph centered on transparent square (UI / animation). */
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

/**
 * Windows taskbar/title icons: glyph fills almost the entire square
 * on an opaque dark plate (Windows masks icons; padding = looks tiny).
 */
async function windowIconSquare(glyphBuf, size) {
  const fill = 0.96;
  const fitted = await sharp(glyphBuf)
    .resize({
      width: Math.round(size * fill),
      height: Math.round(size * fill),
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = Math.round((size - fitted.info.width) / 2);
  const top = Math.round((size - fitted.info.height) / 2);

  // Full opaque plate — maximizes visible mark in taskbar / title bar
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 16, g: 18, b: 26, alpha: 255 },
    },
  })
    .composite([{ input: fitted.data, left, top }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(srcOriginal) && fs.existsSync(fallbackLogo)) {
    fs.copyFileSync(fallbackLogo, srcOriginal);
  }
  const input = fs.existsSync(srcOriginal) ? srcOriginal : fallbackLogo;
  console.log(`Source: ${input}`);

  const glyph = await toTransparentGlyph(input);

  // UI logo — fully transparent background (fixes “tudo preto”)
  const ui512 = await transparentSquare(glyph, 512, 0.96);
  fs.writeFileSync(outLogo, ui512);
  fs.writeFileSync(outMark, ui512);
  fs.writeFileSync(outPublic, ui512);
  fs.writeFileSync(outFaviconPng, await transparentSquare(glyph, 256, 0.96));

  // Window / taskbar source — huge glyph + soft disc
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
  console.log("Done. Fully quit Gitorade (and restart Explorer if needed) to refresh taskbar icon.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
