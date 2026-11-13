#!/bin/sh
# Erkek kayıtlardan kadın sesi türet: önce formant+perde ×1.17, sonra yalnız perde ×1.38 (toplam ≈1.6)
cd "$(dirname "$0")/../www/assets/voice" && mkdir -p f
for f in *.mp3; do
  [ -f "f/$f" ] && [ "$1" != "--force" ] && continue
  ffmpeg -y -loglevel error -i "$f" -af "rubberband=pitch=1.17:formant=shifted,rubberband=pitch=1.38:formant=preserved:tempo=1.03,highshelf=f=3500:g=2,loudnorm=I=-16:TP=-1.5" -ac 1 -ar 22050 -b:a 40k "f/$f"
done
for f in f/*.mp3; do b=$(basename "$f"); [ -f "$b" ] || rm -f "$f"; done
ls f | wc -l; du -sh f
