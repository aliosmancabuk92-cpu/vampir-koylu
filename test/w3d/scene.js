import * as THREE from 'three';
import { createWorld, WORLD_CSS } from '../../src/world/world.js';
import { loadPeople } from '../../src/world/people.js';
import { createDirector } from '../../src/world/director.js';
import { createSpeaker, loadVoices } from '../../src/voice.js';
import SFX from '../../src/sfx.js';
const st=document.createElement('style'); st.textContent=WORLD_CSS+`html,body{margin:0;height:100%;background:#000} #v{position:fixed;inset:0}
#sub{position:fixed;left:0;right:0;bottom:9%;text-align:center;z-index:9;font-family:system-ui,sans-serif;pointer-events:none;padding:0 14px}
#sub .w{font:800 13px system-ui;color:#ffd58a;text-shadow:0 1px 3px #000,0 0 10px #000} #sub .t{font:700 17px/1.32 system-ui;color:#fff;text-shadow:0 2px 4px #000,0 0 12px rgba(0,0,0,.9)} #sub .t.s{color:#ff6a6a;font-size:22px;font-weight:900} #sub .t.n{color:#ffe2a6;font-style:italic}`;
document.head.appendChild(st);
const P=new URLSearchParams(location.search);
window.ready=false; window.errs=[]; window.caplog=[];
window.addEventListener('error',e=>window.errs.push(String(e.message)));
// sesli çekim: tüm sesleri sanal zamanlı bir OfflineAudioContext'e kaydet
if(P.get('audio')==='1'){
  const SR=44100, LEN=+(P.get('alen')||90);
  const OAC=window.OfflineAudioContext; const ctx=new OAC(2,SR*LEN,SR);
  Object.defineProperty(ctx,'currentTime',{ get:()=>window.__vnow()/1000 });
  Object.defineProperty(ctx,'state',{ get:()=>'running' }); ctx.resume=()=>Promise.resolve();
  for(const C of [AudioScheduledSourceNode, AudioBufferSourceNode, OscillatorNode, ConstantSourceNode]){ const pr=C.prototype; if(!Object.prototype.hasOwnProperty.call(pr,'start') && C!==AudioScheduledSourceNode) continue;
    const st0=pr.start, sp0=pr.stop;
    pr.start=function(w,...a){ const n=window.__vnow()/1000; return st0.call(this,(w==null||w<n)?n:w,...a); };
    pr.stop=function(w){ try{ return sp0.call(this,(w==null)?window.__vnow()/1000+0.01:w); }catch(e){} }; }
  AudioNode.prototype.disconnect=function(){};   // çevrimdışı çizimde bağlantı kesilirse ses tümden kaybolur
  window.AudioContext=function(){ return ctx; }; window.webkitAudioContext=window.AudioContext; window.__actx=ctx;
  window.renderAudio=async()=>{ const buf=await ctx.startRendering(); const n=buf.length, ch=2; const out=new DataView(new ArrayBuffer(44+n*ch*2)); const ws=(o,s)=>{ for(let i=0;i<s.length;i++) out.setUint8(o+i,s.charCodeAt(i)); };
    ws(0,'RIFF'); out.setUint32(4,36+n*ch*2,true); ws(8,'WAVE'); ws(12,'fmt '); out.setUint32(16,16,true); out.setUint16(20,1,true); out.setUint16(22,ch,true); out.setUint32(24,SR,true); out.setUint32(28,SR*ch*2,true); out.setUint16(32,ch*2,true); out.setUint16(34,16,true); ws(36,'data'); out.setUint32(40,n*ch*2,true);
    const L=buf.getChannelData(0), R=buf.getChannelData(1); let o=44; for(let i=0;i<n;i++){ for(const d of [L,R]){ const v=Math.max(-1,Math.min(1,d[i])); out.setInt16(o,v*32767,true); o+=2; } }
    const u8=new Uint8Array(out.buffer); let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); };
}
const sub=document.createElement('div'); sub.id='sub'; document.body.appendChild(sub);
const esc=(s)=>String(s).replace(/[&<]/g,c=>c==='&'?'&amp;':'&lt;');
(async()=>{ try{
  const base='/www/assets/3d/';
  const W=await createWorld(document.getElementById('v'),{ base, quality:P.get('q')||'medium', debug:true, maxDt:+(P.get('maxdt')||0.05) });
  await loadPeople(base);
  const A=['player','muhtar','bekci','delikanli','dede','demirci','dayioglu','kahveci'];
  const N=['Ali','Muhtar Rıfat','Bekçi Nuri','Kerem','Dede Şükrü','Demirci Halil','Dayıoğlu Baran','Kahveci Cemal'];
  const players=A.map((a,i)=>({ id:'p'+i, name:N[i], arch:a, human:i===0, avatar:'' }));
  const voice={ on:P.get('audio')==='1' };
  if(voice.on){ SFX.set(true); SFX.unlock(); }
  const speaker=createSpeaker(voice); await loadVoices();
  const D=createDirector(W,{ players, voice, onLine:(e)=>{ const c=e.kind==='scream'?'t s':(e.t==='narr'?'t n':'t'); sub.innerHTML=(e.name?`<div class="w">${esc(e.name)}</div>`:'')+`<div class="${c}">${esc(e.text)}</div>`; window.caplog.push([window.__vnow(),e.t,e.name||'',e.text]); },
    speak:voice.on?speaker:(e,{ wait })=>wait(900+String(e.text||'').length*55) });
  await D.ready;
  // çözümleme kamerası: ?follow=p3 → karakteri yandan izle (yönetmen kamerası devre dışı)
  if(P.get('follow')){ globalThis.VK_NOCAM=true; const c=D.cast.get(P.get('follow')); const dist=+(P.get('dist')||4.2), side=+(P.get('side')||1); const v=new THREE.Vector3(), q=new THREE.Vector3();
    W.tick(()=>{ c.V.holder.getWorldPosition(v); const y=c.V.yaw; const sx=-Math.cos(y)*side, sz=Math.sin(y)*side; W.camCut(q.set(v.x+sx*dist+Math.sin(y)*0.8, 1.35, v.z+sz*dist+Math.cos(y)*0.8), v.clone().setY(Math.max(0.6,v.y+0.85)), 42); }); }
  Object.assign(window,{ W, D, THREE, players, SPK:speaker, SFX });
  window.runEvents=(evs)=>new Promise(res=>D.play(evs,res));
  window.ready=true;
}catch(e){ window.errs.push(String(e&&e.stack||e)); } })();
