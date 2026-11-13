/* =====================================================================
   3B SAHNE KATMANI — uygulama boyunca tek bir 3B dünya (WebGL bağlamı)
   Oyun ekranında arka planda görünür; arayüz üstünde yarı saydam durur.
   ===================================================================== */
import { createWorld, detectQuality, QUALITY, WORLD_CSS } from './world/world.js';
import { loadPeople } from './world/people.js';
import { createDirector } from './world/director.js';

const BASE='./assets/3d/';
let host=null, worldP=null, world=null, prog=0; const progL=new Set();
const setProg=(p)=>{ prog=Math.max(prog,p); for(const f of progL) f(prog); };

export const STAGE_CSS = WORLD_CSS + `
#stage3d{position:fixed;inset:0;z-index:0;display:none;background:#05060c}
#stage3d.on{display:block}
body.in3d{background:#05060c}
body.in3d .moon{display:none}
body.in3d #app{position:relative;z-index:1;pointer-events:none;padding:0;max-width:none}
body.in3d #app .g3d>*{pointer-events:auto}
.g3d{position:fixed;inset:0;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top) + 10px) 10px calc(env(safe-area-inset-bottom) + 10px);pointer-events:none!important}
.g3d .topbar{margin:0 auto 6px;width:100%;max-width:520px}
.g3d .topbar .pill,.g3d .topbar button{background:rgba(12,10,18,.55);border-color:rgba(255,220,160,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.g3d .spacer{flex:1;pointer-events:none!important}
.g3d .subs{max-width:560px;width:100%;margin:0 auto 8px;text-align:center;pointer-events:none!important;min-height:44px;display:flex;flex-direction:column;justify-content:flex-end}
.g3d .subs .who{font:800 13px 'Nunito',sans-serif;color:#ffd58a;text-shadow:0 1px 3px #000,0 0 12px #000;letter-spacing:.3px}
.g3d .subs .who .tt{color:#e8d8b8;opacity:.8}
.g3d .subs .tx{font:700 17px/1.35 'Nunito',sans-serif;color:#fff;text-shadow:0 2px 4px #000,0 0 14px rgba(0,0,0,.9);padding:2px 6px}
.g3d .subs .tx.narr{color:#ffe2a6;font-style:italic}
.g3d .subs .tx.scream{color:#ff6a6a;font-size:22px;font-weight:900;letter-spacing:1px}
.g3d .subs .prev{font:600 12px/1.3 'Nunito',sans-serif;color:rgba(255,255,255,.55);text-shadow:0 1px 3px #000;margin-bottom:2px}
.g3d #gPanel{max-width:520px;width:100%;margin:0 auto}
.g3d .card{background:rgba(16,13,24,.78);border-color:rgba(255,220,160,.14);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);margin-bottom:0}
.g3d .rolecard{background:radial-gradient(ellipse at top,rgba(42,36,64,.92),rgba(21,19,31,.9) 70%)}
.g3d .banner{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.g3d .sheet-scroll{max-height:62vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:18px}
.g3d .skipf{display:flex;justify-content:flex-end}
.g3d .skipf button{background:rgba(12,10,18,.6);border:1px solid rgba(255,220,160,.25);color:#f4ead6;border-radius:999px;padding:10px 16px;font:800 14px 'Nunito',sans-serif;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.load3d{position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at 50% 30%,#1c1530,#05060c 70%);pointer-events:auto!important;transition:opacity .6s}
.load3d.out{opacity:0;pointer-events:none!important}
.load3d .t{font-family:'Cinzel',serif;font-size:22px;color:#d9a441;letter-spacing:1px}
.load3d .s{color:#9b94b3;font-size:13px;font-weight:700}
.load3d .bar{width:min(70vw,320px);height:6px;border-radius:999px;background:#1d1a2b;overflow:hidden}
.load3d .bar div{height:100%;width:0;background:linear-gradient(90deg,#c0202e,#d9a441);transition:width .3s}
`;

export { QUALITY };
export { loadingHTML } from './stage-prefs.js';

function ensureHost(){
  if(host) return host;
  const st=document.createElement('style'); st.textContent=STAGE_CSS; document.head.appendChild(st);
  host=document.createElement('div'); host.id='stage3d'; document.body.prepend(host);
  return host;
}
/** Dünyayı (bir kez) yükle; ilerleme 0..1 */
export function ensureStage(onProgress){
  ensureHost(); if(onProgress){ progL.add(onProgress); onProgress(prog); }
  if(!worldP){
    worldP=(async()=>{
      const w=await createWorld(host,{ base:BASE, quality:detectQuality(), onProgress:(p)=>setProg(p*0.55) });
      await loadPeople(BASE,(p)=>setProg(0.55+p*0.43));
      world=w; setProg(1); return w;
    })();
    worldP.catch(()=>{ worldP=null; });
  }
  return worldP.finally(()=>{ if(onProgress) progL.delete(onProgress); });
}
export function showStage(on){ ensureHost(); host.classList.toggle('on',!!on); document.body.classList.toggle('in3d',!!on); if(world){ world.pause(!on); if(on) world.resize(); } }
export async function newDirector(players, opts){ const w=await ensureStage(); const d=createDirector(w,{ players, ...opts }); try{ await d.ready; }catch(e){} return d; }
