#!/usr/bin/env python3
"""Piper (tr_TR-dfki-medium) ile tüm replikleri önceden seslendir → www/assets/voice/<anahtar>.mp3 + index.json"""
import json, os, re, subprocess, sys, tempfile, wave
from piper import PiperVoice, SynthesisConfig
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL='/home/claude/voice/tr_TR-dfki-medium.onnx'
OUT=os.path.join(ROOT,'www','assets','voice'); os.makedirs(OUT,exist_ok=True)
lines=json.load(open(os.path.join(ROOT,'tools','voice-lines.json'),encoding='utf-8'))
idx_path=os.path.join(OUT,'index.json'); idx=json.load(open(idx_path)) if os.path.exists(idx_path) else {}
voice=PiperVoice.load(MODEL)
def tr_lower(w): return w.replace('I','ı').replace('İ','i').lower()
def prep(t):
    t=t.replace('…',', ').replace('...',', ')
    t=re.sub(r"\b([A-ZÇĞİÖŞÜ]{2,})\b", lambda m: tr_lower(m.group(1)), t)   # BÜYÜK harfli kelimeleri hecelemesin
    t=re.sub(r'\s+',' ',t).strip(' ,')
    return t
def is_scream(t): return bool(re.fullmatch(r"[A-ZÇĞİÖŞÜ!?…. ]{2,}",t.strip())) and len(t.strip())<16
force='--force' in sys.argv; made=0
for key,text in lines.items():
    mp3=os.path.join(OUT,key+'.mp3')
    if os.path.exists(mp3) and key in idx and not force: continue
    scream=is_scream(text)
    cfg=SynthesisConfig(length_scale=1.25 if scream else 0.96, noise_scale=0.9 if scream else 0.72, noise_w_scale=1.0 if scream else 0.9)
    with tempfile.NamedTemporaryFile(suffix='.wav',delete=False) as tf: wav=tf.name
    with wave.open(wav,'wb') as wf: voice.synthesize_wav(prep(text), wf, syn_config=cfg)
    af="highpass=f=75,lowpass=f=9000,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,loudnorm=I=-16:TP=-1.5:LRA=11"
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',wav,'-af',af,'-ac','1','-ar','22050','-b:a','40k',mp3],check=True)
    dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',mp3],capture_output=True,text=True).stdout.strip() or 0)
    idx[key]=round(dur*1000); os.unlink(wav); made+=1
    if made%25==0: print('…',made,flush=True)
# kullanılmayanları temizle
for f in os.listdir(OUT):
    if f.endswith('.mp3') and f[:-4] not in lines: os.unlink(os.path.join(OUT,f)); idx.pop(f[:-4],None)
json.dump(idx,open(idx_path,'w'),separators=(',',':'))
tot=sum(os.path.getsize(os.path.join(OUT,f)) for f in os.listdir(OUT))
print(f'üretilen: {made} | toplam ses: {len(idx)} | boyut: {tot/1e6:.2f} MB | süre: {sum(idx.values())/1000:.0f} sn')
