#!/bin/sh
# www/ içeriğini GitHub Pages (gh-pages dalı) olarak yayınla
set -e
cd "$(dirname "$0")"
MSG="${1:-Web sürümü güncellendi}"
rm -rf /tmp/ghp && mkdir -p /tmp/ghp && cd /tmp/ghp
git init -q && git remote add origin "$(git -C /home/claude/vampir-koylu remote get-url origin)"
git fetch -q --depth 1 origin gh-pages && git checkout -q -b gh-pages FETCH_HEAD
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r /home/claude/vampir-koylu/www/. . && touch .nojekyll
git add -A
git -c user.name="aliosmancabuk92-cpu" -c user.email="aliosmancabuk92@gmail.com" commit -q -m "$MSG

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FaTXvFZkKiEmEzExXggfXB" || echo "değişiklik yok"
git push -q origin gh-pages
echo "yayında: https://aliosmancabuk92-cpu.github.io/vampir-koylu/"
