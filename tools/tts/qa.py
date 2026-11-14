"""Seslendirme denetimi: Whisper ile yazıya dök, metinle karşılaştır (CER). python qa.py lines.json out [rapor.json]"""
import json, sys, os, re, unicodedata
from faster_whisper import WhisperModel
L=json.load(open(sys.argv[1])); D=sys.argv[2]; rep=sys.argv[3] if len(sys.argv)>3 else 'qa.json'
old=json.load(open(rep)) if os.path.exists(rep) else {}
m=WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=2)
def norm(t): t=t.replace('I','ı').replace('İ','i').lower(); t=unicodedata.normalize('NFC',t); return re.sub(r'[^a-zçğıöşüâîû ]','',t).replace('  ',' ').strip()
def cer(a,b):
    a,b=a.replace(' ',''),b.replace(' ','')
    if not a: return 1.0
    d=list(range(len(b)+1))
    for i,ca in enumerate(a,1):
        p=d[:]; d[0]=i
        for j,cb in enumerate(b,1): d[j]=min(p[j]+1,d[j-1]+1,p[j-1]+(ca!=cb))
    return d[-1]/len(a)
for k,t in L.items():
    f=f'{D}/{k}.wav'
    if not os.path.exists(f): continue
    mt=os.path.getmtime(f)
    if k in old and old[k].get('mt')==mt: continue
    if re.fullmatch(r"[A-ZÇĞİÖŞÜ!?…. ]+",t): old[k]={'mt':mt,'cer':0,'asr':'(çığlık)'}; continue
    segs,_=m.transcribe(f,language='tr',beam_size=1); s=' '.join(x.text for x in segs)
    old[k]={'mt':mt,'cer':round(cer(norm(t),norm(s)),3),'asr':s.strip()}
    json.dump(old,open(rep,'w'),ensure_ascii=False)
bad=sorted([(v['cer'],k) for k,v in old.items() if v['cer']>0.3],reverse=True)
print('denetlenen',len(old),'kötü',len(bad)); [print(c,k,L.get(k),'|',old[k]['asr']) for c,k in bad[:30]]
