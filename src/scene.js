/* =====================================================================
   SAHNE OYNATICI — motor olaylarını köy üzerinde sırayla canlandırır
   Hem tek oyunculu hem odalı mod kullanır.
   ===================================================================== */
import SFX from './sfx.js';

export function createScene({ village, voice, onLine }){
  const V=village;
  let queue=[], running=false, skipping=false, wakeUp=null, doneCbs=[];
  const state={}; // görsel kalıcı durum {id:{dead,hanged,impaled}}
  V.state=state;

  const wait=(ms)=> skipping ? Promise.resolve() : new Promise(res=>{ const t=setTimeout(()=>{ wakeUp=null; res(); },ms); wakeUp=()=>{ clearTimeout(t); wakeUp=null; res(); }; });

  function trVoice(){ if(!('speechSynthesis' in window)) return null; const vs=speechSynthesis.getVoices(); return vs.find(v=>v.lang&&v.lang.toLowerCase().startsWith('tr'))||null; }
  function speak(e){
    const text=e.text||''; const plain=text.replace(/[…]/g,'').trim();
    const est=Math.min(5200, 900+plain.length*55);
    if(skipping) return Promise.resolve();
    if(!voice.on || !('speechSynthesis' in window) || !plain || plain==='…') return wait(plain==='…'?700:est);
    return new Promise(res=>{
      let fin=false; const done=()=>{ if(fin) return; fin=true; clearTimeout(t); wakeUp=null; res(); };
      try{
        speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance(plain);
        u.lang='tr-TR'; const v=trVoice(); if(v) u.voice=v;
        if(e.kind==='scream'){ u.pitch=2; u.rate=1.25; }
        else if(e.t==='narr'){ u.pitch=.8; u.rate=.95; }
        else { u.pitch=Math.max(.1,Math.min(2,e.pitch||1)); u.rate=1.02; }
        u.onend=done; u.onerror=done;
        speechSynthesis.speak(u);
      }catch(err){ /* sessiz */ }
      const t=setTimeout(done, 1600+plain.length*95);
      wakeUp=done;
    });
  }
  function sfx(name){ if(skipping||!voice.on) return; try{ SFX[name]&&SFX[name](); }catch(e){} }

  async function apply(e){
    switch(e.t){
      case 'say': case 'narr': {
        onLine&&onLine(e);
        if(e.who && !skipping) V.bubble(e.who, e.text.length>110?e.text.slice(0,107)+'…':e.text, Math.max(1800, 900+e.text.length*60));
        await speak(e); if(!skipping) await wait(180); break; }
      case 'sfx': sfx(e.name); if(e.name==='bell'||e.name==='drum') await wait(500); break;
      case 'gather': V.gather(); await wait(1150); break;
      case 'home': V.goHome(); await wait(1150); break;
      case 'night': V.setNight(e.on); await wait(500); break;
      case 'badges': V.badges(e.counts); if(Object.keys(e.counts||{}).length) await wait(1100); break;
      case 'drag': { V.crowdToHouse(e.target, e.crowd||[]); await wait(1200); V.highlight(e.target,true); await wait(300); V.gather(); V.toSquareCenter(e.target); await wait(1200); V.highlight(null); break; }
      case 'release': V.gather(); await wait(600); break;
      case 'stool': V.stool(true); V.toStool(e.who); await wait(1150); break;
      case 'hang': {
        if(e.final){ V.toStool(e.who); await wait(skipping?0:900); }
        V.stool(false); V.drop(e.who); V.rope(e.who,true);
        await wait(600);
        if(e.vamp){ V.fangs(e.who,true); V.shake(e.who); await wait(900); }
        else { V.hangedLook(e.who); state[e.who]={hanged:true}; }
        break; }
      case 'kick': { const prev=V.pos[e.by]?[...V.pos[e.by]]:null; const [x,y]=V.pos[e.who]||[0,0]; V.moveTo(e.by, x-16, y+4); await wait(650); V.bump(e.who,6,-8); await wait(350); if(prev) V.moveTo(e.by, prev[0], prev[1]); break; }
      case 'impale': { V.rope(e.who,false); V.stool(true); V.toStake(e.who,e.k||0); await wait(1200); V.impaled(e.who); state[e.who]={impaled:true, stakeK:e.k||0}; break; }
      case 'dead': { const [x,y]=V.homePos(e.who); V.moveTo(e.who,x,y); V.dead(e.who); state[e.who]={dead:true}; await wait(700); break; }
      case 'fangs': V.fangs(e.who,true); break;
      case 'lock': break;
      case 'pause': await wait(e.ms||600); break;
    }
  }

  async function run(){
    if(running) return; running=true;
    while(queue.length){ const e=queue.shift(); try{ await apply(e); }catch(err){ console.error(err); } }
    running=false; skipping=false;
    const cbs=doneCbs; doneCbs=[]; cbs.forEach(f=>f());
  }

  return {
    play(events, done){ queue.push(...events); if(done) doneCbs.push(done); run(); },
    skip(){ if(!running) return; skipping=true; try{ speechSynthesis.cancel(); }catch(e){} V.clearBubbles(); if(wakeUp) wakeUp(); },
    get busy(){ return running; },
    /** Kalıcı durumu tek seferde uygula (yeniden bağlanma / atlama sonrası) */
    sync(vs){ Object.keys(state).forEach(k=>delete state[k]); Object.assign(state, vs); V.applyState(vs); },
    reset(){ queue=[]; skipping=false; Object.keys(state).forEach(k=>delete state[k]); },
  };
}
