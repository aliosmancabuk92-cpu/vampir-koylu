/* =====================================================================
   SESLENDİRME OYNATICI — önceden kaydedilmiş replikler (Piper TTS)
   Her karakter tipine farklı ses rengi: hız/perde, bas-tiz, hafif yankı.
   Kayıt bulunamazsa cihazın Türkçe sesine (speechSynthesis) düşer.
   ===================================================================== */
import { audioCtx, audioOut } from './sfx.js';
import { voiceKey } from './voice-key.js';

const BASE='./assets/voice/';
let manifest=null, manP=null; const buffers=new Map(), loading=new Map();
export function loadVoices(){ if(!manP) manP=fetch(BASE+'index.json').then(r=>r.ok?r.json():{}).then(j=>(manifest=j)).catch(()=>(manifest={})); return manP; }
function clip(key){
  if(buffers.has(key)) return Promise.resolve(buffers.get(key));
  if(loading.has(key)) return loading.get(key);
  const ctx=audioCtx(); if(!ctx) return Promise.resolve(null);
  const p=fetch(BASE+key+'.mp3').then(r=>{ if(!r.ok) throw 0; return r.arrayBuffer(); })
    .then(ab=>new Promise((res,rej)=>ctx.decodeAudioData(ab,res,rej)))
    .then(b=>{ buffers.set(key,b); loading.delete(key); if(buffers.size>120){ buffers.delete(buffers.keys().next().value); } return b; })
    .catch(()=>{ loading.delete(key); return null; });
  loading.set(key,p); return p;
}
/** Sıradaki repliklerin seslerini önceden indir */
const isFem=(e)=>e.t==='say' && /^kadin/.test(e.arch||'');
const pathOf=(e,k)=>(isFem(e)?'f/':'')+k;
export function prefetchLines(events){ if(!manifest) return; let n=0; for(const e of events){ if(e.t!=='say'&&e.t!=='narr') continue; const k=voiceKey(e.voice||e.text); if(manifest[k]) clip(pathOf(e,k)); if(++n>=6) break; } }

/* karakter ses renkleri */
const FX={
  narr:     { rate:.97, low:3,  high:-1, rev:.30 },
  muhtar:   { rate:.96, low:3,  high:0,  rev:.12 },
  dayioglu: { rate:1.0, low:1,  high:0,  rev:.12 },
  emmi:     { rate:.95, low:1,  high:-1, rev:.14 },
  delikanli:{ rate:1.05,low:-1, high:2,  rev:.10 },
  memis:    { rate:.97, low:2,  high:0,  rev:.12 },
  dede:     { rate:.92, low:1,  high:-2, rev:.16 },
  coban:    { rate:1.03,low:0,  high:1,  rev:.14 },
  bakkal:   { rate:.95, low:2,  high:0,  rev:.12 },
  kahveci:  { rate:1.0, low:1,  high:1,  rev:.12 },
  bekci:    { rate:.96, low:3,  high:-1, rev:.14 },
  demirci:  { rate:.92, low:5,  high:-1, rev:.12 },
  deli:     { rate:1.08,low:-1, high:3,  rev:.10 },
  player:   { rate:1.02,low:1,  high:0,  rev:.10 },
  kadin1:   { rate:1.0, low:-2, high:1,  rev:.12 },
  kadin2:   { rate:1.04,low:-2, high:2,  rev:.12 },
  kadin3:   { rate:.94, low:-1, high:0,  rev:.14 },
};
let rev=null, revIn=null;
function reverb(ctx){ if(rev) return revIn; const len=Math.floor(ctx.sampleRate*0.9); const ir=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let c=0;c<2;c++){ const d=ir.getChannelData(c); for(let i=0;i<len;i++){ const t=i/len; d[i]=(Math.random()*2-1)*Math.pow(1-t,3.2)*(i<ctx.sampleRate*0.012?0:1); } }
  rev=ctx.createConvolver(); rev.buffer=ir; revIn=ctx.createGain(); revIn.connect(rev); rev.connect(audioOut()); return revIn; }

