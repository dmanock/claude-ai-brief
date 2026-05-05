#!/usr/bin/env bash
#
# verify-site.sh - Pre-deploy integrity check for cadb.info
#
# Catches the recurring "index.html got silently truncated" bug.
# Run before push. Non-zero exit blocks the deploy.
#
# Usage: bash scripts/verify-site.sh
#
# Checks:
#   1. index.html ends with </html>
#   2. index.html contains <script src="/search.js"
#   3. search.js exists and parses as JS
#   4. pagefind/pagefind-entry.json exists and page_count matches reports
#   5. feed.xml ends with </rss>
#   6. sitemap.xml ends with </urlset>

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

fail() { echo "VERIFY FAILED: $1" >&2; exit 1; }
pass() { echo "  ok  $1"; }

echo "verify-site: starting integrity check in $ROOT"

# 1. index.html closing tags
[ -f index.html ] || fail "index.html missing"
tail -c 200 index.html | grep -q '</html>' || fail "index.html does not end with </html> (truncated?)"
pass "index.html ends with </html>"

# 2. index.html references search.js
grep -q '<script src="/search.js"' index.html || fail "index.html missing <script src=\"/search.js\">"
pass "index.html references /search.js"

# 3. search.js exists and parses as JS
[ -f search.js ] || fail "search.js missing"
if command -v node >/dev/null 2>&1; then
  node -e "new Function(require('fs').readFileSync('search.js','utf8'))" \
    || fail "search.js does not parse as JS"
  pass "search.js parses as JS"
else
  pass "search.js exists (node not available, skipping parse check)"
fi

# 4. pagefind index
[ -f pagefind/pagefind-entry.json ] || fail "pagefind/pagefind-entry.json missing"
PAGES=$(python3 -c "import json; d=json.load(open('pagefind/pagefind-entry.json')); print(list(d['languages'].values())[0]['page_count'])")
REPORTS=$(ls reports/claude-ai-daily-*.html 2>/dev/null | wc -l)
EXPECTED=$REPORTS
if [ "$PAGES" -lt "$EXPECTED" ]; then
  fail "pagefind index has $PAGES pages but expected at least $EXPECTED (run: bash scripts/build-pagefind.sh)"
fi
pass "pagefind index has $PAGES pages (>=$EXPECTED expected)"

# 5. feed.xml
[ -f feed.xml ] || fail "feed.xml missing"
tail -c 100 feed.xml | grep -q '</rss>' || fail "feed.xml does not end with </rss>"
pass "feed.xml ends with </rss>"

# 6. sitemap.xml
[ -f sitemap.xml ] || fail "sitemap.xml missing"
tail -c 100 sitemap.xml | grep -q '</urlset>' || fail "sitemap.xml does not end with </urlset>"
pass "sitemap.xml ends with </urlset>"

echo "verify-site: ALL CHECKS PASSED"
