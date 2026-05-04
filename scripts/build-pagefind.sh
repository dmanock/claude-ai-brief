#!/usr/bin/env bash
#
# build-pagefind.sh  —  Rebuild the static search index for cadb.info
#
# Pagefind scans the `data-pagefind-body` regions of report HTML files,
# tokenises and shards the result into `pagefind/` so the homepage can
# load only the chunks it needs at query time.
#
# Run this whenever a new report is added under `reports/`. The daily
# scheduled task calls it as Step 9 (replacing the old Python index
# builder). It's idempotent and safe to re-run.
#
# Requirements:
#   - Node 18+ (auto-installs pagefind into ./node_modules on first run)
#
# Exit codes:
#   0  success
#   1  pagefind invocation failed
#   2  no reports matched the glob (likely a path mistake)

set -euo pipefail

# Resolve to the workspace root (the parent of this scripts/ directory).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# Sanity check the input glob — bail loudly if no reports exist rather
# than silently producing an empty index.
shopt -s nullglob
reports=( reports/claude-ai-daily-*.html )
if [ "${#reports[@]}" -eq 0 ]; then
  echo "build-pagefind: no reports matched reports/claude-ai-daily-*.html" >&2
  exit 2
fi

# Install pagefind locally on first run. We pin via package.json if one
# exists; otherwise we install the latest stable into a transient
# node_modules. --no-save keeps the workspace clean.
if [ ! -x ./node_modules/.bin/pagefind ]; then
  echo "build-pagefind: installing pagefind..."
  npm install --no-save --no-audit --no-fund pagefind >/dev/null
fi

echo "build-pagefind: indexing ${#reports[@]} reports + index.html"
./node_modules/.bin/pagefind \
  --site . \
  --glob "{reports/*.html,index.html}" \
  --output-path "pagefind"

# Print a small summary so logs show what shipped.
if [ -f pagefind/pagefind-entry.json ]; then
  pages=$(node -e "console.log(Object.values(require('./pagefind/pagefind-entry.json').languages).reduce((a,l)=>a+l.page_count,0))")
  echo "build-pagefind: indexed ${pages} pages, output in pagefind/"
fi
