/* =====================================================================
   3B SAHNE YÖNETMENİ — motor olaylarını 3B köyde canlandırır.
   2B createScene ile aynı arayüz: play / skip / busy / sync / reset
   + köy arayüzü: highlight, setMode, setCandidates, dispose
   ===================================================================== */
import * as THREE from 'three';
import SFX from '../sfx.js';
import { createVillager, MALE_KEYS, FEMALE_KEYS, LOOKS } from './people.js';
import { LAYOUT } from './world.js';

const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const SKINS=['#e0b494','#d9a882','#c99472','#c48d66','#b98060','#d4a07c','#caa07a','#b07858'];
const CLOTHS=['#8a5a3a','#4a4a52','#5a6a3a','#d8ccb4','#3a5a8a','#8a3a30','#6a6258','#9a7a4a','#e2d8c4','#6a4a6a','#2e3e5e','#5a3a26','#7a8a5a','#a8763a','#3e5a52','#704838'];
const HATC=['#1e1c1a','#3a3228','#4a1a16','#2a2a30','#3a342c','#2a2826','#40362a'];
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createDirector(world, { players, voice, onLine, onPick, speak:speakImpl, prefetch=null, meId='me' }){
  const W=world; const { GAL, STK } = W;
  W.setupVillage(players.map(p=>({ id:p.id, name:p.name })));

  /* ---------------- oyuncu kadrosu ---------------- */
  const cast=new Map(); const used=new Map();
  players.forEach((p,i)=>{
    let key=(p.look&&LOOKS[p.look])?p.look:(p.arch&&LOOKS[p.arch])?p.arch:null;
    const sex=p.sex||p.gender; if(sex==='f' && (!key || !LOOKS[key].female)) key=FEMALE_KEYS[i%FEMALE_KEYS.length]; if(sex!=='f' && key && LOOKS[key].female) key=MALE_KEYS[i%MALE_KEYS.length];
    if(!key) key=p.human?'player':MALE_KEYS[i%MALE_KEYS.length];
    const n=used.get(key)||0; used.set(key,n+1);
    const look={}; if(n>0||p.vary){ look.cloth=CLOTHS[(i*7+3)%CLOTHS.length]; look.skin=SKINS[(i*3+1)%SKINS.length]; look.hatC=HATC[i%HATC.length]; look.h=(LOOKS[key].h||1.78)+(((i*37)%10)/10-.5)*0.06; }
    if(p.cloth) look.cloth=p.cloth;
    const V=createVillager(key,{ look }); V.hit.userData.pid=p.id; W.addActor(V);
    // boyun / leğen yüksekliği (asma ve kazık için)
    V.holder.position.set(0,0,0); V.holder.updateMatrixWorld(true); const t=V3();
    const neckH=(V.bones.get('neck_01')?.getWorldPosition(t).y)||1.5; const pelvisH=(V.bones.get('pelvis')?.getWorldPosition(t).y)||0.95;
    V.setOpacity(0);
    cast.set(p.id,{ p, id:p.id, V, house:W.houseOf(p.id), spot:null, state:'home', hangK:-1, stakeK:-1, neckH, pelvisH, alive:true });
  });
  const C=(id)=>cast.get(id)||null;
  const nameOf=(c)=>c.p.human?`${c.p.name} (sen)`:c.p.name;

  /* meydandaki halka: muhtar ortada, sen sağ uçta */
  { const list=[...cast.values()]; const n=list.length; const step=0.37; const span=Math.min(4.1,(n-1)*step);
    const slots=list.map((_,i)=>n===1?0:-span/2+span*i/(n-1)); const byCenter=[...slots].sort((a,b)=>Math.abs(a)-Math.abs(b)||a-b);
    const me=list.find(c=>c.p.human); const others=list.filter(c=>c!==me); const right=Math.max(...slots);
    const assign=(c,th)=>{ const r=LAYOUT.CROWD_R; const x=Math.sin(th)*r, z=-Math.cos(th)*r; c.spot={ x, z, th, yaw:Math.atan2(LAYOUT.ACCUSED.x-x, LAYOUT.ACCUSED.z*0.4-z) }; };
    let k=0; if(me) assign(me,right); for(const th of byCenter){ if(me && th===right) continue; const c=others[k++]; if(c) assign(c,th); } }

  /* ---------------- yardımcılar ---------------- */
  let skipping=false; const wakes=new Set();
  const wait=(ms)=> skipping?Promise.resolve():new Promise(res=>{ const w=()=>{ clearTimeout(t); wakes.delete(w); res(); }; const t=setTimeout(w,ms); wakes.add(w); });
  const race=(p,ms)=>Promise.race([p,wait(ms)]);
  /** karaktere yeni komut: eski (arka planda süren) adımları iptal eder */
  function own(c){ c.seq=(c.seq||0)+1; if(c.V.target) c.V.stop(); return c.seq; }
  function walk(c,x,z,o={}){ if(skipping){ c.V.place(x,z,o.face!=null&&typeof o.face==='number'?o.face:c.V.yaw); return Promise.resolve(); } return c.V.walkTo(x,z,o); }
  function fade(c,to,ms=400){ const ft=c.fadeTok=(c.fadeTok||0)+1; return new Promise(res=>{ if(skipping||ms<=0){ c.V.setOpacity(to); return res(); } const from=c.V.alpha; let t=0; const off=W.tick((dt)=>{ if(c.fadeTok!==ft){ off(); res(); return; } t+=dt*1000; const k=clamp(t/ms,0,1); c.V.setOpacity(from+(to-from)*k); if(k>=1){ off(); res(); } }); }); }
  function show(c){ c.fadeTok=(c.fadeTok||0)+1; c.V.setOpacity(1); c.V.holder.visible=true; }
  function tween(ms,fn){ return new Promise(res=>{ if(skipping||ms<=0){ fn(1); return res(); } let t=0; const off=W.tick((dt)=>{ t+=dt*1000; const k=clamp(t/ms,0,1); fn(k); if(k>=1){ off(); res(); } }); }); }
  const alive=()=>[...cast.values()].filter(c=>c.alive);
  const inSquare=()=>[...cast.values()].filter(c=>c.state==='square');
  const doorOut=(c,d=1.2)=>{ const h=c.house; const out=V3(-h.door.x,0,-h.door.z).normalize(); return h.door.clone().addScaledVector(out,d); };

  /* ---------------- kamera çekimleri ---------------- */
  let camLock=false, lastSpk=null, side=1;
  function cam(pos,tgt,fov=50,dur=0,shift=0.2){ W.setFrameShift(shift); if(skipping||dur<=0) W.camCut(pos,tgt,fov); else W.camMove(pos,tgt,{ dur, fov }); }
  const SH={
    establish:()=>cam(V3(0,17,31),V3(0,2,-4),55,0),
    square:(dur=1.2)=>cam(V3(0.4,2.7,11.8),V3(0,1.55,-1.2),52,dur),
    squareHigh:(dur=0)=>cam(V3(0,11.5,12.5),V3(0,0.8,-0.8),55,dur),
    face:(c,{ dist=1.7, fov=36, s=side, dur=0 }={})=>{ const h=c.V.headPos(V3()); const y=c.V.yaw; const f=V3(Math.sin(y),0,Math.cos(y)); const sd=V3(f.z,0,-f.x).multiplyScalar(s);
      cam(h.clone().addScaledVector(f,dist).addScaledVector(sd,0.55).add(V3(0,0.02,0)), h.clone().add(V3(0,-0.16,0)).addScaledVector(sd,-0.12), fov, dur, 0.06); },
    medium:(c,{ s=side, dur=0 }={})=>{ const h=c.V.headPos(V3()); const y=c.V.yaw; const f=V3(Math.sin(y),0,Math.cos(y)); const sd=V3(f.z,0,-f.x).multiplyScalar(s);
      cam(h.clone().addScaledVector(f,3.4).addScaledVector(sd,1.1).add(V3(0,-0.15,0)), h.clone().add(V3(0,-0.45,0)), 40, dur, 0.12); },
    house:(c,dur=0)=>{ const h=c.house; const out=V3(-h.door.x,0,-h.door.z).normalize(); const sd=V3(out.z,0,-out.x); cam(h.door.clone().addScaledVector(out,7.2).addScaledVector(sd,1.6).add(V3(0,2.1,0)), h.door.clone().add(V3(0,1.5,0)).addScaledVector(out,1.2), 48, dur); },
    gallows:(dur=0)=>cam(GAL.group.localToWorld(V3(3.2,2.3,6.4)), GAL.group.localToWorld(V3(0,2.35,-0.5)), 50, dur),
    gallowsK:(k,dur=0)=>{ const x=GAL.hangX[k]??0; cam(GAL.group.localToWorld(V3(x+1.5,2.5,3.1)), GAL.group.localToWorld(V3(x,2.2,GAL.z)), 44, dur); },
    stakes:(k,dur=0)=>{ const x=STK.x[k]??0; cam(STK.group.localToWorld(V3(x-0.6,2.0,4.6)), STK.group.localToWorld(V3(x,2.35,0)), 46, dur); },
    crane:(o={})=>{ if(skipping) return; W.setFrameShift(0.18); W.camOrbit({ center:V3(0,0,-1), r:W.village.R+11, h:W.village.R*1.15+6, lookY:0, speed:0.035, ...o }); },
    /** evleri tek tek gösteren dönen bakış (seçim / gece) */
    pan:(o={})=>{ if(skipping) return; W.setFrameShift(0.14); const cur=Math.atan2(W.CAM.tgt.x,-W.CAM.tgt.z); W.camPan({ R:W.village.R, h:8.5, back:3.2, lookY:1.6, speed:0.07, ang:cur, ...o }); },
  };

  /* ---------------- ses ---------------- */
  function defaultSpeak(e){
    const text=(e.text||'').replace(/[…]/g,'').trim(); const est=Math.min(5600, 900+text.length*58);
    if(skipping) return Promise.resolve();
    if(!voice?.on || !('speechSynthesis' in window) || !text) return wait(text?est:700);
    return new Promise(res=>{ let fin=false; const done=()=>{ if(fin) return; fin=true; clearTimeout(t); wakes.delete(done); res(); };
      try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.lang='tr-TR'; const v=speechSynthesis.getVoices().find(v=>v.lang&&v.lang.toLowerCase().startsWith('tr')); if(v) u.voice=v;
        if(e.kind==='scream'){ u.pitch=2; u.rate=1.25; } else if(e.t==='narr'){ u.pitch=.8; u.rate=.95; } else { u.pitch=clamp(e.pitch||1,.1,2); u.rate=1.02; }
        u.onend=done; u.onerror=done; speechSynthesis.speak(u); }catch(err){}
      const t=setTimeout(done,1600+text.length*95); wakes.add(done); });
  }
  const speak=(e)=>speakImpl?speakImpl(e,{ skipping:()=>skipping, wait, hold:(fn)=>{ wakes.add(fn); return ()=>wakes.delete(fn); } }):defaultSpeak(e);
  function sfx(n){ if(skipping||!voice?.on) return; try{ SFX[n]&&SFX[n](); }catch(e){} }

  /* ---------------- etiketler ---------------- */
  const headPos=(c)=>(v)=>{ if(!c.V.holder.visible) return null; c.V.headPos(v); v.y+=0.32; return v; };
  const housePos=(c,dy=0)=>(v)=>v.copy(c.house.pos).setY(c.house.H.height+2.2+dy);
  let candidates=null, selId=null;
  function refreshLabels(){
    W.unlabelAll('n:'); W.unlabelAll('h:');
    if(!candidates) return;
    for(const id of candidates){ const c=C(id); if(!c) continue; const sel=id===selId; const cls='nm'+(sel?' sel':'')+(c.p.human?' me':'');
      if(c.state==='square') W.label('n:'+id,`<div class="${cls}">${esc(c.p.avatar||'')} ${esc(nameOf(c))}</div>`,headPos(c));
      else if(c.house) W.label('h:'+id,`<div class="${cls}">${esc(c.p.avatar||'')} ${esc(nameOf(c))}</div>`,housePos(c)); }
  }
  function showSpeaker(c){ W.unlabel('spk'); if(!c||!c.V.holder.visible) return; W.label('spk',`<div class="spk">${esc(c.p.name)}${c.p.title?` · ${esc(c.p.title)}`:''}</div>`,(v)=>{ c.V.headPos(v); v.y+=0.42; return v; }); }

  /* ---------------- yer değiştirmeler ---------------- */
  async function toSquare(list, { fromHome=true, run=true, ms=5200 }={}){
    const ps=[];
    for(const c of list){ if(!c.alive || c.state==='hanged' || c.state==='impaled') continue;
      own(c); const sp=c.spot; if(c.state!=='square'){ const o=doorOut(c,0.2); c.V.place(o.x,o.z,Math.atan2(-o.x,-o.z)); W.openDoor(c.id,true); setTimeout(()=>W.openDoor(c.id,false),1400); fade(c,1,350); c.state='square'; }
      c.V.fixed=false; c.V.setPose(null); ps.push(walk(c,sp.x,sp.z,{ run, face:sp.yaw })); }
    await race(Promise.all(ps),ms);
    for(const c of list){ if(c.state==='square' && c.V.target){ c.V.place(c.spot.x,c.spot.z,c.spot.yaw); } }
  }
  async function toHomes(list, ms=3600){
    const ps=list.filter(c=>c.state==='square').map(async c=>{ const tok=own(c); const o=doorOut(c,0.3); await walk(c,o.x,o.z,{ run:true }); if(c.seq!==tok) return; W.openDoor(c.id,true); await walk(c,c.house.inside.x,c.house.inside.z); if(c.seq!==tok) return; await fade(c,0,300); if(c.seq!==tok) return; c.V.holder.visible=false; c.state='home'; setTimeout(()=>W.openDoor(c.id,false),500); });
    await race(Promise.all(ps),ms);
    for(const c of list){ if(c.state==='square'){ own(c); c.fadeTok++; c.V.setOpacity(0); c.V.holder.visible=false; c.state='home'; } }
  }
  function lookAllAt(c){ for(const o of [...cast.values()].filter(o=>o.state==='square'||o.state==='accused')){ if(o===c) { o.V.lookAt(null); continue; } o.V.lookAt(c?(v)=>c.V.headPos(v):null); } }

  /* ---------------- asma / kazık ---------------- */
  const pivots=[0,1,2].map(k=>{ const p=new THREE.Group(); p.position.set(GAL.hangX[k],GAL.beamY,GAL.z); GAL.group.add(p); p.add(GAL.ropes[k]); GAL.ropes[k].position.set(0,0,0); p.add(GAL.noose[k]); return { p, ax:0, az:0, vx:0, vz:0, who:null, L:1.55 }; });
  function setNoose(k,L){ const pv=pivots[k]; pv.L=L; GAL.ropes[k].scale.y=L-0.02; GAL.noose[k].position.set(0,-L-0.01,0.035); GAL.noose[k].rotation.set(Math.PI/2+0.15,0,0); }
  [0,1,2].forEach(k=>setNoose(k,1.55));
  W.tick((dt)=>{ for(const pv of pivots){ if(Math.abs(pv.ax)+Math.abs(pv.az)+Math.abs(pv.vx)+Math.abs(pv.vz)<1e-4) continue; const w2=9.8/(pv.L+1.1);
    pv.vx+=(-w2*pv.ax-0.35*pv.vx)*dt; pv.vz+=(-w2*pv.az-0.35*pv.vz)*dt; pv.ax+=pv.vx*dt; pv.az+=pv.vz*dt; pv.p.rotation.set(pv.ax,0,pv.az); } });
  const hangOrder=[];
  function freeNoose(pref=1){ for(const k of [pref,0,2,1]) if(!pivots[k].who) return k; const old=hangOrder[0]; const k=old.hangK; old.V.holder.visible=false; freeBody(old); old.state='dead'; return k; }
  function freeBody(c){ // ipten / kazıktan indir, sahneye geri koy
    const i=hangOrder.indexOf(c); if(i>=0) hangOrder.splice(i,1);
    if(c.hangK>=0){ const pv=pivots[c.hangK]; if(pv.who===c){ pv.who=null; pv.ax=pv.az=pv.vx=pv.vz=0; pv.p.rotation.set(0,0,0); setNoose(c.hangK,1.55); } c.hangK=-1; }
    if(c.V.holder.parent!==W.scene) W.scene.add(c.V.holder);
    c.V.unfreeze(); c.V.setPose(null,{ instant:true }); c.V.fixed=false; c.V.setVampire(0);
  }
  function stoolsReset(){ GAL.stools.forEach(s=>{ s.visible=false; s.rotation.set(0,0,0); }); }
  function standOnStool(c,k){
    own(c); show(c); freeBody(c); const st=GAL.stools[k]; st.visible=true; st.rotation.set(0,0,0); st.position.set(GAL.hangX[k],GAL.platformY,GAL.z);
    const w=GAL.group.localToWorld(V3(GAL.hangX[k],0,GAL.z)); c.V.holder.position.set(w.x,GAL.platformY+0.5,w.z); c.V.yaw=LAYOUT.GALLOWS.rot; c.V.holder.rotation.y=c.V.yaw; c.V.target=null;
    c.V.fixed=true; c.V.play('Idle_Loop',{ fade:.2 }); c.V.setPose('cower'); c.state='stool'; c.hangK=k;
    const neckY=GAL.platformY+0.5+c.neckH; setNoose(k, GAL.beamY-neckY+0.02); pivots[k].who=c; hangOrder.push(c);
  }
  async function drop(c,k,vamp){
    const pv=pivots[k]; const st=GAL.stools[k];
    // tabure devrilir
    tween(420,(t)=>{ st.rotation.z=1.45*t; st.position.x=GAL.hangX[k]-0.38*t; st.position.y=GAL.platformY-0.0*t; });
    // gövde ipe geçer ve düşer
    const L0=GAL.beamY-(GAL.platformY+0.5+c.neckH); const L1=L0+0.3;
    pv.p.add(c.V.holder); c.V.holder.position.set(0,-L0-c.neckH,0); c.V.holder.rotation.set(0,0,0); c.V.yaw=0;
    c.V.fixed=true; c.state='hanged';
    await tween(170,(t)=>{ const L=L0+(L1-L0)*t*t; setNoose(k,L); c.V.holder.position.y=-L-c.neckH; });
    pv.vx+=0.55; pv.vz+=(Math.random()-.5)*0.4; W.shake(0.06);
    if(vamp){ c.V.setVampire(1); c.V.play('Idle_Talking_Loop',{ fade:.2 }); c.V.setPose('hangVamp'); }
    else { W.setMourning(c.id,true); c.V.play('Zombie_Scratch',{ fade:.12 }); setTimeout(()=>{ if(c.state==='hanged'){ c.V.freeze('Idle_Loop',0.4); c.V.setPose('hang'); } }, skipping?0:1100); }
  }
  function hangInstant(c,k,vamp=false){ own(c); c.fadeTok=(c.fadeTok||0)+1; freeBody(c); const pv=pivots[k]; const L=GAL.beamY-(GAL.platformY+0.5+c.neckH)+0.3; pv.who=c; c.hangK=k; setNoose(k,L); hangOrder.push(c);
    pv.p.add(c.V.holder); c.V.holder.position.set(0,-L-c.neckH,0); c.V.holder.rotation.set(0,0,0); c.V.yaw=0; c.V.setOpacity(1); c.V.holder.visible=true; c.V.fixed=true; c.state='hanged';
    if(vamp){ c.V.setVampire(1); c.V.play('Idle_Talking_Loop'); c.V.setPose('hangVamp',{ instant:true }); } else { c.V.freeze('Idle_Loop',0.4); c.V.setPose('hang',{ instant:true }); }
    pv.ax=0.04; pv.vz=0.05; }
  function onStake(c,k,{ instant=false }={}){
    own(c); freeBody(c); const top=STK.group.localToWorld(V3(STK.x[k],STK.top,0)); c.stakeK=k; c.state='impaled'; c.V.fixed=true;
    W.setMourning(c.id,true,false); c.V.freeze('Idle_Loop',0.6); c.V.setPose('impaled',{ instant:true }); c.V.yaw=LAYOUT.STAKES.rot; c.V.holder.rotation.y=c.V.yaw; c.V.setOpacity(1); c.V.holder.visible=true;
    const y0=top.y-0.4-c.pelvisH, y1=top.y-0.95-c.pelvisH; c.V.holder.position.set(top.x,instant?y1:y0,top.z); STK.blood[k].visible=true;
    if(!instant) tween(5200,(t)=>{ c.V.holder.position.y=y0+(y1-y0)*(1-Math.pow(1-t,2)); });
  }
  /* gece baskını: kimliği belirsiz gölge kurbanın kapısına gelir */
  let shadow=null;
  function getShadow(){ if(!shadow){ const V=createVillager('golge'); W.addActor(V); V.setOpacity(0); V.holder.visible=false; shadow={ V, id:'__golge' }; } return shadow; }
  async function nightAttack(c){
    if(skipping||!c||!c.house) return; const S=getShadow(); const h=c.house; const out=V3(-h.door.x,0,-h.door.z).normalize(); const sd=V3(out.z,0,-out.x);
    cam(h.door.clone().addScaledVector(out,6.8).addScaledVector(sd,-2.4).add(V3(0,1.35,0)), h.door.clone().add(V3(0,1.45,0)).addScaledVector(sd,0.4), 46, 0, 0.12);
    W.camMove(h.door.clone().addScaledVector(out,5.2).addScaledVector(sd,-1.6).add(V3(0,1.5,0)), h.door.clone().add(V3(0,1.5,0)),{ dur:4.5, fov:44 });
    const start=h.door.clone().addScaledVector(out,4.2).addScaledVector(sd,5.5); const atDoor=h.door.clone().addScaledVector(out,0.55);
    S.V.place(start.x,start.z,Math.atan2(atDoor.x-start.x,atDoor.z-start.z)); S.V.setVampire(1); show(S); S.V.setOpacity(0); fade(S,1,600);
    await race(S.V.walkTo(atDoor.x,atDoor.z,{ speed:1.5, face:Math.atan2(-out.x,-out.z) }),4200); if(skipping) return;
    W.openDoor(c.id,true); await wait(450);
    await race(S.V.walkTo(h.inside.x,h.inside.z,{ speed:1.2 }),1600); await fade(S,0,250); S.V.holder.visible=false;
    W.openDoor(c.id,false); await wait(350); sfx('scream'); W.shake(0.1); h.H.setLights(0); await wait(1100);
  }
  function setDead(c){ own(c); c.fadeTok=(c.fadeTok||0)+1; c.alive=false; freeBody(c); c.state='dead'; c.V.holder.visible=false; c.V.setOpacity(0); W.setMourning(c.id,true); }

  /* ---------------- olaylar ---------------- */
  let busy=false, queue=[], doneCbs=[], mode=null, curPhase='night';
  function phase(n,dur=2.5){ if(curPhase===n) return; curPhase=n; W.setPhase(n,skipping?0:dur); }
  let lastGatherDay=-1;

  async function apply(e){
    switch(e.t){
      case 'say': case 'narr': {
        onLine&&onLine(e); prefetch&&prefetch(queue);
        const c=e.who?C(e.who):null; const vis=c && c.V.holder.visible && c.V.alpha>0.5;
        if(vis && !camLock && (c.state==='square'||c.state==='accused')){
          if(c!==lastSpk){ side=-side; const long=(e.text||'').length>70; (long||Math.random()<.7)?SH.face(c,{ dist:long?1.55:1.85 }):SH.medium(c); lastSpk=c; }
          lookAllAt(c);
        }
        if(vis){ c.V.setTalking(true); showSpeaker(c); }
        if(e.kind==='scream' && !skipping){ W.shake(0.12); }
        await speak(e);
        if(vis){ c.V.setTalking(false); }
        W.unlabel('spk');
        if(!skipping) await wait(160);
        break; }
      case 'sfx': sfx(e.name); if(e.name==='bell'||e.name==='drum') await wait(450);
        if(e.name==='festive' && !skipping){ camLock=true; phase('festive',2); for(const c of inSquare()){ c.V.fixed=false; c.V.lookAt(null); c.V.play('Dance_Loop',{ fade:.4, speed:0.9+Math.random()*0.2 }); c.V.fixed=true; } SH.squareHigh(3); }
        break;
      case 'gather': {
        camLock=false; lastSpk=null; W.unlabelAll('b:'); stoolsReset();
        const list=alive().filter(c=>c.state!=='square');
        const fromHome=list.length>0;
        if(!e.end && (curPhase==='night'||curPhase==='dawn'||curPhase==='dusk')) phase('day',3);
        if(fromHome){ if(!skipping){ cam(V3(0.9,1.45,16.5),V3(-0.2,2.55,0),50,0,0.06); W.camMove(V3(0.3,2.6,12.2),V3(0,1.55,-1),{ dur:6, fov:52 }); } await toSquare(list,{ run:true, ms:5200 }); }
        for(const c of alive()){ if(c.state==='accused'){ c.state='square'; await walk(c,c.spot.x,c.spot.z,{ face:c.spot.yaw }); } }
        for(const c of inSquare()){ c.V.fixed=false; c.V.setPose(null); c.V.idle(); }
        lookAllAt(null);
        if(!skipping){ SH.square(1.6); await wait(600); }
        break; }
      case 'disperse': {
        camLock=false; lookAllAt(null);
        if(!skipping){ W.camMove(V3(0,16,20),V3(0,0,-2),{ dur:3.2, fov:55 }); }
        await toHomes(inSquare());
        SH.pan();
        break; }
      case 'home': {
        camLock=false; lookAllAt(null); W.unlabelAll('l:'); W.unlabelAll('b:');
        if(curPhase==='day') phase('dusk',3);
        if(!skipping) W.camMove(V3(0,13,19),V3(0,0.5,-2),{ dur:3.4, fov:55 });
        await toHomes(inSquare());
        break; }
      case 'night': {
        if(e.on){ phase(e.end?'doom':'night',3); if(!e.end) SH.crane({ speed:0.025 }); await wait(900); }
        else if(e.end){ phase('day',3); }
        else { const dv=queue.slice(0,4).find(x=>x.t==='dead'); if(dv && !skipping){ await nightAttack(C(dv.who)); }
          phase('dawn',3); SH.establish(); if(!skipping) W.camMove(V3(0,9,20),V3(0,1,-3),{ dur:4, fov:55 }); await wait(900); }
        break; }
      case 'dead': {
        const c=C(e.who); if(!c) break; setDead(c);
        if(!skipping){ const h=c.house; const out=V3(-h.door.x,0,-h.door.z).normalize(); const sd=V3(out.z,0,-out.x);
          cam(h.door.clone().addScaledVector(out,11).addScaledVector(sd,2.2).add(V3(0,3.2,0)), h.door.clone().add(V3(0,2.2,0)),48,0,0.16);
          W.camMove(h.door.clone().addScaledVector(out,7.2).addScaledVector(sd,1.2).add(V3(0,2.2,0)), h.door.clone().add(V3(0,2.0,0)),{ dur:5, fov:46 }); }
        await wait(900); break; }
      case 'badges': {
        W.unlabelAll('b:'); const counts=e.counts||{};
        let top=null, tn=0; for(const [id,n] of Object.entries(counts)){ const c=C(id); if(!c) continue; W.label('b:'+id,`<div class="bdg">${n}</div>`,housePos(c,1.1)); if(n>tn){ tn=n; top=c; } }
        if(top && !skipping){ const h=top.house.pos; const dir=V3(h.x,0,h.z).normalize(); W.setFrameShift(0.12); W.camMove(V3(-dir.x*3,15,-dir.z*3).addScaledVector(V3(dir.z,0,-dir.x),2), V3(h.x*0.82,1.5,h.z*0.82),{ dur:1.8, fov:55 }); }
        if(Object.keys(counts).length) await wait(1600); break; }
      case 'drag': {
        camLock=true; W.unlabelAll('b:');
        const tgt=C(e.target); if(!tgt) break;
        if(inSquare().length) await toHomes(inSquare(),2200);
        SH.house(tgt);
        const crowd=(e.crowd||[]).map(C).filter(c=>c&&c.alive&&c!==tgt).slice(0,4);
        const d=tgt.house.door; const out=V3(-d.x,0,-d.z).normalize(); const sd=V3(out.z,0,-out.x);
        const ends=[]; const ps=crowd.map((c,i)=>{ own(c); const lat=(i-1.5)*1.3; const start=d.clone().addScaledVector(out,7.5+i).addScaledVector(sd,lat*1.6);
          const end=d.clone().addScaledVector(out,2.0+(i>1?0.9:0)).addScaledVector(sd,(i%2?1:-1)*(0.9+(i>>1)*0.5));
          c.V.place(start.x,start.z,Math.atan2(end.x-start.x,end.z-start.z)); show(c); c.state='crowd'; ends.push([c,end]);
          return walk(c,end.x,end.z,{ run:true, face:Math.atan2(d.x-end.x,d.z-end.z) }); });
        await race(Promise.all(ps),3200);
        for(const [c,end] of ends){ if(c.V.target) c.V.place(end.x,end.z,Math.atan2(d.x-end.x,d.z-end.z)); }
        W.openDoor(tgt.id,true); await wait(400);
        own(tgt); const inn=tgt.house.inside; tgt.V.place(inn.x,inn.z,Math.atan2(out.x,out.z)); show(tgt); tgt.state='crowd';
        const o1=d.clone().addScaledVector(out,0.9); await race(walk(tgt,o1.x,o1.z,{ face:Math.atan2(out.x,out.z) }),1800); if(tgt.V.target) tgt.V.place(o1.x,o1.z,Math.atan2(out.x,out.z));
        tgt.V.setPose('cower'); for(const c of crowd) c.V.lookAt((v)=>tgt.V.headPos(v));
        if(!skipping) SH.face(tgt,{ dist:2.4, fov:40, s:1 });
        break; }
      case 'escort': {
        const tgt=C(e.who); if(!tgt) break; const crowd=(e.crowd||[]).map(C).filter(c=>c&&c.state==='crowd');
        W.openDoor(tgt.id,false);
        // meydana doğru yürüyüş (takip çekimi)
        const d=tgt.house.door; const dir=V3(-d.x,0,-d.z).normalize(); const mid=d.clone().addScaledVector(dir,5.5);
        if(!skipping){ W.camFollow(tgt.V.holder,V3(3.4*dir.x+1.7*dir.z,1.9,3.4*dir.z-1.7*dir.x),V3(0,1.25,0)); }
        own(tgt); tgt.V.setPose(null); const ps=[walk(tgt,mid.x,mid.z,{ speed:1.6 })];
        crowd.forEach((c,i)=>{ const sd=V3(dir.z,0,-dir.x).multiplyScalar(i%2?0.75:-0.75); const p=mid.clone().addScaledVector(dir,-0.7-(i>>1)*0.9).add(sd); ps.push(walk(c,p.x,p.z,{ speed:1.6 })); });
        await race(Promise.all(ps),3000);
        // kesme: meydan — herkes toplanır, sanık ortada
        for(const c of crowd){ own(c); c.state='square'; c.V.lookAt(null); c.V.place(c.spot.x,c.spot.z,c.spot.yaw); show(c); }
        own(tgt); tgt.state='accused'; tgt.V.place(LAYOUT.ACCUSED.x,LAYOUT.ACCUSED.z+0.6,0); show(tgt); tgt.V.setPose('cower');
        if(!skipping){ SH.squareHigh(); W.camMove(V3(0.6,3.2,10.5),V3(0,1.5,-0.5),{ dur:3.2, fov:50 }); }
        await toSquare(alive().filter(c=>c.state==='home'),{ run:true, ms:2600 });
        walk(tgt,LAYOUT.ACCUSED.x,LAYOUT.ACCUSED.z,{ face:0 });
        lookAllAt(tgt); camLock=false; lastSpk=null; await wait(500);
        break; }
      case 'release': {
        const c=C(e.who); if(c){ own(c); c.V.setPose(null); c.state='square'; lookAllAt(null); await walk(c,c.spot.x,c.spot.z,{ face:c.spot.yaw }); } break; }
      case 'lock': { const c=C(e.who); if(c && c.V.holder.visible) W.label('l:'+e.who,`<div class="lk">🔒${e.v==='hang'?'🪢':'🕊️'}</div>`,headPos(c)); break; }
      case 'stool': {
        camLock=true; W.unlabelAll('l:'); lookAllAt(null);
        const c=C(e.who); if(!c) break; phase('dusk',4);
        if(!skipping){ SH.gallows(); }
        await wait(300); standOnStool(c,freeNoose(1)); lookAllAt(c);
        // cellat: en yakın canlı köylü platforma çıkar
        const ex=inSquare().filter(o=>o!==c).sort((a,b)=>a.V.holder.position.distanceTo(GAL.group.position)-b.V.holder.position.distanceTo(GAL.group.position))[0];
        if(ex){ own(ex); const p=GAL.group.localToWorld(V3(GAL.hangX[c.hangK]+0.85,0,GAL.z+0.3)); ex.V.place(p.x,p.z,LAYOUT.GALLOWS.rot-Math.PI/2); ex.V.holder.position.y=GAL.platformY; ex.state='exec'; ex.V.lookAt((v)=>c.V.headPos(v)); dirs.exec=ex; }
        if(!skipping) SH.gallowsK(c.hangK,2.5);
        await wait(500); break; }
      case 'hang': {
        const c=C(e.who); if(!c) break; camLock=true;
        if(e.final){ finalK++; if(!skipping && finalK===1){ SH.gallows(); } standOnStool(c,freeNoose(1)); await wait(500); }
        if(c.state!=='stool') standOnStool(c,freeNoose(1)); const k=c.hangK;
        const ex=dirs.exec; if(ex && !e.final){ ex.V.kick(); await wait(250); }
        await drop(c,k,!!e.vamp);
        if(e.vamp){ c.alive=true; } else { c.alive=false; }
        if(!e.final && ex){ await wait(400); const back=GAL.group.localToWorld(V3(GAL.hangX[k]+1.5,0,GAL.z+0.6)); ex.V.place(back.x,back.z,ex.V.yaw); ex.V.holder.position.y=GAL.platformY; }
        await wait(e.vamp?700:1500); break; }
      case 'kick': {
        const c=C(e.who), by=C(e.by); if(!c||!by) break; const k=c.hangK>=0?c.hangK:1;
        const p=GAL.group.localToWorld(V3(GAL.hangX[k],0,GAL.z+0.78)); own(by); show(by); by.V.place(p.x,p.z,LAYOUT.GALLOWS.rot+Math.PI); by.V.holder.position.y=GAL.platformY; by.state='exec';
        if(!skipping) SH.gallowsK(k);
        by.V.kick(); await wait(260); pivots[k].vx-=0.9+Math.random()*0.3; pivots[k].vz+=(Math.random()-.5)*0.5; W.shake(0.1);
        c.V.play('Hit_Chest',{ fade:.1, restart:true }); setTimeout(()=>{ if(c.state==='hanged') c.V.play('Idle_Talking_Loop',{ fade:.3 }); },420);
        await wait(380);
        const back=GAL.group.localToWorld(V3(GAL.hangX[k]+1.2+Math.random()*0.6,0,GAL.z+1.0)); by.V.place(back.x,back.z,by.V.yaw); by.V.holder.position.y=GAL.platformY;
        break; }
      case 'impale': {
        const c=C(e.who); if(!c) break; const k=e.k||0;
        if(!skipping) SH.stakes(k);
        await wait(200); onStake(c,k); c.alive=false;
        // tutanlar
        const holders=inSquare().filter(o=>o!==c).slice(0,3); dirs.holders=holders;
        holders.forEach((h,i)=>{ own(h); const a=-0.9+i*0.9; const p=STK.group.localToWorld(V3(STK.x[k]+Math.sin(a)*0.85,0,Math.cos(a)*0.85)); h.V.place(p.x,p.z,Math.atan2(-Math.sin(a),-Math.cos(a))+LAYOUT.STAKES.rot); h.V.fixed=true; h.V.play('Push_Loop',{ fade:.2 }); h.state='holder'; });
        tween(6000,(t)=>{ c.V.setVampire(1-t); });
        await wait(700); break; }
      case 'fangs': { const c=C(e.who); if(!c) break; if(c.state!=='square'){ await toSquare([c]); } c.V.setVampire(1); c.V.once('Spell_Simple_Enter'); break; }
      case 'pause': await wait(e.ms||600); break;
    }
  }
  const dirs={ exec:null, holders:[] }; let finalK=0;

  async function run(){
    if(busy) return; busy=true;
    while(queue.length){ const e=queue.shift(); try{ await apply(e); }catch(err){ console.error('3B sahne hatası',e.t,err); } }
    // tutanları / cellatı meydana geri al
    for(const c of [...cast.values()]){ if(c.state==='holder'||c.state==='exec'){ c.V.fixed=false; c.V.holder.position.y=0; c.state='square'; c.V.place(c.spot.x,c.spot.z,c.spot.yaw); } }
    dirs.exec=null; dirs.holders=[];
    busy=false; skipping=false; W.unlabel('spk');
    const cbs=doneCbs; doneCbs=[]; cbs.forEach(f=>f());
    applyMode();
  }

  /* ---------------- boşta kamera / mod ---------------- */
  function applyMode(){
    if(busy) return;
    refreshLabels();
    switch(mode){
      case 'roles': phase('day',0); SH.crane({ speed:0.04 }); break;
      case 'select': phase(curPhase==='night'?'night':'day',2); SH.pan(); break;
      case 'night': SH.pan({ speed:0.05 }); break;
      case 'talk': case 'final': if(!camLock) SH.square(1.4); break;
      case 'defense': { const acc=[...cast.values()].find(c=>c.state==='accused'); if(acc) SH.face(acc,{ dist:2.2, fov:40 }); break; }
      case 'verdict': break;
      case 'dawn': break;
      case 'end': break;
    }
  }

  /* ---------------- dokunma ---------------- */
  W.onPick((id)=>{ onPick&&onPick(id); }, ()=>[...cast.values()].filter(c=>c.state==='square'||c.state==='accused').map(c=>c.V.hit));

  /* ---------------- başlangıç ---------------- */
  phase('day',0);
  // gölgelendiricileri önceden derle (ilk sahnede takılma olmasın)
  const ready=(async()=>{ for(const c of cast.values()){ c.V.holder.visible=true; c.V.holder.position.set(0,0,-200); }
    try{ if(W.renderer.compileAsync) await Promise.race([W.renderer.compileAsync(W.scene,W.camera), new Promise(r=>setTimeout(r,6000))]); }catch(e){}
    for(const c of cast.values()){ if(c.state==='home'){ c.V.holder.visible=false; c.V.setOpacity(0); } } })();
  SH.crane({ speed:0.04, ang:0.6 });

  return {
    cast, world:W, ready,
    play(events,done){ queue.push(...events); if(done) doneCbs.push(done); prefetch&&prefetch(queue); run(); },
    skip(){ if(!busy) return; skipping=true; try{ speechSynthesis.cancel(); }catch(e){} for(const w of [...wakes]) w(); },
    get busy(){ return busy; },
    /** kalıcı durum: {id:{dead|hanged,hangK|impaled,stakeK}} */
    sync(vs){
      const hangUsed=new Set();
      for(const c of cast.values()){ const s=vs[c.id]||{};
        if(s.impaled){ if(c.state!=='impaled'||c.stakeK!==s.stakeK) onStake(c,s.stakeK||0,{ instant:true }); c.alive=false; W.setMourning(c.id,true); }
        else if(s.hanged){ if(c.state!=='hanged'){ hangInstant(c,freeNoose(1)); } c.alive=false; W.setMourning(c.id,true); }
        else if(s.dead){ if(c.state!=='dead' && c.state!=='hanged') setDead(c); c.alive=false; }
        else if(c.state==='hanged' && c.alive){ /* asılı vampir — kazığa gidecek */ }
      }
      stoolsReset();
    },
    reset(){ queue=[]; skipping=false; },
    setMode(m){ if(m===mode){ refreshLabels(); return; } mode=m; applyMode(); },
    setCandidates(ids){ candidates=ids&&ids.length?ids:null; refreshLabels(); },
    highlight(id,on){
      W.unringAll('sel'); selId=on?id:null; refreshLabels(); if(!on||!id) return; const c=C(id); if(!c) return;
      if(c.state==='square'||c.state==='accused'){ W.ringAt('sel',(v)=>v.copy(c.V.holder.position)); }
      else if(c.house){ W.ringAt('sel',(v)=>v.copy(c.house.door),0xffc457,1.6); if(!busy && (mode==='select'||mode==='night')){ const h=c.house; const out=V3(-h.door.x,0,-h.door.z).normalize(); const sd=V3(out.z,0,-out.x); W.setFrameShift(0.12); W.camMove(h.door.clone().addScaledVector(out,10).addScaledVector(sd,1.2).add(V3(0,4.2,0)), h.door.clone().add(V3(0,2.0,0)),{ dur:1.4, fov:50 }); } }
    },
    focusVillage(){ SH.crane(); },
    dispose(){ for(const c of cast.values()) W.removeActor(c.V); if(shadow) W.removeActor(shadow.V); W.unlabelAll(''); W.unringAll(''); },
  };
}
