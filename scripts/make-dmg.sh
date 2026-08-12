#!/usr/bin/env bash
# Build Gitorade.app (Tauri) then pack a UDZO .dmg with hdiutil.
# Avoids Tauri's bundle_dmg.sh AppleScript/Finder step, which often hangs in CI/automation.
#
# Usage:
#   scripts/make-dmg.sh
#   scripts/make-dmg.sh --skip-build
#   scripts/make-dmg.sh --target aarch64-apple-darwin
#   scripts/make-dmg.sh --skip-build --target x86_64-apple-darwin
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

source "$HOME/.cargo/env" 2>/dev/null || true

SKIP_BUILD=0
TARGET=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1; shift ;;
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    *)
      echo "usage: $0 [--skip-build] [--target <triple>]" >&2
      exit 2
      ;;
  esac
done

build_args=(--bundles app)
if [[ -n "$TARGET" ]]; then
  build_args+=(--target "$TARGET")
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "==> Building .app (no Tauri DMG bundler)… ${TARGET:-host}"
  npx tauri build "${build_args[@]}"
fi

# Resolve where Tauri wrote the .app
CANDIDATES=()
if [[ -n "$TARGET" ]]; then
  CANDIDATES+=(
    "$ROOT/src-tauri/target/${TARGET}/release/bundle/macos/Gitorade.app"
  )
fi
CANDIDATES+=(
  "$ROOT/src-tauri/target/release/bundle/macos/Gitorade.app"
)
if [[ -n "${CARGO_TARGET_DIR:-}" ]]; then
  if [[ -n "$TARGET" ]]; then
    CANDIDATES+=("$CARGO_TARGET_DIR/${TARGET}/release/bundle/macos/Gitorade.app")
  fi
  CANDIDATES+=("$CARGO_TARGET_DIR/release/bundle/macos/Gitorade.app")
fi

APP=""
for candidate in "${CANDIDATES[@]}"; do
  if [[ -d "$candidate" ]]; then
    APP="$candidate"
    break
  fi
done

if [[ -z "$APP" ]]; then
  echo "error: Gitorade.app not found after build" >&2
  printf '  looked in:\n' >&2
  for candidate in "${CANDIDATES[@]}"; do
    printf '    %s\n' "$candidate" >&2
  done
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
if [[ -n "$TARGET" ]]; then
  case "$TARGET" in
    aarch64-apple-darwin) ARCH_LABEL="aarch64" ;;
    x86_64-apple-darwin) ARCH_LABEL="x64" ;;
    *) ARCH_LABEL="$TARGET" ;;
  esac
else
  case "$(uname -m)" in
    arm64) ARCH_LABEL="aarch64" ;;
    x86_64) ARCH_LABEL="x64" ;;
    *) ARCH_LABEL="$(uname -m)" ;;
  esac
fi

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
echo "DMG_PATH=$DMG"
