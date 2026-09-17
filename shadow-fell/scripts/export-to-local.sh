#!/usr/bin/env bash
# Lift the shadow-fell carrier directory out of the burner repo into a fresh local repository.
# Usage: scripts/export-to-local.sh [destination]   (default: ~/Projects/shadow-fell)
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$HOME/Projects/shadow-fell}"
if [ -e "$DEST" ]; then echo "Destination exists: $DEST" >&2; exit 1; fi
mkdir -p "$(dirname "$DEST")"
rsync -a --exclude node_modules --exclude dist --exclude .env "$SRC/" "$DEST/"
cd "$DEST"
git init -q
git add -A
git commit -q -m "The Shadow Fell: voice-first story engine, first carrier export"
echo "Exported to $DEST"
echo "Next: cd \"$DEST\" && cp .env.example .env && npm install && npm run dev"
echo "Then create the GitHub repository and: git remote add origin <url> && git push -u origin main"
