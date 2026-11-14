#!/bin/bash
# parça parça seslendirme: /tmp/tts_pause varsa yeni parça başlatma; /tmp/tts_busy parça sürerken var
cd /home/claude/tts; . venv/bin/activate
LIST=${1:-/home/claude/vampir-koylu/tools/voice-lines.json}; OUT=${2:-out}; REF=${3:-ref_villager.wav}
while true; do
  left=$(python - "$LIST" "$OUT" <<'PY'
import json,os,sys
L=json.load(open(sys.argv[1])); print(sum(1 for k in L if not os.path.exists(f'{sys.argv[2]}/{k}.wav')))
PY
)
  [ "$left" = "0" ] && { echo "BITTI"; rm -f /tmp/tts_busy; exit 0; }
  while [ -f /tmp/tts_pause ]; do sleep 5; done
  touch /tmp/tts_busy
  LIMIT=10 nice -n 15 python gen_batch.py "$LIST" "$OUT" "$REF" 2>&1 | grep -E "^[0-9]+ [0-9a-f]+ " >> gen2.log
  rm -f /tmp/tts_busy
  echo "parça bitti, kalan $left" >> gen2.log
done
