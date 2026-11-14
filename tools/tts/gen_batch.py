import json, os, re, sys, time, torch, torchaudio
torch.set_num_threads(2)
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
lines = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]; ref = sys.argv[3]
os.makedirs(out, exist_ok=True)
m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
def tr_lower(w): return w.replace('I','ı').replace('İ','i').lower()
def prep(t):
    t = t.replace('…', '...')
    t = re.sub(r"\b([A-ZÇĞİÖŞÜ]{2,})\b", lambda mm: tr_lower(mm.group(1)).capitalize(), t)
    return re.sub(r'\s+', ' ', t).strip()
def is_scream(t): return bool(re.fullmatch(r"[A-ZÇĞİÖŞÜa-zçğıöşü!?…. ]{2,}", t.strip())) and len(set(t.lower()) - set('!?…. ')) <= 3
todo = [(k, v) for k, v in lines.items() if not os.path.exists(f'{out}/{k}.wav')]
LIM = int(os.environ.get('LIMIT', '0') or 0)
if LIM: todo = todo[:LIM]
print('todo', len(todo), flush=True); t0 = time.time()
for i, (k, text) in enumerate(todo):
    sc = is_scream(text); ex = 1.0 if sc else (0.7 if '!' in text else 0.55)
    torch.manual_seed(abs(hash(k)) % 100000)
    w = m.generate(prep(text), language_id='tr', audio_prompt_path=ref, exaggeration=ex, cfg_weight=0.5, temperature=0.8)
    torchaudio.save(f'{out}/{k}.wav', w, m.sr)
    print(i, k, round(w.shape[-1]/m.sr, 2), 's', round(time.time()-t0), flush=True)
