#!/bin/bash
# kalabalık sesleri: aynı sesin farklı perde/gecikme kopyaları + yankı
cd /home/claude/tts; OUT=/home/claude/vampir-koylu/www/assets/sfx; mkdir -p $OUT
crowd(){ # ad çıktı_süre girişler...
  name=$1; dur=$2; shift 2; args=(); fil=""; i=0
  for spec in "$@"; do IFS=: read f d p v <<< "$spec"; args+=(-i special/$f.wav)
    fil+="[$i:a]aresample=44100,rubberband=pitch=$p,adelay=$((d))|$((d)),volume=$v[a$i];"; i=$((i+1)); done
  mixin=""; for ((j=0;j<i;j++)); do mixin+="[a$j]"; done
  ffmpeg -v error -y "${args[@]}" -filter_complex "${fil}${mixin}amix=inputs=$i:normalize=0,aecho=0.8:0.6:45|75:0.22|0.15,highpass=f=120,loudnorm=I=-17:TP=-2,atrim=0:$dur,afade=t=out:st=$(echo "$dur-0.5"|bc):d=0.5" -ac 2 -b:a 96k $OUT/$name.mp3
}
crowd laugh 3.0 laugh1:0:1.0:1.0 laugh2:140:0.88:0.8 laugh3:260:1.12:0.7 laugh4:420:0.94:0.7 laugh1:600:1.2:0.45 laugh2:330:1.05:0.5
crowd gasp 1.6 gasp1:0:1.0:1.0 gasp2:90:0.9:0.8 gasp3:160:1.15:0.7 gasp1:240:1.22:0.5 gasp2:300:0.82:0.6
crowd cheer 3.0 cheer1:0:1.0:1.0 cheer2:150:0.9:0.85 cheer3:300:1.12:0.75 cheer4:450:0.95:0.7 cheer1:620:1.18:0.5 cheer3:800:0.86:0.5
ls -la $OUT
