import { createWorld, WORLD_CSS } from '../../src/world/world.js';
import { loadPeople } from '../../src/world/people.js';
import { createDirector } from '../../src/world/director.js';
import { SoloGame, LEVELS, makeRng } from '../../src/solo-engine.js';
const st=document.createElement('style'); st.textContent=WORLD_CSS+`html,body{margin:0;height:100%;background:#000} #v{position:fixed;inset:0}`; document.head.appendChild(st);
const P=new URLSearchParams(location.search);
window.ready=false; window.errs=[]; window.log=[];
window.addEventListener('error',e=>window.errs.push(String(e.message)));
(async()=>{ try{
  const base='/www/assets/3d/';
  const W=await createWorld(document.getElementById('v'),{ base, quality:P.get('q')||'high', debug:true, maxDt:0.6 });
  await loadPeople(base);
  const L=LEVELS.find(l=>l.id===+(P.get('lvl')||9));
  const G=new SoloGame(L,{ rng:makeRng(+(P.get('seed')||42)), humanName:'Ali', longIntro:P.get('long')==='1' });
  const sub=document.getElementById('sub');
  const D=createDirector(W,{ players:G.players, voice:{ on:false }, onLine:(e)=>{ sub.textContent=(e.name?e.name+': ':'')+e.text; window.log.push(e.t+':'+(e.name||'')+': '+e.text); },
    speak:(e,{ wait })=>wait(+(P.get('ms')||900)) });
  window.G=G; window.D=D; window.W=W;
  let cur=0;
  window.step=(code)=>new Promise(res=>{ if(code) eval(code); const evs=G.events.slice(cur); cur=G.events.length; window.lastEvs=evs.map(e=>e.t); D.play(evs,()=>{ D.sync(G.villageState()); D.setMode(G.phase==='talk'?'talk':G.phase); res(G.phase); }); });
  window.ready=true;
}catch(e){ window.errs.push(String(e&&e.stack||e)); } })();
