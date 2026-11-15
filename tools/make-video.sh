#!/bin/bash
# Yeni sahnelerin sesli tanıtım videosu: her sahne ayrı çekilir, sonra birleştirilir.
# Kullanım: ./mkvideo.sh  (çıktı: /home/claude/VampirKoylu-senlik-sahneleri.mp4)
set -e
cd /home/claude/vampir-koylu
npx esbuild test/w3d/scene.js --bundle --format=iife --outfile=test/w3d/scene-bundle.js --log-level=error --loader:.json=json
FPS=12; W=406; H=720
LIST=""
# ad:saniye:başlangıç (başlangıçtan önceki kısım çekilmez, ses de oradan kesilir)
for spec in "door_fail:52:0" "exec_vamp:146:17" "chase:70:0" "party:46:0"; do
  IFS=: read n secs st <<< "$spec"; out=/tmp/vid_$n; len=$((secs-st))
  if [ ! -s /tmp/vid_$n.mp4 ]; then
    START=$st timeout 7000 node test/w3d/cap.mjs "scene.html?q=medium&maxdt=0.25&audio=1&alen=$((secs+4))" "$(cat /tmp/ev/$n.js)" $secs $FPS $out $W $H 2>&1 | grep -v "404\|CONSOLE error $" | tail -3
    ffmpeg -y -loglevel error -framerate $FPS -i $out/f%05d.jpg -ss $st -i $out/audio.wav -map 0:v -map 1:a -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 128k -af "afade=t=in:d=0.4,afade=t=out:st=$((len-1)):d=1" -vf "fade=t=in:d=0.4,fade=t=out:st=$((len-1)):d=1" -shortest /tmp/vid_$n.mp4
    rm -rf $out
  fi
  LIST="$LIST$(printf "file '/tmp/vid_%s.mp4'" $n)"$'\n'
done
printf "%s" "$LIST" > /tmp/vid_list.txt
# farklı kare hızlı klipler: concat süzgeciyle birleştir (concat demuxer görüntüyü kısaltıyor)
IN=""; FC=""; i=0; for n in door_fail exec_vamp chase party; do IN="$IN -i /tmp/vid_$n.mp4"; FC="$FC[$i:v]fps=15,setsar=1[v$i];"; i=$((i+1)); done
ffmpeg -y -loglevel error $IN -filter_complex "${FC}[v0][0:a][v1][1:a][v2][2:a][v3][3:a]concat=n=4:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart /home/claude/VampirKoylu-senlik-sahneleri.mp4
ls -la /home/claude/VampirKoylu-senlik-sahneleri.mp4
