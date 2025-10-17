#!/usr/bin/env bash
set -euo pipefail

# Simple build & release helper for manual flow
# - Auto bump version (default: patch) unless --no-bump
# - Generates PNG icon
# - Compiles TS
# - Packages VSIX into dist/
# - Optionally publishes to Marketplace when passing --publish

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ---- Args parsing ----
BUMP_TYPE="patch"      # patch | minor | major | prepatch | prerelease ...
DO_PUBLISH=false
DO_BUMP=true

while [[ $# -gt 0 ]]; do
  case "${1}" in
    --publish)
      DO_PUBLISH=true
      shift
      ;;
    --bump)
      if [[ -n "${2-}" ]]; then
        BUMP_TYPE="${2}"
        shift 2
      else
        echo "Error: --bump requires a value (patch|minor|major|prepatch|prerelease)" >&2
        exit 1
      fi
      ;;
    --no-bump)
      DO_BUMP=false
      shift
      ;;
    *)
      echo "Unknown option: ${1}" >&2
      echo "Usage: $0 [--bump <type>] [--no-bump] [--publish]" >&2
      exit 1
      ;;
  esac
done

mkdir -p dist

# ---- Version bump (no git tag) ----
PREV_VERSION="$(node -p "require('./package.json').version")"
if $DO_BUMP; then
  echo "[0/5] Bump version (${BUMP_TYPE})"
  npm version "$BUMP_TYPE" --no-git-tag-version
else
  echo "[0/5] Skip version bump (--no-bump)"
fi
NEW_VERSION="$(node -p "require('./package.json').version")"
echo "Version: ${PREV_VERSION} -> ${NEW_VERSION}"

echo "[1/5] Install deps (if needed)"
npm install

echo "[2/5] Build icon"
npm run build:icon

echo "[3/5] Compile"
npm run compile

echo "[4/5] Package (.vsix to dist/)"
# vsce 支持 --out 将包写到指定路径
VSIX_NAME="trajv-jsonl-viewer-${NEW_VERSION}.vsix"
npx vsce package --out "dist/${VSIX_NAME}"
echo "VSIX generated at dist/${VSIX_NAME}"

if $DO_PUBLISH; then
  echo "[5/5] Publishing to Marketplace..."
  # 依赖 VSCE_PAT 环境变量
  npx vsce publish
fi

echo "Done."
