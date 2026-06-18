#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_file() {
  [[ -f "$1" ]] || fail "missing public file: $1"
}

tracked_files() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git ls-files
  else
    find . -type f | sed 's#^\./##'
  fi
}

PUBLIC_FILES=(
  "index.html"
  "manifest.webmanifest"
  "sw.js"
  ".nojekyll"
  ".gitignore"
  "README.md"
  "assets/app.js"
  "assets/styles.css"
  "assets/icon.svg"
  "scripts/check_public_files.sh"
)

for file in "${PUBLIC_FILES[@]}"; do
  require_file "$file"
done

TRACKED="$(tracked_files)"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  forbidden_patterns=(
    '^data/'
    '^source_pdfs/'
    '^work/'
    '^handoff/'
    '^PRIVATE_NOTES\.md$'
    'app_seed_v1\.json$'
    'app_seed_v2\.json$'
    '\.pdf$'
    '\.png$'
    '\.jpg$'
    '\.jpeg$'
    '\.txt$'
    'review'
    'report'
    'ocr'
  )

  for pattern in "${forbidden_patterns[@]}"; do
    if printf '%s\n' "$TRACKED" | grep -Eiq "$pattern"; then
      printf '%s\n' "$TRACKED" | grep -Ei "$pattern" >&2
      fail "forbidden tracked file matched: $pattern"
    fi
  done
fi

readme_forbidden=(
  'アジャスター'
  '損害保険協会'
  '問題集'
  'app_seed_v'
  '947'
  '2057'
  '原文DB'
  'OCR'
  'PDF'
  'source_pdfs'
  'handoff'
)

for word in "${readme_forbidden[@]}"; do
  if grep -Fq "$word" README.md; then
    fail "README contains forbidden word: $word"
  fi
done

if grep -Eq 'data/app_seed|app_seed_v[12]\.json' sw.js; then
  fail "Service Worker must not reference seed JSON"
fi

if grep -Eq 'data/app_seed' index.html; then
  fail "index.html should not reference bundled seed paths"
fi

if grep -Eq 'data/app_seed/app_seed_v2\.json' assets/app.js; then
  if ! grep -q 'isDevSeedFetchEnabled' assets/app.js; then
    fail "app.js seed fetch path exists without dev gate"
  fi
fi

echo "public file check passed"
