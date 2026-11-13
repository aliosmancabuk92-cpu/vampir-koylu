#!/bin/sh
# Vampir Köylü — web paketini üret (www/)
set -e
cd "$(dirname "$0")"
rm -rf www/chunks
npx esbuild solo=src/solo-ui.js multi=src/multi.js --bundle --format=esm --splitting --minify --outdir=www --chunk-names=chunks/[name]-[hash] --log-level=warning
[ -f www/supabase.js ] || npx esbuild src/sb-entry.js --bundle --format=esm --minify --outfile=www/supabase.js
cp index.html www/index.html
ls -la www/*.js www/chunks | head -20