/* kaydın başındaki / sonundaki sessizliği bul (akıcı geçiş için) */
const trims=new WeakMap();
function trimInfo(b){ let r=trims.get(b); if(r) return r; const d=b.getChannelData(0), n=d.length, th=0.018; let a=0, z=n-1;
  while(a<n && Math.abs(d[a])<th) a++; while(z>a && Math.abs(d[z])<th) z--;
  r={ lead:Math.max(0,a/b.sampleRate-0.025), dur:Math.max(0.2,(z-a)/b.sampleRate+0.05) }; trims.set(b,r); return r; }
function estimate(t){ const n=String(t||'').replace(/[….!?,]/g,'').trim().length; return Math.min(6000, 700+n*60); }

/**
 * Yönetmenin konuşturma işlevi. voice: { on }  (kapalıysa sessizce bekler)
 * speak(e, { skipping, wait, hold })
 */
export function createSpeaker(voice){
  loadVoices();
  return async function speak(e, { skipping, wait, hold }){
    const text=e.voice||e.text||''; if(skipping()) return;
    if(!text.replace(/[….\s]/g,'')) return wait(650);
    if(!voice?.on) return wait(estimate(e.text));
    await loadVoices();
    const key=voiceKey(text);
    const ctx=audioCtx();
    if(!manifest[key] || !ctx) return deviceTTS(e,text,{ skipping, wait, hold });
    const buf=await Promise.race([clip(pathOf(e,key)), new Promise(r=>setTimeout(()=>r(null),3000))]);
    if(skipping()) return;
    if(!buf) return deviceTTS(e,text,{ skipping, wait, hold });
    const fx=FX[e.t==='narr'?'narr':(e.arch||'player')]||FX.player; const scream=e.kind==='scream';
    const src=ctx.createBufferSource(); src.buffer=buf; src.playbackRate.value=fx.rate*(scream?1.04:1)*(0.99+Math.random()*0.02);
    const lo=ctx.createBiquadFilter(); lo.type='lowshelf'; lo.frequency.value=220; lo.gain.value=fx.low;
    const hi=ctx.createBiquadFilter(); hi.type='highshelf'; hi.frequency.value=3200; hi.gain.value=fx.high;
    const g=ctx.createGain(); g.gain.value=scream?1.0:0.95; const wet=ctx.createGain(); wet.gain.value=fx.rev;
    src.connect(lo); lo.connect(hi); hi.connect(g); g.connect(audioOut()); hi.connect(wet); wet.connect(reverb(ctx));
    const tr=trimInfo(buf); const rate=src.playbackRate.value;
    return new Promise(res=>{ let done=false, ended=false; let release=()=>{};
      // söz, konuşma bitince (sondaki sessizliği beklemeden) çözülür; ses kendi bitince temizlenir
      const cleanup=()=>{ if(ended) return; ended=true; try{ src.disconnect(); wet.disconnect(); }catch(_){} };
      const fin=(cut)=>{ if(done) return; done=true; clearTimeout(t); release(); if(cut===true){ try{ src.stop(); }catch(_){} setTimeout(cleanup,300); } res(); };
      release=hold?hold(()=>fin(true)):()=>{}; src.onended=()=>{ fin(); setTimeout(cleanup,300); };
      const t=setTimeout(()=>fin(), Math.max(250,(tr.dur/rate)*1000-60));
      setTimeout(cleanup, (buf.duration/rate)*1000+800);
      try{ src.start(0,tr.lead); }catch(_){ fin(true); } });
  };
}
function deviceTTS(e,text,{ skipping, wait, hold }){
  if(!('speechSynthesis' in window)) return wait(estimate(text));
  return new Promise(res=>{ let fin=false; let release=()=>{}; const done=()=>{ if(fin) return; fin=true; clearTimeout(t); release(); try{ speechSynthesis.cancel(); }catch(_){} res(); };
    try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='tr-TR'; const v=speechSynthesis.getVoices().find(v=>v.lang&&v.lang.toLowerCase().startsWith('tr')); if(v) u.voice=v;
      if(e.kind==='scream'){ u.pitch=2; u.rate=1.25; } else if(e.t==='narr'){ u.pitch=.8; u.rate=.95; } else { u.pitch=Math.max(.1,Math.min(2,e.pitch||1)); u.rate=1.02; }
      u.onend=done; u.onerror=done; speechSynthesis.speak(u); }catch(_){ }
    release=hold?hold(done):()=>{}; const t=setTimeout(done,1600+text.length*95); });
}
