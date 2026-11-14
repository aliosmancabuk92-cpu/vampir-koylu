import os, sys, torch, torchaudio
torch.set_num_threads(2)
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
m = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
os.makedirs('special', exist_ok=True)
ITEMS = [('laugh1','Ha ha ha ha ha!',0.9),('laugh2','Hahahaha haha!',0.9),('laugh3','Heh heh heh heh!',0.8),('laugh4','Ahahaha ha ha!',1.0),
         ('gasp1','Ooooo!',0.8),('gasp2','Vaaay!',0.8),('gasp3','Hıııı!',0.8),
         ('cheer1','Yaşaaa!',0.9),('cheer2','Heeey! Bravo!',0.9),('cheer3','Oleeey!',0.9),('cheer4','Hah şöyle!',0.9)]
for i,(k,t,ex) in enumerate(ITEMS):
    if os.path.exists(f'special/{k}.wav'): continue
    torch.manual_seed(100+i)
    w = m.generate(t, language_id='tr', audio_prompt_path='ref_villager.wav', exaggeration=ex, cfg_weight=0.4, temperature=0.9)
    torchaudio.save(f'special/{k}.wav', w, m.sr); print(k, round(w.shape[-1]/m.sr,2), flush=True)
