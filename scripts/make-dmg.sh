#!/usr/bin/env bash
# Build Gitorade.app (Tauri) then pack a UDZO .dmg with hdiutil.
# Avoids Tauri's bundle_dmg.sh AppleScript/Finder step, which often hangs in CI/automation.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

source "$HOME/.cargo/env" 2>/dev/null || true

echo "==> Building .app (no Tauri DMG bundler)…"
npx tauri build --bundles app

APP="$ROOT/src-tauri/target/release/bundle/macos/Gitorade.app"
if [[ ! -d "$APP" && -n "${CARGO_TARGET_DIR:-}" ]]; then
  APP="$CARGO_TARGET_DIR/release/bundle/macos/Gitorade.app"
fi
if [[ ! -d "$APP" ]]; then
  echo "error: Gitorade.app not found after build (expected under src-tauri/target/release/bundle/macos/)" >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
ARCH="$(uname -m)"
case "$ARCH" in
  arm64) ARCH_LABEL="aarch64" ;;
  x86_64) ARCH_LABEL="x64" ;;
  *) ARCH_LABEL="$ARCH" ;;
esac

OUT_DIR="$ROOT/src-tauri/target/release/bundle"
mkdir -p "$OUT_DIR/macos" "$OUT_DIR/dmg"
if [[ "$(cd "$APP/.." && pwd)" != "$(cd "$OUT_DIR/macos" && pwd)" ]]; then
  rm -rf "$OUT_DIR/macos/Gitorade.app"
  cp -R "$APP" "$OUT_DIR/macos/Gitorade.app"
  APP="$OUT_DIR/macos/Gitorade.app"
fi

DMG="$OUT_DIR/dmg/Gitorade_${VERSION}_${ARCH_LABEL}.dmg"
STAGE="$(mktemp -d)"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

cp -R "$APP" "$STAGE/Gitorade.app"
ln -sf /Applications "$STAGE/Applications"

echo "==> Creating $DMG …"
rm -f "$DMG"
hdiutil create -volname "Gitorade" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
hdiutil verify "$DMG" >/dev/null

echo
echo "OK"
echo "  App: $APP"
echo "  DMG: $DMG ($(du -h "$DMG" | awk '{print $1}'))"
