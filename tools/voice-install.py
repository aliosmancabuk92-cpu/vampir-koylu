#!/usr/bin/env python3
"""Chatterbox çıktılarını (wav) oyuna kur: www/assets/voice/<anahtar>.mp3 + index.json (ms).
Yeni kaydı olmayan replik eski kaydıyla kalır. Değişen kayıtların kadın sürümü silinir (voice-female.sh yeniden üretir)."""
import json, os, subprocess, sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=sys.argv[1] if len(sys.argv)>1 else '/home/claude/tts/out'
OUT=os.path.join(ROOT,'www','assets','voice'); os.makedirs(OUT,exist_ok=True)
lines=json.load(open(os.path.join(ROOT,'tools','voice-lines.json'),encoding='utf-8'))
idx_path=os.path.join(OUT,'index.json'); idx=json.load(open(idx_path)) if os.path.exists(idx_path) else {}
done=json.load(open(os.path.join(OUT,'.cb.json'))) if os.path.exists(os.path.join(OUT,'.cb.json')) else {}
AF="highpass=f=70,lowpass=f=10000,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.06,areverse,loudnorm=I=-16:TP=-1.5:LRA=11"
made=0
for key in lines:
    wav=os.path.join(SRC,key+'.wav'); mp3=os.path.join(OUT,key+'.mp3')
    if not os.path.exists(wav): continue
    st=os.path.getmtime(wav)
    if done.get(key)==st and os.path.exists(mp3): continue
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',wav,'-af',AF,'-ac','1','-ar','24000','-b:a','48k',mp3],check=True)
    dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',mp3],capture_output=True,text=True).stdout.strip() or 0)
    idx[key]=round(dur*1000); done[key]=st; made+=1
    fem=os.path.join(OUT,'f',key+'.mp3')
    if os.path.exists(fem): os.unlink(fem)
for f in os.listdir(OUT):
    if f.endswith('.mp3') and f[:-4] not in lines: os.unlink(os.path.join(OUT,f)); idx.pop(f[:-4],None)
json.dump(idx,open(idx_path,'w'),separators=(',',':')); json.dump(done,open(os.path.join(OUT,'.cb.json'),'w'))
print(f'kurulan: {made} | toplam: {len(idx)} | yeni sesli: {sum(1 for k in lines if k in done)}/{len(lines)}')
