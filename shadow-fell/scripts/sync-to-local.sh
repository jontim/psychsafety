#!/usr/bin/env bash
# Bring an existing local carrier up to date with this checkout of the shadow-fell directory.
# The first export is scripts/export-to-local.sh (one-shot, refuses to overwrite). This one is
# for every time after that: it copies changed files across and leaves your local .env, your
# downloaded portraits and rendered clips, and your local git history untouched.
# Usage: scripts/sync-to-local.sh [destination]   (default: ~/Projects/shadow-fell)
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$HOME/Projects/shadow-fell}"
if [ ! -d "$DEST" ]; then echo "No carrier at $DEST yet. Run scripts/export-to-local.sh first." >&2; exit 1; fi
rsync -a --itemize-changes \
  --exclude node_modules --exclude dist --exclude .git --exclude .env --exclude .env.local \
  --exclude 'public/portraits/*.png' --exclude 'public/portraits/*.job' --exclude 'public/portraits/candidates/' \
  --exclude 'public/clips/*' \
  "$SRC/" "$DEST/" | grep -v '^\.d' || true
echo "Synced into $DEST"
echo "If package.json changed: cd \"$DEST\" && npm install. Then npm run dev."
