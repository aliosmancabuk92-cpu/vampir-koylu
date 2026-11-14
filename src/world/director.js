/* =====================================================================
   3B SAHNE YÖNETMENİ — motor olaylarını 3B köyde canlandırır.
   2B createScene ile aynı arayüz: play / skip / busy / sync / reset
   + köy arayüzü: highlight, setMode, setCandidates, dispose
   Sürükleme, asma, tekme ve kazık sahneleri gerçek insan hareketi (CMU mocap),
   kol IK'sı, fizik (ip sarkacı, tabure, şapka) ve sinematik kurguyla oynanır.
   ===================================================================== */
import * as THREE from 'three';
import SFX from '../sfx.js';
import { createVillager, MALE_KEYS, FEMALE_KEYS, LOOKS, clipInfo, clipStart, AXES } from './people.js';
const CI=(n)=>clipInfo(n)||{ dur:2, ev:{} };
import { LAYOUT } from './world.js';
import { createFX } from './fx.js';

const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const AX=AXES.X, AY=AXES.Y, AZ=AXES.Z;
const SKINS=['#e0b494','#d9a882','#c99472','#c48d66','#b98060','#d4a07c','#caa07a','#b07858'];
const CLOTHS=['#8a5a3a','#4a4a52','#5a6a3a','#d8ccb4','#3a5a8a','#8a3a30','#6a6258','#9a7a4a','#e2d8c4','#6a4a6a','#2e3e5e','#5a3a26','#7a8a5a','#a8763a','#3e5a52','#704838'];
const HATC=['#1e1c1a','#3a3228','#4a1a16','#2a2a30','#3a342c','#2a2826','#40362a'];
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pick=(a)=>a[Math.floor(Math.random()*a.length)];
const yawOf=(v)=>Math.atan2(v.x,v.z);
const fwdOf=(y)=>V3(Math.sin(y),0,Math.cos(y));
const rightOf=(y)=>V3(-Math.cos(y),0,Math.sin(y));

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
    V.holder.position.set(0,0,0); V.holder.updateMatrixWorld(true); const t=V3();
    const neckH=(V.bones.get('neck_01')?.getWorldPosition(t).y)||1.5; const pelvisH=(V.bones.get('pelvis')?.getWorldPosition(t).y)||0.95;
    V.setOpacity(0);
    cast.set(p.id,{ p, id:p.id, V, house:W.houseOf(p.id), spot:null, state:'home', hangK:-1, stakeK:-1, neckH, pelvisH, alive:true, offs:[] });
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
  /** oyun zamanında bekle (ağır çekimde yavaşlar) */
  const gwait=(ms)=> (skipping||ms<=0)?Promise.resolve():new Promise(res=>{ let t=0, off=null; const done=()=>{ if(off){ off(); off=null; } wakes.delete(done); res(); }; off=W.tick((dt)=>{ t+=dt*1000; if(t>=ms) done(); }); wakes.add(done); });
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
  const bpos=(c,name,v=V3())=>{ const b=c.V.bones.get(name); return b?b.getWorldPosition(v):v.copy(c.V.holder.position); };
  /** sahne süresince eklenen IK / değiştiricileri temizle */
  function calm(c){ for(const f of c.offs) f(); c.offs=[]; c.V.setIK('l',null); c.V.setIK('r',null); c.V.afterUpdate=null; }
  /** IK hedefi başka karakterin kemiği olan karakteri, hedef karakterden sonra güncelle */
  function updateAfter(c){ W.actors.delete(c.V); W.actors.add(c.V); }
  /** iki kişilik klipte B'nin istenen yerde başlaması için A'nın çapası */
  function anchorForB(clipB,bx,bz,byaw,sc){ const s=clipStart(clipB); const ay=byaw-s.yaw; const c=Math.cos(ay), si=Math.sin(ay); return { x:bx-(s.x*c+s.z*si)*sc, z:bz-(-s.x*si+s.z*c)*sc, yaw:ay }; }
  /** klipteki bir noktanın (ör. tekme ayağı) dünyada hedefe denk gelmesi için çapa */
  function anchorForHit(p,yaw,hit,sc){ const c=Math.cos(yaw), s=Math.sin(yaw); return { x:p.x-(hit[0]*c+hit[2]*s)*sc, z:p.z-(-hit[0]*s+hit[2]*c)*sc, yaw }; }

  /* ---------------- efektler ---------------- */
  const FXS=createFX(W.scene, W.renderer.getPixelRatio()); W.tick((dt)=>FXS.update(dt));
  let smTok=0;
  function slowmo(scale=0.3,hold=600,ramp=450){ if(skipping) return; const tok=++smTok; W.setTimeScale(scale);
    setTimeout(()=>{ if(tok!==smTok) return; const t0=performance.now(); const step=()=>{ if(tok!==smTok) return; const k=Math.min(1,(performance.now()-t0)/ramp); W.setTimeScale(scale+(1-scale)*k*k); if(k<1) setTimeout(step,16); }; step(); },hold); }
  function normalTime(){ smTok++; W.setTimeScale(1); }
  // sinematik şeritler + perde (kararma / kırmızı parlama)
  const mk=(css)=>{ const d=document.createElement('div'); d.style.cssText='position:absolute;left:0;right:0;pointer-events:none;'+css; W.overlay.appendChild(d); return d; };
  const barT=mk('top:0;height:0;background:#000;z-index:3'), barB=mk('bottom:0;height:0;background:#000;z-index:3');
  const veil=mk('top:0;bottom:0;background:#000;opacity:0;z-index:2'), flash=mk('top:0;bottom:0;opacity:0;z-index:2;background:radial-gradient(ellipse at center,rgba(160,0,0,0) 30%,rgba(150,0,0,.85) 100%)');
  let barsOn=0; function bars(on){ const to=on?7:0; if(barsOn===to) return; const from=barsOn; barsOn=to; tween(skipping?0:600,(k)=>{ const h=from+(to-from)*k; barT.style.height=barB.style.height=h+'%'; }); }
  function dip(ms=260){ return tween(ms,(k)=>{ veil.style.opacity=String(k); }); }
  function undip(ms=380){ return tween(ms,(k)=>{ veil.style.opacity=String(1-k); }); }
  function redFlash(a=0.75){ if(skipping) return; tween(520,(k)=>{ flash.style.opacity=String(a*(1-k)); }); }

  /* ---------------- kamera çekimleri ---------------- */
  let camLock=false, lastSpk=null, side=1;
  let trackOff=null;
  function untrack(){ if(trackOff){ trackOff(); trackOff=null; } }
  const NOCAM=()=>globalThis.VK_NOCAM;
  function cam(pos,tgt,fov=50,dur=0,shift=0.2){ untrack(); if(NOCAM()) return; W.setFrameShift(shift); if(skipping||dur<=0) W.camCut(pos,tgt,fov); else camMv(pos,tgt,{ dur, fov }); }
  const camMv=(p,t,o)=>{ untrack(); if(!NOCAM()) W.camMove(p,t,o); };
  const camFol=(o,off,look)=>{ untrack(); if(!NOCAM()) W.camFollow(o,off,look); };
  /** sürekli izleyen kamera: konum/hedef işlevleri her karede, yumuşak takip */
  /* kamera ile hedef arasına ev girerse kamerayı hedefe yaklaştır */
  const ray=new THREE.Raycaster(); const _rd=V3();
  function unblock(P,T){ const obs=[...W.village.houses.map(h=>h.group),...(W.village.decor||[]).map(d=>d.group).filter(Boolean)]; _rd.subVectors(P,T); const L=_rd.length(); if(L<0.5) return P; _rd.divideScalar(L);
    ray.set(T,_rd); ray.far=L; const hit=ray.intersectObjects(obs,true)[0]; if(hit && hit.distance<L){ P.copy(T).addScaledVector(_rd,Math.max(0.9,hit.distance-0.45)); P.y+=Math.min(1.2,(L-hit.distance)*0.35); } return P; }
  function track(fP,fT,fov=42,k=3.5,shift=0.08){ untrack(); if(skipping||NOCAM()) return; W.setFrameShift(shift); const P=V3(), T=V3(); let first=true, n=0;
    trackOff=W.tick((dt)=>{ fP(P); fT(T); unblock(P,T);
      if(first){ first=false; W.camCut(P,T,fov); return; } const a=1-Math.exp(-k*dt); W.CAM.pos.lerp(P,a); W.CAM.tgt.lerp(T,a); }); }
  /** iki karakteri yandan, ikisi de kadrajda kalacak şekilde */
  function frameTwo(a,b,{ side=1, dist=null, h=1.4, ty=1.0, away=null, lead=null, dir=null }={}){
    const mid=(v)=>{ const pa=a.V.holder.getWorldPosition(_fa), pb=b.V.holder.getWorldPosition(_fb); return v.set((pa.x+pb.x)/2,0,(pa.z+pb.z)/2); };
    return [(P)=>{ mid(P); const pa=a.V.holder.getWorldPosition(_fa), pb=b.V.holder.getWorldPosition(_fb); const ax=_fc.set(pb.x-pa.x,0,pb.z-pa.z); const L=Math.max(0.6,ax.length()); ax.divideScalar(L);
        const n=dir?_fd.copy(dir):_fd.set(-ax.z,0,ax.x).multiplyScalar(side); if(!dir && away && n.dot(away)<0) n.negate(); const D=dist??(2.5+L*1.25); P.addScaledVector(n,D); if(lead) P.add(lead); return P.setY(h); },
      (T)=>{ mid(T); if(lead) T.addScaledVector(lead,0.5); return T.setY(ty); }]; }
  const _fa=V3(), _fb=V3(), _fc=V3(), _fd=V3();
  const SH={
    establish:()=>cam(V3(0,17,31),V3(0,2,-4),55,0),
    square:(dur=1.2)=>cam(V3(0.4,2.7,11.8),V3(0,1.55,-1.2),52,dur),
    squareHigh:(dur=0)=>cam(V3(0,11.5,12.5),V3(0,0.8,-0.8),55,dur),
    face:(c,{ dist=1.7, fov=36, s=side, dur=0 }={})=>{ const h=c.V.headPos(V3()); const y=c.V.yaw; const f=fwdOf(y); const sd=V3(f.z,0,-f.x).multiplyScalar(s);
      cam(h.clone().addScaledVector(f,dist).addScaledVector(sd,0.55).add(V3(0,0.02,0)), h.clone().add(V3(0,-0.16,0)).addScaledVector(sd,-0.12), fov, dur, 0.06); },
    medium:(c,{ s=side, dur=0 }={})=>{ const h=c.V.headPos(V3()); const y=c.V.yaw; const f=fwdOf(y); const sd=V3(f.z,0,-f.x).multiplyScalar(s);
      cam(h.clone().addScaledVector(f,3.4).addScaledVector(sd,1.1).add(V3(0,-0.15,0)), h.clone().add(V3(0,-0.45,0)), 40, dur, 0.12); },
    /** omuz üstü: dinleyenin arkasından konuşana */
    ots:(c,l)=>{ const hc=c.V.headPos(V3()), hl=l.V.headPos(V3()); const d=hc.clone().sub(hl).setY(0); const L=d.length(); if(L<1.0) return SH.face(c); d.divideScalar(L); const sd=V3(d.z,0,-d.x).multiplyScalar(side);
      const P=hl.clone().addScaledVector(d,-1.5).addScaledVector(sd,0.98).add(V3(0,0.28,0)); cam(unblock(P,hc), hc.clone().add(V3(0,-0.12,0)), 36, 0, 0.08); },
    house:(c,dur=0)=>{ const h=c.house; const out=V3(-h.door.x,0,-h.door.z).normalize(); const sd=V3(out.z,0,-out.x); cam(h.door.clone().addScaledVector(out,7.2).addScaledVector(sd,1.6).add(V3(0,2.1,0)), h.door.clone().add(V3(0,1.5,0)).addScaledVector(out,1.2), 48, dur); },
    gallows:(dur=0)=>cam(GAL.group.localToWorld(V3(3.2,2.3,6.4)), GAL.group.localToWorld(V3(0,2.35,-0.5)), 50, dur),
    gallowsK:(k,dur=0)=>{ const x=GAL.hangX[k]??0; cam(GAL.group.localToWorld(V3(x+1.5,2.5,3.1)), GAL.group.localToWorld(V3(x,2.2,GAL.z)), 44, dur); },
    stakes:(k,dur=0)=>{ const x=STK.x[k]??0; cam(STK.group.localToWorld(V3(x+2.4,1.9,STK.spotZ+3.0)), STK.group.localToWorld(V3(x,0.45,STK.spotZ)), 44, dur, 0.1); },
    crane:(o={})=>{ if(skipping||NOCAM()) return; untrack(); W.setFrameShift(0.18); W.camOrbit({ center:V3(0,0,-1), r:W.village.R+11, h:W.village.R*1.15+6, lookY:0, speed:0.035, ...o }); },
    /** evleri tek tek gösteren dönen bakış (seçim / gece) */
    pan:(o={})=>{ if(skipping||NOCAM()) return; untrack(); W.setFrameShift(0.14); const cur=Math.atan2(W.CAM.tgt.x,-W.CAM.tgt.z); W.camPan({ R:W.village.R, h:8.5, back:3.2, lookY:1.6, speed:0.07, ang:cur, ...o }); },
  };
  /** yerel (darağacı / kazık yeri) koordinatla kamera */
  const camG=(p,t,fov=44,dur=0,sh=0.08)=>cam(GAL.group.localToWorld(p),GAL.group.localToWorld(t),fov,dur,sh);
  const camS=(p,t,fov=44,dur=0,sh=0.08)=>cam(STK.group.localToWorld(p),STK.group.localToWorld(t),fov,dur,sh);

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
  function sfx(n,...a){ if(skipping||!voice?.on) return; try{ SFX[n]&&SFX[n](...a); }catch(e){} }

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
  async function toSquare(list, { run=true, ms=5200, instant=false }={}){
    const ps=[];
    for(const c of list){ if(!c.alive || c.state==='hanged' || c.state==='impaled') continue;
      own(c); calm(c); const sp=c.spot;
      if(instant){ c.state='square'; c.V.fixed=false; c.V.setPose(null); c.V.place(sp.x,sp.z,sp.yaw); show(c); continue; }
      if(c.state!=='square'){ const o=doorOut(c,0.2); c.V.place(o.x,o.z,Math.atan2(-o.x,-o.z)); W.openDoor(c.id,true); setTimeout(()=>W.openDoor(c.id,false),1400); fade(c,1,350); c.state='square'; }
      c.V.fixed=false; c.V.setPose(null); ps.push(walk(c,sp.x,sp.z,{ run, face:sp.yaw })); }
    if(ps.length) await race(Promise.all(ps),ms);
    for(const c of list){ if(c.state==='square' && c.V.target){ c.V.place(c.spot.x,c.spot.z,c.spot.yaw); } }
  }
  async function toHomes(list, ms=3600){
    const ps=list.filter(c=>c.state==='square').map(async c=>{ const tok=own(c); calm(c); const o=doorOut(c,0.3); await walk(c,o.x,o.z,{ run:true }); if(c.seq!==tok) return; W.openDoor(c.id,true); await walk(c,c.house.inside.x,c.house.inside.z); if(c.seq!==tok) return; await fade(c,0,300); if(c.seq!==tok) return; c.V.holder.visible=false; c.state='home'; setTimeout(()=>W.openDoor(c.id,false),500); });
    await race(Promise.all(ps),ms);
    for(const c of list){ if(c.state==='square'){ own(c); c.fadeTok++; c.V.setOpacity(0); c.V.holder.visible=false; c.state='home'; } }
  }
  function lookAllAt(c){ for(const o of [...cast.values()].filter(o=>o.state==='square'||o.state==='accused')){ if(o===c) { o.V.lookAt(null); continue; } o.V.lookAt(c?(v)=>c.V.headPos(v):null); } }
  /** karakteri gerçek hareket klibine sok, bitince boşa al */
  function act(c,clip,o={}){ c.V.fixed=true; return c.V.mocap(clip,{ inPlace:true, lockYaw:true, fade:.35, then:'idle', ...o }); }

  /* ---------------- fizik: şapka, tabure, ip ---------------- */
  const _gl=V3();
  function groundAt(p){ _gl.copy(p); GAL.group.worldToLocal(_gl); return (Math.abs(_gl.x)<=2.3 && Math.abs(_gl.z)<=1.35)?GAL.platformY:0; }
  const hats=new Set();
  function flyHat(c,vel){ const parts=c.V.hatParts; if(!parts||!parts.length||c.hatOff||skipping) return; c.hatOff=true;
    const g=new THREE.Group(); parts[0].getWorldPosition(g.position); W.scene.add(g); g.updateMatrixWorld(true);
    for(const m of parts){ m.userData.home={ parent:m.parent, pos:m.position.clone(), quat:m.quaternion.clone(), scl:m.scale.clone() }; g.attach(m); }
    hats.add({ g, c, v:vel.clone(), w:V3((Math.random()-.5)*10,(Math.random()-.5)*7,(Math.random()-.5)*10), rest:false }); setTimeout(()=>sfx('flop'),700); }
  function restoreHat(c){ if(!c.hatOff) return; c.hatOff=false; for(const h of [...hats]) if(h.c===c){ for(const m of [...h.g.children]){ const H=m.userData.home; if(H){ H.parent.add(m); m.position.copy(H.pos); m.quaternion.copy(H.quat); m.scale.copy(H.scl); } } W.scene.remove(h.g); hats.delete(h); } }
  W.tick((dt)=>{ for(const h of hats){ if(h.rest) continue; h.v.y-=9.8*dt; h.g.position.addScaledVector(h.v,dt); h.g.rotation.x+=h.w.x*dt; h.g.rotation.y+=h.w.y*dt; h.g.rotation.z+=h.w.z*dt;
    const fl=groundAt(h.g.position)+0.05; if(h.g.position.y<fl){ h.g.position.y=fl; h.v.y=Math.abs(h.v.y)*0.3; h.v.x*=0.45; h.v.z*=0.45; h.w.multiplyScalar(0.35); if(h.v.lengthSq()<0.06){ h.rest=true; h.g.rotation.x=0; h.g.rotation.z=0; } } } });
  const stoolsMoving=[];
  function kickStool(k,dirL,pow=1){ const st=GAL.stools[k]; st.visible=true; stoolsMoving.push({ st, v:V3(dirL.x*3.4*pow,2.0*pow,dirL.z*3.4*pow), w:V3(dirL.z*10,(Math.random()-.5)*5,-dirL.x*10), rest:false, hits:0 }); }
  W.tick((dt)=>{ for(const s of stoolsMoving){ if(s.rest) continue; s.v.y-=9.8*dt; const p=s.st.position; p.addScaledVector(s.v,dt); s.st.rotation.x+=s.w.x*dt; s.st.rotation.y+=s.w.y*dt; s.st.rotation.z+=s.w.z*dt;
      const onP=Math.abs(p.x)<=2.3 && Math.abs(p.z)<=1.35; const fl=(onP?GAL.platformY:0)+0.12;
      if(p.y<fl){ p.y=fl; if(s.v.y<-1.0 && s.hits++<3) sfx('clatter'); s.v.y=Math.abs(s.v.y)*0.32; s.v.x*=0.55; s.v.z*=0.55; s.w.multiplyScalar(0.45);
        if(s.v.length()<0.45){ s.rest=true; s.st.rotation.x=Math.PI/2; s.st.rotation.z=0; } } }
    for(let i=stoolsMoving.length-1;i>=0;i--) if(stoolsMoving[i].rest) stoolsMoving.splice(i,1); });

  /* ---------------- asma ---------------- */
  const pivots=[0,1,2].map(k=>{ const p=new THREE.Group(); p.rotation.order='XZY'; p.position.set(GAL.hangX[k],GAL.beamY,GAL.z); GAL.group.add(p); p.add(GAL.ropes[k]); GAL.ropes[k].position.set(0,0,0); p.add(GAL.noose[k]);
    return { k, p, ax:0, az:0, vx:0, vz:0, tw:0, vt:0, st:0, vs:0, who:null, L:1.55 }; });
  function applyRope(pv){ const L=pv.L+pv.st; GAL.ropes[pv.k].scale.y=L-0.02; GAL.noose[pv.k].position.set(0,-L-0.01,0.035); GAL.noose[pv.k].rotation.set(Math.PI/2+0.15,0,0);
    const c=pv.who; if(c && c.state==='hanged' && c.V.holder.parent===pv.p) c.V.holder.position.y=-L-c.neckH; }
  function setNoose(k,L){ const pv=pivots[k]; pv.L=L; applyRope(pv); }
  [0,1,2].forEach(k=>setNoose(k,1.55));
  W.tick((dt)=>{ for(const pv of pivots){ const a=Math.abs(pv.ax)+Math.abs(pv.az)+Math.abs(pv.vx)+Math.abs(pv.vz)+Math.abs(pv.tw)+Math.abs(pv.vt)+Math.abs(pv.st)+Math.abs(pv.vs); if(a<1e-4) continue;
    const w2=9.8/(pv.L+0.8); const n=Math.min(40,Math.ceil(dt/0.008)), h=dt/n;
    for(let i=0;i<n;i++){ pv.vx+=(-w2*pv.ax-0.2*pv.vx)*h; pv.vz+=(-w2*pv.az-0.2*pv.vz)*h; pv.ax+=pv.vx*h; pv.az+=pv.vz*h;
      pv.vt+=(-2.4*pv.tw-0.32*pv.vt)*h; pv.tw+=pv.vt*h; pv.vs+=(-200*pv.st-8*pv.vs)*h; pv.st+=pv.vs*h; }
    pv.ax=clamp(pv.ax,-1.2,1.2); pv.az=clamp(pv.az,-1.2,1.2); pv.st=clamp(pv.st,-0.3,0.3);
    pv.p.rotation.set(pv.ax,pv.tw,pv.az); applyRope(pv); } });
  const hangOrder=[];
  function freeNoose(pref=1){ for(const k of [pref,0,2,1]) if(!pivots[k].who) return k; const old=hangOrder[0]; const k=old.hangK; old.V.holder.visible=false; freeBody(old); old.state='dead'; return k; }
  function freeBody(c){ // ipten / kazıktan indir, sahneye geri koy
    const i=hangOrder.indexOf(c); if(i>=0) hangOrder.splice(i,1);
    if(c.hangK>=0){ const pv=pivots[c.hangK]; if(pv.who===c){ pv.who=null; pv.ax=pv.az=pv.vx=pv.vz=pv.tw=pv.vt=pv.st=pv.vs=0; pv.p.rotation.set(0,0,0); setNoose(c.hangK,1.55); } c.hangK=-1; }
    if(c.stakeK>=0){ STK.stakes[c.stakeK].visible=false; STK.pools[c.stakeK].visible=false; c.stakeK=-1; }
    if(c.V.holder.parent!==W.scene) W.scene.add(c.V.holder);
    calm(c); restoreHat(c); c.V.holder.rotation.set(0,c.V.yaw,0);
    c.V.unfreeze(); c.V.setPose(null,{ instant:true }); c.V.fixed=false; c.V.setVampire(0);
  }
  function stoolsReset(){ stoolsMoving.length=0; GAL.stools.forEach(s=>{ s.visible=false; s.rotation.set(0,0,0); }); }
  const STOOL_TOP=0.5;
  function standOnStool(c,k){
    own(c); show(c); freeBody(c); const st=GAL.stools[k]; st.visible=true; st.rotation.set(0,0,0); st.position.set(GAL.hangX[k],GAL.platformY,GAL.z);
    const w=GAL.group.localToWorld(V3(GAL.hangX[k],0,GAL.z)); c.V.place(w.x,w.z,LAYOUT.GALLOWS.rot); c.V.holder.position.y=GAL.platformY+STOOL_TOP;
    c.V.fixed=true; c.V.play('Idle_Loop',{ fade:.2 }); c.state='stool'; c.hangK=k;
    const neckY=GAL.platformY+STOOL_TOP+c.neckH; setNoose(k, GAL.beamY-neckY+0.02); pivots[k].who=c; hangOrder.push(c);
  }
  /** ipe asılı bedenin bacak çırpması (azalan) */
  function pedal(c,dur=1.7,amp=1){ let t=0; const off=c.V.mod((dt,rot,B)=>{ t+=dt; const k=amp*Math.max(0,1-t/dur); if(k<=0) return; const w=10.5;
      rot(B.get('thigh_l'),AX,0.55*k*Math.max(0,Math.sin(t*w))); rot(B.get('thigh_r'),AX,0.55*k*Math.max(0,Math.sin(t*w+Math.PI)));
      rot(B.get('calf_l'),AX,-0.9*k*Math.max(0,Math.sin(t*w+0.8))); rot(B.get('calf_r'),AX,-0.9*k*Math.max(0,Math.sin(t*w+Math.PI+0.8)));
      rot(B.get('upperarm_l'),AZ,0.5*k*Math.sin(t*7.3)); rot(B.get('upperarm_r'),AZ,-0.5*k*Math.sin(t*6.1+1)); rot(B.get('lowerarm_l'),AX,0.6*k*Math.max(0,Math.sin(t*8))); rot(B.get('lowerarm_r'),AX,0.6*k*Math.max(0,Math.sin(t*7+2)));
      rot(B.get('Head'),AY,0.25*k*Math.sin(t*5)); }); c.offs.push(off); return off; }
  async function drop(c,k,vamp){
    const pv=pivots[k];
    c.V.place(0,0,0); pv.p.add(c.V.holder); c.V.holder.rotation.set(0,0,0); c.V.yaw=0;
    const L0=GAL.beamY-(GAL.platformY+STOOL_TOP+c.neckH); const L1=L0+0.32;
    c.V.holder.position.set(0,-L0-c.neckH,0); c.V.fixed=true; c.state='hanged'; c.V.play('Idle_Loop',{ fade:.15 });
    await tween(240,(t)=>{ const L=L0+(L1-L0)*t*t; setNoose(k,L); });
    // ip gerilir: sarsıntı, esneme, salınım, dönme; şapka uçar
    pv.vs=-1.9; pv.vx+=0.45+Math.random()*0.2; pv.vz+=(Math.random()-.5)*0.3; pv.vt+=(Math.random()<.5?-1:1)*(0.9+Math.random()*0.5);
    W.shake(0.12); sfx('ropeJerk'); sfx('gasp');
    const gf=fwdOf(LAYOUT.GALLOWS.rot); flyHat(c,V3(gf.x*1.4+(Math.random()-.5),2.6,gf.z*1.4+(Math.random()-.5)));
    if(vamp){ pedal(c,1.1,0.8); await gwait(skipping?0:1000); c.V.setVampire(1); sfx('evil'); c.V.play('Idle_FoldArms_Loop',{ fade:.5 }); c.V.setPose('hangVamp'); }
    else { W.setMourning(c.id,true); pedal(c,1.8,1); setTimeout(()=>{ if(c.state==='hanged'){ c.V.freeze('Idle_Loop',0.4); c.V.setPose('hang'); } }, skipping?0:1900); }
  }
  function hangInstant(c,k,vamp=false){ own(c); c.fadeTok=(c.fadeTok||0)+1; freeBody(c); const pv=pivots[k]; const L=GAL.beamY-(GAL.platformY+STOOL_TOP+c.neckH)+0.32; pv.who=c; c.hangK=k; setNoose(k,L); hangOrder.push(c);
    pv.p.add(c.V.holder); c.V.holder.position.set(0,-L-c.neckH,0); c.V.holder.rotation.set(0,0,0); c.V.yaw=0; c.V.setOpacity(1); c.V.holder.visible=true; c.V.fixed=true; c.state='hanged';
    if(vamp){ c.V.setVampire(1); c.V.play('Idle_FoldArms_Loop'); c.V.setPose('hangVamp',{ instant:true }); } else { c.V.freeze('Idle_Loop',0.4); c.V.setPose('hang',{ instant:true }); }
    pv.ax=0.04; pv.vz=0.05; }

  /* ---------------- kazık (yerde, elle göğse) ---------------- */
  /** yerde sırtüstü yatır: baş rafa, ayaklar meydana */
  function layDown(c,k){ own(c); freeBody(c); const sp=STK.spot(k); c.V.place(sp.x,sp.z,sp.yaw+Math.PI); c.V.fixed=true; c.V.freeze('LayToIdle',0); show(c); c.stakeK=k; }
  /** kazık yerinde göğüs noktası (dünya) */
  const chestOf=(c,v=V3())=>{ bpos(c,'spine_03',v); v.y=Math.max(0.16,v.y); return v; };
  function stakeAt(k,p,depth){ const s=STK.stakes[k]; s.visible=true; s.position.set(p.x,p.y-depth,p.z); s.rotation.set(0,0,0); }
  function onStake(c,k,{ instant=false }={}){
    layDown(c,k); c.state='impaled'; W.setMourning(c.id,true,false); c.V.setOpacity(1); c.V.holder.visible=true; c.V.setPose('impaled',{ instant:true });
    c.V.holder.updateMatrixWorld(true); stakeAt(k,chestOf(c),0.2); STK.pools[k].visible=true; STK.pools[k].scale.setScalar(1);
  }
  /* gece baskını: kimliği belirsiz gölge kurbanın kapısına gelir */
  let shadow=null;
  function getShadow(){ if(!shadow){ const V=createVillager('golge'); W.addActor(V); V.setOpacity(0); V.holder.visible=false; shadow={ V, id:'__golge' }; } return shadow; }
  async function nightAttack(c){
    if(skipping||!c||!c.house) return; const S=getShadow(); const h=c.house; const out=V3(-h.door.x,0,-h.door.z).normalize(); const sd=V3(out.z,0,-out.x);
    cam(h.door.clone().addScaledVector(out,6.8).addScaledVector(sd,-2.4).add(V3(0,1.35,0)), h.door.clone().add(V3(0,1.45,0)).addScaledVector(sd,0.4), 46, 0, 0.12);
    camMv(h.door.clone().addScaledVector(out,5.2).addScaledVector(sd,-1.6).add(V3(0,1.5,0)), h.door.clone().add(V3(0,1.5,0)),{ dur:4.5, fov:44 });
    const start=h.door.clone().addScaledVector(out,4.2).addScaledVector(sd,5.5); const atDoor=h.door.clone().addScaledVector(out,0.55);
    S.V.place(start.x,start.z,Math.atan2(atDoor.x-start.x,atDoor.z-start.z)); S.V.setVampire(1); show(S); S.V.setOpacity(0); fade(S,1,600);
    await race(S.V.walkTo(atDoor.x,atDoor.z,{ speed:1.5, face:Math.atan2(-out.x,-out.z) }),4200); if(skipping) return;
    W.openDoor(c.id,true); await wait(450);
    await race(S.V.walkTo(h.inside.x,h.inside.z,{ speed:1.2 }),1600); await fade(S,0,250); S.V.holder.visible=false;
    W.openDoor(c.id,false); await wait(350); sfx('scream'); W.shake(0.1); h.H.setLights(0); await wait(1100);
  }
  function setDead(c){ own(c); c.fadeTok=(c.fadeTok||0)+1; c.alive=false; freeBody(c); c.state='dead'; c.V.holder.visible=false; c.V.setOpacity(0); W.setMourning(c.id,true); }

  /* ---------------- sürükleme ---------------- */
  /** sürüklenen: geriye yaslanmış, topuklar yerde sürünür, gövde kıvranır */
  function dragPose(c){ let t=Math.random()*10, jt=0.5, jerk=0, js=1; return c.V.mod((dt,rot,B)=>{ t+=dt; jt-=dt; if(jt<=0){ jt=0.4+Math.random()*0.8; jerk=1; js=Math.random()<.5?-1:1; } jerk=Math.max(0,jerk-dt*2.6);
      const s=Math.sin(t*6.1)*0.6+Math.sin(t*2.7)*0.4;
      rot(B.get('pelvis'),AX,-0.26); rot(B.get('spine_01'),AX,-0.2-0.12*jerk); rot(B.get('spine_02'),AX,-0.12); rot(B.get('spine_02'),AY,0.16*s+0.25*jerk*js);
      rot(B.get('Head'),AY,0.4*Math.sin(t*2.3)); rot(B.get('Head'),AX,-0.1);
      rot(B.get('thigh_l'),AX,0.62+0.25*Math.max(0,Math.sin(t*4.7))); rot(B.get('thigh_r'),AX,0.55+0.25*Math.max(0,Math.sin(t*4.7+2.2)));
      rot(B.get('calf_l'),AX,-0.42); rot(B.get('calf_r'),AX,-0.32); rot(B.get('foot_l'),AX,-0.45); rot(B.get('foot_r'),AX,-0.4); }); }
  function startDrag(tgt,pullers,dir,spd=1.05){
    const tok={ on:true, offs:[], tgt, pullers }; const yaw=yawOf(dir); const rt=rightOf(yaw);
    own(tgt); calm(tgt); tgt.V.place(tgt.V.holder.position.x,tgt.V.holder.position.z,yaw); tgt.V.fixed=true; tgt.V.play('Idle_Loop',{ fade:.25 });
    tok.offs.push(dragPose(tgt)); tgt.V.afterUpdate=()=>tgt.V.holder.updateMatrixWorld(true);
    const sc=tgt.V.scale; const grip=(s)=>(v)=>v.copy(tgt.V.holder.position).addScaledVector(dir,0.46*sc).addScaledVector(rt,s*0.33*sc).setY(0.98*sc);
    tgt.V.setIK('r',grip(1),{ rate:5, pole:(v)=>v.copy(tgt.V.holder.position).addScaledVector(rt,1.5).setY(0.6) });
    tgt.V.setIK('l',grip(-1),{ rate:5, pole:(v)=>v.copy(tgt.V.holder.position).addScaledVector(rt,-1.5).setY(0.6) });
    pullers.forEach((c,i)=>{ own(c); calm(c); const s=i===0?1:-1; c.side=s; const hand=s>0?'l':'r';
      c.V.fixed=false; updateAfter(c); c.V.lookAt(null); c.V.setIK(hand,grip(s),{ rate:5, pole:(v)=>v.copy(c.V.holder.position).addScaledVector(rt,s*1.2).setY(0.4) });
      c.offs.push(c.V.mod((dt,rot,B)=>{ rot(B.get('spine_01'),AX,0.2); rot(B.get('spine_02'),AX,0.06); rot(B.get('Head'),AY,-s*0.5); })); });
    let acc=0;
    tok.offs.push(W.tick((dt)=>{ if(!tok.on) return; const p=tgt.V.holder.position; p.addScaledVector(dir,spd*dt); p.y=-0.07*sc;
      pullers.forEach(c=>{ const q=V3().copy(p).addScaledVector(dir,0.92*sc).addScaledVector(rt,c.side*0.56*sc); c.V.holder.position.set(q.x,0,q.z); c.V.yaw=yaw; if(c.V.curName!=='Walk_Loop') c.V.play('Walk_Loop',{ fade:.3, speed:spd/1.3 }); });
      acc+=dt; if(acc>0.06){ acc=0; FXS.trail(bpos(tgt,'foot_l')); FXS.trail(bpos(tgt,'foot_r')); } }));
    tok.scrape=setInterval(()=>{ if(tok.on) sfx('scrape'); },520);
    return tok;
  }
  function stopDrag(tok){ if(!tok||!tok.on) return; tok.on=false; clearInterval(tok.scrape); for(const f of tok.offs) f(); const t=tok.tgt; t.V.setIK('r',null); t.V.setIK('l',null); t.V.afterUpdate=null; t.V.holder.position.y=0;
    for(const c of tok.pullers) calm(c); }

  /* ---------------- konuşma: jest, tepki, çekim ---------------- */
  const ACC_RX=/vampir|yalan|asın|asalım|asılsın|sensin|herif|kâhin|gördüm|suçlu|katil|emmiş|kan/i;
  function gesture(c,e){ if((c.V.fixed && c.state!=='accused')||c.V.target) return null; const t=e.text||''; let clip;
    if(c.state==='accused') clip=pick(['argue','quarrel_B','scared']);
    else if(ACC_RX.test(t) && /!/.test(t)) clip=pick(['quarrel_A','quarrel_B','argue','point','argue']);
    else if(/\?/.test(t) && t.length<60) clip=pick(['shrug','talk_A','talk_B']);
    else clip=pick(['talk_A','talk_B','talk_A','argue','Idle_Talking_Loop']);
    if(clip==='Idle_Talking_Loop') return null;
    c.gest=clip; c.V.fixed=true; c.V.mocap(clip,{ inPlace:true, lockYaw:true, fade:.35, loop:clip!=='shrug', then:'idle' }); return clip; }
  function endGesture(c){ if(!c.gest) return; c.gest=null;
    if(c.state==='accused'){ c.V.fixed=true; c.V.mocap('scared',{ inPlace:true, lockYaw:true, loop:true, fade:.45 }); return; }
    c.V.fixed=false; c.V.idle(.45); }
  function react(sp,e){ if(skipping) return; const t=e.text||''; const others=inSquare().filter(o=>o!==sp && !o.V.fixed && !o.gest && !o.V.target); if(!others.length) return;
    const funny=/hah|heh|keklik|göbe|götü|yağsız|süzgeç|gıdık|hıçkırık|horoz|ninem|hamuğa|godu|pabuc|kulağım/i.test(t);
    const n=funny?Math.min(3,others.length):(Math.random()<.55?1:0);
    for(let i=0;i<n;i++){ const o=others.splice(Math.floor(Math.random()*others.length),1)[0]; if(!o) break; const d=200+Math.random()*700;
      setTimeout(()=>{ if(o.V.fixed||o.gest||o.state!=='square') return;
        if(funny) act(o,pick(['laugh1','laugh2','laugh3','laugh4']),{ then:'idle' });
        else if(ACC_RX.test(t)) o.V.once(Math.random()<.5?'Yes':'Idle_No_Loop');
        else o.V.once(Math.random()<.6?'Yes':'Idle_No_Loop'); },d); }
    if(funny) setTimeout(()=>sfx('laugh'),400); }
  function convShot(c,e){ const long=(e.text||'').length>70; const prev=lastSpk&&lastSpk!==c&&lastSpk.V.holder.visible&&(lastSpk.state==='square'||lastSpk.state==='accused')?lastSpk:null;
    side=-side; const r=Math.random();
    if(prev && r<0.45) SH.ots(c,prev); else if(long||r<0.8) SH.face(c,{ dist:long?1.55:1.85 }); else SH.medium(c);
    // yavaş itme: çekim canlı kalsın
    if(!skipping){ const P=W.CAM.pos.clone(), T=W.CAM.tgt.clone(); const d=T.clone().sub(P).multiplyScalar(0.09); camMv(P.add(d),T,{ dur:5, fov:W.CAM.fov, ease:'out' }); } }

  /* ---------------- olaylar ---------------- */
  let busy=false, queue=[], doneCbs=[], mode=null, curPhase='night';
  function phase(n,dur=2.5){ if(curPhase===n) return; curPhase=n; W.setPhase(n,skipping?0:dur); const lit=(n==='night'||n==='doom')?2.0:n==='dusk'?0.7:0.1; for(const c of cast.values()) if(c.V.lantern) c.V.lantern.emissiveIntensity=lit; }
  const dirs={ exec:null, holders:[], drag:null, stake:null, mute:new Set(), kickN:0 };

  async function apply(e){
    switch(e.t){
      case 'say': case 'narr': {
        onLine&&onLine(e); prefetch&&prefetch(queue);
        const c=e.who?C(e.who):null; const vis=c && c.V.holder.visible && c.V.alpha>0.5;
        const conv=vis && !camLock && (c.state==='square'||c.state==='accused');
        if(conv){ if(c!==lastSpk) convShot(c,e); lastSpk=c; lookAllAt(c); }
        if(vis){ c.V.setTalking(true); showSpeaker(c); if(conv) gesture(c,e); }
        if(conv) react(c,e);
        if(e.kind==='scream'){ if(dirs.stake){ await dirs.stake.strike(); } else if(!skipping) W.shake(0.12); }
        await speak(e);
        if(vis){ c.V.setTalking(false); endGesture(c); }
        W.unlabel('spk');
        // doğal nefes payı: aynı kişi devam ediyorsa çok kısa, konuşan değişiyorsa biraz daha uzun
        if(!skipping){ const nx=queue[0]; if(nx && (nx.t==='say'||nx.t==='narr')) await wait(nx.who===e.who?60:150); }
        break; }
      case 'sfx': if(dirs.mute.has(e.name)) break; sfx(e.name); if(e.name==='bell'||e.name==='drum') await wait(450);
        if(e.name==='cheer' && dirs.stake) dirs.stake.cheer();
        if(e.name==='festive' && !skipping){ camLock=true; phase('festive',2); for(const c of inSquare()){ c.V.fixed=false; c.V.lookAt(null); if(c.V.key==='deli'||Math.random()<.25) act(c,'chicken',{ loop:true, then:null }); else { c.V.play('Dance_Loop',{ fade:.4, speed:0.9+Math.random()*0.2 }); c.V.fixed=true; } } SH.squareHigh(3); }
        break;
      case 'gather': {
        camLock=false; bars(false); lastSpk=null; W.unlabelAll('b:'); stoolsReset();
        const list=alive().filter(c=>c.state!=='square');
        const fromHome=list.length>0;
        if(!e.end && (curPhase==='night'||curPhase==='dawn'||curPhase==='dusk')) phase('day',3);
        if(fromHome){ if(!skipping){ cam(V3(0.9,1.45,16.5),V3(-0.2,2.55,0),50,0,0.06); camMv(V3(0.3,2.6,12.2),V3(0,1.55,-1),{ dur:6, fov:52 }); } await toSquare(list,{ run:true, ms:5200 }); }
        for(const c of alive()){ if(c.state==='accused'){ c.state='square'; calm(c); c.V.fixed=false; await walk(c,c.spot.x,c.spot.z,{ face:c.spot.yaw }); } }
        for(const c of inSquare()){ c.V.fixed=false; c.V.setPose(null); c.V.idle(); }
        lookAllAt(null);
        if(!skipping){ SH.square(1.6); await wait(600); }
        break; }
      case 'disperse': {
        camLock=false; bars(false); lookAllAt(null);
        if(!skipping){ camMv(V3(0,16,20),V3(0,0,-2),{ dur:3.2, fov:55 }); }
        await toHomes(inSquare());
        SH.pan();
        break; }
      case 'home': {
        camLock=false; bars(false); lookAllAt(null); W.unlabelAll('l:'); W.unlabelAll('b:');
        if(curPhase==='day') phase('dusk',3);
        if(!skipping) camMv(V3(0,13,19),V3(0,0.5,-2),{ dur:3.4, fov:55 });
        await toHomes(inSquare());
        break; }
      case 'night': {
        if(e.on){ phase(e.end?'doom':'night',3); if(!e.end) SH.crane({ speed:0.025 }); await wait(900); }
        else if(e.end){ phase('day',3); }
        else { const dv=queue.slice(0,4).find(x=>x.t==='dead'); if(dv && !skipping){ await nightAttack(C(dv.who)); }
          phase('dawn',3); SH.establish(); if(!skipping) camMv(V3(0,9,20),V3(0,1,-3),{ dur:4, fov:55 }); await wait(900); }
        break; }
      case 'dead': {
        const c=C(e.who); if(!c) break; setDead(c);
        if(!skipping){ const h=c.house; const out=V3(-h.door.x,0,-h.door.z).normalize(); const sd=V3(out.z,0,-out.x);
          cam(h.door.clone().addScaledVector(out,11).addScaledVector(sd,2.2).add(V3(0,3.2,0)), h.door.clone().add(V3(0,2.2,0)),48,0,0.16);
          camMv(h.door.clone().addScaledVector(out,7.2).addScaledVector(sd,1.2).add(V3(0,2.2,0)), h.door.clone().add(V3(0,2.0,0)),{ dur:5, fov:46 }); }
        await wait(900); break; }
      case 'badges': {
        W.unlabelAll('b:'); const counts=e.counts||{};
        let top=null, tn=0; for(const [id,n] of Object.entries(counts)){ const c=C(id); if(!c) continue; W.label('b:'+id,`<div class="bdg">${n}</div>`,housePos(c,1.1)); if(n>tn){ tn=n; top=c; } }
        if(top && !skipping){ const h=top.house.pos; const dir=V3(h.x,0,h.z).normalize(); W.setFrameShift(0.12); camMv(V3(-dir.x*3,15,-dir.z*3).addScaledVector(V3(dir.z,0,-dir.x),2), V3(h.x*0.82,1.5,h.z*0.82),{ dur:1.8, fov:55 }); }
        if(Object.keys(counts).length) await wait(1600); break; }

      /* ===== evinden alma: kapı tekmeyle açılır, sanık çekiştirilerek çıkarılır ===== */
      case 'drag': {
        camLock=true; bars(true); W.unlabelAll('b:');
        const tgt=C(e.target); if(!tgt) break;
        if(inSquare().length) await toHomes(inSquare(),2200);
        const crowd=(e.crowd||[]).map(C).filter(c=>c&&c.alive&&c!==tgt).slice(0,4);
        const d=tgt.house.door; const out=V3(-d.x,0,-d.z).normalize(); const sd=V3(out.z,0,-out.x); const yOut=yawOf(out), yIn=yOut+Math.PI;
        if(!skipping){ cam(d.clone().addScaledVector(out,12).addScaledVector(sd,4.5).add(V3(0,3.0,0)), d.clone().add(V3(0,1.2,0)).addScaledVector(out,1.6),44,0,0.1);
          camMv(d.clone().addScaledVector(out,9.5).addScaledVector(sd,3.8).add(V3(0,2.3,0)), d.clone().add(V3(0,1.15,0)).addScaledVector(out,1.4),{ dur:6, fov:42 }); }
        const kicker=crowd[0]||null, p2=crowd[1]||null;
        const spots=[[1.3,0.05],[1.75,-0.85],[3.3,-1.6],[3.9,-2.5]]; const ends=[];
        const ps=crowd.map((c,i)=>{ own(c); calm(c); const [o,s]=spots[i]; const start=d.clone().addScaledVector(out,8.5+i*0.9).addScaledVector(sd,(i%2?-1:1)*(1.4+i*0.6));
          const end=d.clone().addScaledVector(out,o).addScaledVector(sd,s); c.V.place(start.x,start.z,yawOf(end.clone().sub(start))); show(c); c.state='crowd'; c.V.fixed=false; ends.push([c,end]);
          return walk(c,end.x,end.z,{ run:true, face:yIn }); });
        await race(Promise.all(ps),3600);
        for(const [c,end] of ends){ if(c.V.target) c.V.place(end.x,end.z,yIn); }
        // sanık kapının hemen arkasında
        own(tgt); calm(tgt); const inn=d.clone().addScaledVector(out,-0.25); tgt.V.place(inn.x,inn.z,yOut); show(tgt); tgt.state='crowd';
        tgt.V.fixed=true; tgt.V.mocap('scared',{ fade:0, inPlace:true, lockYaw:true, loop:true });
        const diag=out.clone().multiplyScalar(0.82).addScaledVector(sd,0.57).normalize();
        if(kicker && !skipping){ track(...frameTwo(kicker,tgt,{ dir:diag, dist:4.3, h:1.5, ty:1.05 }),42,3); }
        if(kicker){ const info=CI('kick_door'); const doorP=d.clone().addScaledVector(out,0.12);
          kicker.V.mocap('kick_door',{ anchor:anchorForHit(doorP,yIn,info.ev.hitPos||[0,0,0.9],kicker.V.scale), fade:0.25, then:'idle' });
          await gwait((info.ev.hit||1.5)*1000-30);
          W.openDoor(tgt.id,true,true); sfx('doorBang'); W.shake(0.16); FXS.dust(d.clone().addScaledVector(out,0.3).setY(0.9),20,1.0); FXS.splinters(d.clone().addScaledVector(out,0.2).setY(1.1),12);
          await gwait(650); }
        else { W.openDoor(tgt.id,true,true); sfx('doorBang'); await gwait(500); }
        for(const c of crowd) c.V.lookAt((v)=>tgt.V.headPos(v));
        // gerçek çekiştirme: A kolundan çeker, B (sanık) direnir
        const D=dirs.drag={ tgt, kicker, p2, crowd, out, sd, pullP:null };
        if(kicker){ const anc=anchorForB('pull_B',inn.x,inn.z,yOut,tgt.V.scale);
          tgt.V.mocap('pull_B',{ anchor:anc, fade:0.35 }); D.pullP=kicker.V.mocap('pull_A',{ anchor:anc, fade:0.4 });
          tgt.V.afterUpdate=()=>tgt.V.holder.updateMatrixWorld(true); updateAfter(kicker);
          setTimeout(()=>{ if(skipping||!D.pullP) return; let best=null; for(const h of ['l','r']) for(const w of ['l','r']){ const d=bpos(kicker,'hand_'+h).distanceTo(bpos(tgt,'hand_'+w)); if(!best||d<best.d) best={ d,h,w }; }
            kicker.V.setIK(best.h,(v)=>{ bpos(tgt,'hand_'+best.w,v); return v.lerp(bpos(tgt,'lowerarm_'+best.w,V3()),0.3); },{ rate:6, w:0.85 }); D.pullP.then(()=>{ kicker.V.setIK(best.h,null); }); },350);
          if(p2){ p2.V.lookAt((v)=>tgt.V.headPos(v)); act(p2,'argue',{ then:null }); }
          if(!skipping) track(...frameTwo(kicker,tgt,{ dir:diag, dist:3.6, h:1.4, ty:1.0 }),40,2.5);
          await gwait(400); }
        break; }
      case 'escort': {
        const tgt=C(e.who); if(!tgt) break; const D=dirs.drag||{}; const crowd=(e.crowd||[]).map(C).filter(c=>c&&c.state==='crowd');
        if(D.pullP) await race(D.pullP,2200);
        W.openDoor(tgt.id,false);
        const d=tgt.house.door; const dir=V3(-d.x,0,-d.z).normalize(); const sdv=V3(dir.z,0,-dir.x);
        const pullers=[D.kicker,D.p2].filter(c=>c&&c.state==='crowd');
        for(const c of pullers){ c.gest=null; c.V.fixed=false; }
        // sürükleme: iki kişi kollarından, sanık geriye yaslanmış
        const tok=startDrag(tgt,pullers,dir,1.05);
        crowd.filter(c=>!pullers.includes(c)).forEach((c,i)=>{ own(c); calm(c); c.V.fixed=false; c.V.lookAt((v)=>tgt.V.headPos(v)); const p=tgt.V.holder.position.clone().addScaledVector(dir,3.6-i*0.7).addScaledVector(sdv,(i%2?1:-1)*1.3); walk(c,p.x,p.z,{ speed:1.15 }); });
        if(!skipping && pullers[0]) track(...frameTwo(tgt,pullers[0],{ dir:dir.clone().multiplyScalar(0.78).addScaledVector(sdv,0.62).normalize(), dist:4.6, h:2.1, ty:0.95 }),40,3);
        await gwait(3600);
        stopDrag(tok);
        // KESME: meydan — sanık ortaya sürüklenir ve bırakılınca sırtüstü düşer
        if(!skipping) await dip(220);
        for(const c of crowd){ if(pullers.includes(c)) continue; own(c); calm(c); c.state='square'; c.V.lookAt(null); c.V.fixed=false; c.V.place(c.spot.x,c.spot.z,c.spot.yaw); show(c); }
        await toSquare(alive().filter(c=>c.state==='home'),{ instant:true });
        const A=LAYOUT.ACCUSED; const f2=V3(0,0,1); const p0=V3(A.x,0,A.z-2.6);
        own(tgt); tgt.V.place(p0.x,p0.z,0); for(const c of pullers){ c.V.place(p0.x,p0.z+0.9,0); }
        const tok2=startDrag(tgt,pullers,f2,1.0);
        lookAllAt(tgt);
        if(!skipping){ if(pullers[0]) track(...frameTwo(tgt,pullers[0],{ away:V3(1,0,0.35), dist:4.2, h:1.35, ty:0.9, lead:V3(0,0,0.6) }),40,3); else cam(V3(A.x+3.6,1.35,A.z+1.5),V3(A.x,0.85,A.z-1.1),42,0,0.06); undip(300); }
        await gwait(1700);
        stopDrag(tok2);
        if(skipping){ for(const c of pullers){ calm(c); c.state='square'; c.V.fixed=false; c.V.place(c.spot.x,c.spot.z,c.spot.yaw); } tgt.state='accused'; tgt.V.place(A.x,A.z,0); }
        else {
        // bırakınca geriye düşer (komik), kalabalık güler, kalkar
          if(!skipping){ const q=tgt.V.holder.position; cam(V3(q.x+3.3,1.15,q.z+1.2),V3(q.x,0.55,q.z-0.3),42,0,0.06); }
          const fi=CI('fall_back'); tgt.V.fixed=true; tgt.V.mocap('fall_back',{ fade:0.12, lockYaw:false });
          for(const c of pullers){ c.V.fixed=false; c.state='square'; c.V.walkTo(c.V.holder.position.x+(c.side||1)*0.9,c.V.holder.position.z+0.7,{ speed:1.1, face:Math.PI }); }
          await gwait(((fi&&fi.ev.impact)||1)*1000);
          sfx('bodyFall'); W.shake(0.1); FXS.dust(tgt.V.holder.position.clone().setY(0.15),16,0.8);
          setTimeout(()=>sfx('laugh'),250);
          setTimeout(()=>{ if(!skipping){ const q=tgt.V.holder.position; cam(V3(q.x+0.6,2.3,q.z+5.2),V3(q.x,0.8,q.z-2.4),46,0,0.08); } },900);
          for(const c of inSquare().filter(c=>!pullers.includes(c)).sort(()=>Math.random()-.5).slice(0,3)) act(c,pick(['laugh1','laugh2','laugh3','laugh4']),{ then:'idle' });
          for(const c of pullers) setTimeout(()=>{ if(c.state==='square'){ act(c,pick(['laugh2','laugh3']),{ then:null }).then(()=>{ if(c.state==='square'){ c.V.fixed=false; walk(c,c.spot.x,c.spot.z,{ face:c.spot.yaw }); } }); } },900);
          await gwait(((fi?.dur||3.2)-((fi&&fi.ev.impact)||1))*1000*0.7);
          tgt.state='accused'; tgt.V.fixed=false; await tgt.V.once('LayToIdle'); tgt.V.place(tgt.V.holder.position.x,tgt.V.holder.position.z,0);
        }
        tgt.V.fixed=true; tgt.V.mocap('scared',{ inPlace:true, lockYaw:true, loop:true, fade:.4 });
        camLock=false; bars(false); lastSpk=null; dirs.drag=null; await wait(300);
        break; }
      case 'release': {
        const c=C(e.who); if(c){ own(c); calm(c); c.V.fixed=false; c.V.setPose(null); c.state='square'; lookAllAt(null); await walk(c,c.spot.x,c.spot.z,{ face:c.spot.yaw }); } break; }
      case 'lock': { const c=C(e.who); if(c && c.V.holder.visible) W.label('l:'+e.who,`<div class="lk">🔒${e.v==='hang'?'🪢':'🕊️'}</div>`,headPos(c)); break; }

      /* ===== darağacı: iki bekçi götürür, tabure, ilmek ===== */
      case 'stool': {
        camLock=true; bars(true); W.unlabelAll('l:'); lookAllAt(null); dirs.mute=new Set(['thud','creak','kick','evil']);
        const c=C(e.who); if(!c) break; phase('dusk',4);
        const k=freeNoose(1);
        const near=inSquare().filter(o=>o!==c).sort((a,b)=>a.V.holder.position.distanceTo(GAL.group.position)-b.V.holder.position.distanceTo(GAL.group.position));
        const ex=near[0]||null; dirs.exec=ex; const guards=near.slice(1,3);
        // 1) bekçiler kollarından tutup götürür (korkak yürüyüş)
        const stairs=GAL.group.localToWorld(V3(-1.55,0,3.1)); const from=c.V.holder.position.clone(); const dir=stairs.clone().sub(from).setY(0).normalize();
        if(!skipping && guards.length){
          own(c); calm(c); c.V.fixed=false; c.state='walkHang'; c.V.afterUpdate=()=>c.V.holder.updateMatrixWorld(true);
          const yaw=yawOf(dir), rt=rightOf(yaw); c.V.place(from.x,from.z,yaw); c.V.walkClip0=c.V.walkClip; c.V.walkClip='walk_scared';
          const go=c.V.holder.position.clone().addScaledVector(dir,2.6); c.V.walkTo(go.x,go.z,{ speed:0.62 });
          guards.forEach((g,i)=>{ own(g); calm(g); const s=i?-1:1; g.state='guard'; updateAfter(g); g.V.fixed=false;
            const hand=s>0?'l':'r'; const arm=s>0?'r':'l';
            g.V.setIK(hand,(v)=>{ bpos(c,'upperarm_'+arm,v); return v.lerp(bpos(c,'lowerarm_'+arm,V3()),0.55); },{ rate:4, pole:(v)=>v.copy(g.V.holder.position).addScaledVector(rt,s*0.8).setY(0.5) });
            g.offs.push(W.tick(()=>{ if(g.state!=='guard') return; const q=c.V.holder.position.clone().addScaledVector(rt,s*0.58).addScaledVector(dir,0.08); g.V.holder.position.set(q.x,0,q.z); g.V.yaw=yaw; if(g.V.curName!=='Walk_Loop') g.V.play('Walk_Loop',{ fade:.3, speed:0.62/1.3 }); })); });
          const m=from.clone().addScaledVector(dir,1.2); const n=V3(-dir.z,0,dir.x);
          track(...frameTwo(guards[0],c,{ dir:dir.clone().multiplyScalar(0.72).addScaledVector(n,0.69).normalize(), dist:4.4, h:1.6, ty:1.05 }),40,3);
          await gwait(3000);
          for(const g of guards){ calm(g); g.state='square'; g.V.place(g.spot.x,g.spot.z,g.spot.yaw); }
          c.V.walkClip=c.V.walkClip0||'Walk_Loop'; calm(c); c.V.stop();
          await dip(220);
        }
        // 2) KESME: taburenin üstünde, dizleri titriyor
        standOnStool(c,k); c.V.mocap('shiver',{ fade:0, inPlace:true, lockYaw:true, loop:true });
        lookAllAt(c);
        if(ex){ own(ex); calm(ex); const p=GAL.group.localToWorld(V3(GAL.hangX[k]-0.15,0,GAL.z-0.62)); ex.V.place(p.x,p.z,LAYOUT.GALLOWS.rot); ex.V.holder.position.y=GAL.platformY; ex.state='exec'; ex.V.lookAt((v)=>c.V.headPos(v)); }
        const x=GAL.hangX[k];
        if(!skipping){ camG(V3(x+0.9,GAL.platformY+2.05,GAL.z+2.4),V3(x,GAL.platformY+2.05,GAL.z),38,0,0.06); undip(320); }
        // 3) ilmek başından geçirilip boynuna iner
        if(ex && !skipping){ act(ex,'noose',{ then:'idle' }); const Lend=pivots[k].L; const Lhi=Lend-0.55;
          ex.V.setIK('l',(v)=>GAL.noose[k].getWorldPosition(v).add(V3(0.1,0.02,0)),{ rate:3 }); ex.V.setIK('r',(v)=>GAL.noose[k].getWorldPosition(v).add(V3(-0.1,0.02,0)),{ rate:3 });
          setNoose(k,Lhi); await gwait(700); camMv(GAL.group.localToWorld(V3(x+0.55,GAL.platformY+2.1,GAL.z+1.6)),GAL.group.localToWorld(V3(x,GAL.platformY+2.05,GAL.z)),{ dur:2.2, fov:36 });
          await tween(1300,(t)=>setNoose(k,Lhi+(Lend-Lhi)*(t*t*(3-2*t))));
          ex.V.setIK('l',null); ex.V.setIK('r',null); sfx('gulp'); await gwait(350); }
        else if(!skipping) await wait(500);
        break; }
      case 'hang': {
        const c=C(e.who); if(!c) break; camLock=true; bars(true);
        if(e.final){ finalK++; if(!skipping && finalK===1){ SH.gallows(); } standOnStool(c,freeNoose(1)); await wait(500); }
        if(c.state!=='stool') standOnStool(c,freeNoose(1)); const k=c.hangK; const x=GAL.hangX[k];
        const ex=dirs.exec;
        if(ex && !e.final){
          // cellat yan arkadan tabureye tekme atar
          const info=CI('kick_front'); const stoolW=GAL.group.localToWorld(V3(x,0,GAL.z));
          const dL=V3(k===2?-0.55:0.55,0,0.84).normalize(); const dW=dL.clone().applyAxisAngle(V3(0,1,0),LAYOUT.GALLOWS.rot);
          const anc=anchorForHit(stoolW,yawOf(dW),info.ev.hitPos||[0,0,1],ex.V.scale);
          const back=V3(anc.x,0,anc.z); calm(ex); ex.V.lookAt(null); ex.V.place(back.x-dW.x*0.25,back.z-dW.z*0.25,yawOf(dW)); ex.V.holder.position.y=GAL.platformY;
          if(!skipping){ camG(V3(x+3.2,GAL.platformY+1.15,GAL.z+2.6),V3(x,GAL.platformY+0.95,GAL.z),44,0,0.04); }
          ex.V.mocap('kick_front',{ anchor:anc, fade:0.2, then:'idle' });
          await gwait((info.ev.hit||1.45)*1000-60);
          slowmo(0.22,750,650); kickStool(k,dL,1); sfx('kickWood'); W.shake(0.07); FXS.splinters(GAL.group.localToWorld(V3(x,GAL.platformY+0.3,GAL.z)),10);
          await gwait(60);
        } else { kickStool(k,V3(0.3,0,1).normalize(),0.6); sfx('thud'); }
        if(!skipping && !e.final) camMv(GAL.group.localToWorld(V3(x+2.4,GAL.platformY+1.9,GAL.z+3.0)),GAL.group.localToWorld(V3(x,GAL.platformY+1.7,GAL.z)),{ dur:2.4, fov:42 });
        await drop(c,k,!!e.vamp);
        if(e.vamp){ c.alive=true; } else { c.alive=false; }
        normalTime();
        if(e.vamp && !e.final){ if(!dirs.galLight){ dirs.galLight=new THREE.PointLight(0xffa860,0,10,1.5); W.scene.add(dirs.galLight); } dirs.galLight.position.copy(GAL.group.localToWorld(V3(x+1.6,GAL.platformY+2.6,GAL.z+2.2))); const L=dirs.galLight; tween(skipping?0:600,(t)=>{ L.intensity=12*t; }); }
        if(!e.final){ // kalabalık tepkisi + kısa kalabalık çekimi
          const watchers=inSquare().sort(()=>Math.random()-.5);
          for(const o of watchers) o.V.lookAt((v)=>c.V.headPos(v));
          if(e.vamp){ watchers.slice(0,3).forEach(o=>act(o,'scared',{ then:'idle' })); }
          else { watchers.slice(0,2).forEach(o=>act(o,'cry',{ then:'idle' })); watchers.slice(2,3).forEach(o=>o.V.once('Idle_No_Loop')); }
          if(!skipping && watchers.length){ await gwait(1300); const g=GAL.group.position; const mid=watchers.reduce((a,o)=>a.add(o.V.holder.position),V3()).divideScalar(watchers.length);
            const d=V3(g.x-mid.x,0,g.z-mid.z).normalize(); cam(mid.clone().addScaledVector(d,4.2).add(V3(0,1.75,0)),mid.clone().add(V3(0,1.45,0)),40,0,0.06); await gwait(1500); } }
        if(!e.final && ex){ await gwait(500); const back=GAL.group.localToWorld(V3(x+1.6,0,GAL.z+0.7)); calm(ex); ex.V.place(back.x,back.z,LAYOUT.GALLOWS.rot-Math.PI/2); ex.V.holder.position.y=GAL.platformY; }
        if(!skipping && e.vamp) camG(V3(x+1.2,GAL.platformY+1.9,GAL.z+2.4),V3(x,GAL.platformY+1.6,GAL.z),38,0,0.05);
        else if(!skipping && !e.final){ camG(V3(x+2.6,GAL.platformY+1.2,GAL.z+5.2),V3(x,GAL.platformY+1.9,GAL.z),44,0,0.06); camMv(GAL.group.localToWorld(V3(x+1.9,GAL.platformY+1.3,GAL.z+4.2)),GAL.group.localToWorld(V3(x,GAL.platformY+1.9,GAL.z)),{ dur:6, fov:42 }); }
        await gwait(e.vamp?600:1500); break; }

      /* ===== asılı vampire tekme ===== */
      case 'kick': {
        const c=C(e.who), by=C(e.by); if(!c||!by) break; const k=c.hangK>=0?c.hangK:1; const pv=pivots[k]; const x=GAL.hangX[k];
        const n=dirs.kickN++; const clip=['kick_front2','kick_front','kick_door'][n%3]; const info=CI(clip);
        // hedef: bedenin kalçası (ayak yüksekliği klipten gelir, yatayda isabet)
        const hip=bpos(c,'pelvis'); const dL=V3((n%2?-0.35:0.35),0,-1).normalize(); const dW=dL.clone().applyAxisAngle(V3(0,1,0),LAYOUT.GALLOWS.rot);
        const anc=anchorForHit(hip,yawOf(dW),info.ev.hitPos||[0,0,1],by.V.scale);
        own(by); calm(by); show(by); by.state='exec'; by.V.lookAt(null); by.V.place(anc.x-dW.x*0.2,anc.z-dW.z*0.2,yawOf(dW)); by.V.holder.position.y=GAL.platformY;
        if(!skipping){ const sd=(n%2?1:-1); camG(V3(x+sd*3.7,GAL.platformY+1.5,GAL.z+0.75),V3(x,GAL.platformY+1.05,GAL.z+0.6),42,0,0.05); }
        by.V.mocap(clip,{ anchor:anc, fade:0.15, then:'idle' });
        await gwait((info.ev.hit||1.4)*1000+40);
        // isabet: beden geriye savrulur, döner
        pv.vx-=1.1+Math.random()*0.3; pv.vz+=(n%2?-1:1)*0.35; pv.vt+=(Math.random()-.5)*2.2; W.shake(0.1); sfx('kick'); FXS.dust(hip.clone(),6,0.4,0x6a5a4a);
        if(n===0) slowmo(0.35,320,350);
        c.V.play('Hit_Chest',{ fade:.08, restart:true }); setTimeout(()=>{ if(c.state==='hanged') c.V.play('Idle_FoldArms_Loop',{ fade:.3 }); },520);
        await gwait(650);
        const back=GAL.group.localToWorld(V3(x+(n%2?-1.4:1.4),0,GAL.z+0.9+Math.random()*0.3)); calm(by); by.V.place(back.x,back.z,by.V.yaw); by.V.holder.position.y=GAL.platformY;
        break; }

      /* ===== kazık: yere yatırılır, tutulur, kazık elle göğsüne çakılır ===== */
      case 'impale': {
        const c=C(e.who); if(!c) break; const k=e.k||0; dirs.mute=new Set(['scream','impale','kick','thud','creak']);
        if(!skipping) await dip(280);
        layDown(c,k); c.state='staking'; c.V.setVampire(1);
        const sp=STK.spot(k); const sx=STK.x[k]; const Z=STK.spotZ;
        const helpers=inSquare().filter(o=>o!==c).sort((a,b)=>a.V.holder.position.distanceTo(STK.group.position)-b.V.holder.position.distanceTo(STK.group.position));
        const staker=helpers.find(o=>o.V.key==='demirci')||helpers[0]; const holders=helpers.filter(o=>o!==staker).slice(0,3); dirs.holders=holders.concat(staker?[staker]:[]);
        // tutanlar: iki kişi bileklerinden, biri bacaklarından
        const pinL=STK.group.localToWorld(V3(sx+0.42,0.09,Z-0.82)), pinR=STK.group.localToWorld(V3(sx-0.42,0.09,Z-0.82));
        c.V.afterUpdate=()=>c.V.holder.updateMatrixWorld(true);
        const jit=(p,s)=>(v)=>{ const t=performance.now()/1000; return v.copy(p).add(V3(Math.sin(t*7+s)*0.03*(dirs.stake?.fight??1),0,Math.cos(t*5.3+s)*0.03*(dirs.stake?.fight??1))); };
        c.V.setIK('l',jit(pinL,0),{ rate:8 }); c.V.setIK('r',jit(pinR,2),{ rate:8 });
        const kneel=[[sx+0.78,Z-0.62,-Math.PI/2,'l',pinL],[sx-0.78,Z-0.62,Math.PI/2,'r',pinR]];
        holders.forEach((h,i)=>{ own(h); calm(h); show(h); h.state='holder'; h.V.lookAt(null); updateAfter(h);
          h.offs.push(h.V.mod((dt,rot,B)=>{ rot(B.get('spine_01'),AX,0.42); rot(B.get('spine_02'),AX,0.28); rot(B.get('Head'),AX,-0.25); }));
          if(i<2){ const [hx,hz,hy,s,pin]=kneel[i]; const p=STK.group.localToWorld(V3(hx,0,hz)); h.V.place(p.x,p.z,LAYOUT.STAKES.rot+hy); h.V.fixed=true; h.V.play('Crouch_Idle_Loop',{ fade:.2 });
            h.V.setIK('l',jit(pin,0),{ rate:8 }); h.V.setIK('r',(v)=>jit(pin,1)(v).add(V3(0,0.02,0)),{ rate:8 }); h.V.lookAt((v)=>c.V.headPos(v)); }
          else { const p=STK.group.localToWorld(V3(sx,0,Z+1.05)); h.V.place(p.x,p.z,LAYOUT.STAKES.rot+Math.PI); h.V.fixed=true; h.V.play('Crouch_Idle_Loop',{ fade:.2 });
            h.V.setIK('l',(v)=>bpos(c,'calf_l',v),{ rate:6 }); h.V.setIK('r',(v)=>bpos(c,'calf_r',v),{ rate:6 }); h.V.lookAt((v)=>c.V.headPos(v)); } });
        // vampir çırpınır
        const S=dirs.stake={ k, c, staker, n:0, fight:1, spasm:0, depth:0 };
        c.offs.push(c.V.mod((dt,rot,B)=>{ S.t=(S.t||0)+dt; const t=S.t, f=S.fight, sp2=S.spasm; S.spasm=Math.max(0,S.spasm-dt*1.6);
          rot(B.get('spine_02'),AY,(0.22*Math.sin(t*5.2)+0.12*Math.sin(t*11))*f); rot(B.get('spine_01'),AX,(-0.08*Math.max(0,Math.sin(t*3.7))-0.45*sp2)*1); rot(B.get('spine_03'),AX,-0.25*sp2);
          rot(B.get('Head'),AY,0.5*Math.sin(t*4.1)*f); rot(B.get('Head'),AX,-0.5*sp2-0.12*f);
          rot(B.get('thigh_l'),AX,(0.35*Math.max(0,Math.sin(t*6.3))+0.5*sp2)*f); rot(B.get('thigh_r'),AX,(0.35*Math.max(0,Math.sin(t*6.3+2.4))+0.4*sp2)*f);
          rot(B.get('calf_l'),AX,-0.5*Math.max(0,Math.sin(t*6.3+0.6))*f); rot(B.get('calf_r'),AX,-0.5*Math.max(0,Math.sin(t*6.3+3))*f); }));
        // kazıkçı: kazığı raftan almış, vampirin yanında
        const stake=STK.stakes[k];
        if(staker){ own(staker); calm(staker); show(staker); staker.state='holder'; updateAfter(staker); staker.V.lookAt((v)=>c.V.headPos(v));
          const info=CI('chop'); S.info=info; c.V.holder.updateMatrixWorld(true); const chest=chestOf(c);
          const yawS=LAYOUT.STAKES.rot-Math.PI/2; S.anc=anchorForHit(chest,yawS,(info.ev.hitPos&&info.ev.hitPos[0])||[0,1,0.45],staker.V.scale); S.chest=chest;
          staker.V.place(S.anc.x,S.anc.z,yawS); staker.V.fixed=true; staker.V.play('Idle_Loop',{ fade:.2 });
          // kazık ellerde: iki elin ortasında, sivri ucu aşağı
          S.hold=true; staker.offs.push(W.tick(()=>{ if(!S.hold) return; const a=bpos(staker,'hand_l'), b=bpos(staker,'hand_r'); const m=a.add(b).multiplyScalar(0.5); stake.visible=true; stake.position.set(m.x,m.y-0.86,m.z); stake.rotation.set(0,0,0); }));
          // vuruş: kaldır → (çığlıkla) indir
          const top=(v,dx)=>{ const p=stake.position; return v.set(p.x,p.y+0.86,p.z).addScaledVector(rightOf(yawS),dx); };
          S.raise=()=>{ if(skipping) return; staker.V.setIK('l',null); staker.V.setIK('r',null); staker.V.mocap('chop',{ anchor:S.anc, fade:.3, at:0.6 }); };
          S.press=()=>{ staker.V.setIK('l',(v)=>top(v,-0.05),{ rate:12 }); staker.V.setIK('r',(v)=>top(v,0.05),{ rate:12 }); };
          S.strike=async()=>{ if(skipping){ S.n++; S.hold=false; S.depth=Math.min(0.26,0.12+S.n*0.05); stakeAt(k,S.chest,S.depth); return; }
            const a=staker.V.cur; const top=(info.ev.tops&&info.ev.tops[0])||1.4, hit=(info.ev.hits&&info.ev.hits[0])||1.87;
            if(staker.V.curName!=='chop'){ S.raise(); await gwait(450); }
            const cur=staker.V.cur; if(cur && cur.time>top){ cur.time=top-0.05; }
            const left=Math.max(0.12,hit-(cur?cur.time:top)); await gwait(left*1000);
            S.n++; S.hold=false; S.depth=Math.min(0.26,0.1+S.n*0.055); stakeAt(k,S.chest,S.depth); S.press();
            S.spasm=1; FXS.blood(S.chest.clone().add(V3(0,0.05,0)),V3(0,1,0),30,2.6); redFlash(S.n===1?0.85:0.6); W.shake(0.14); sfx('stake');
            if(S.n===1) slowmo(0.3,380,420);
            STK.pools[k].visible=true; const s0=STK.pools[k].scale.x||0.2; tween(2600,(t)=>STK.pools[k].scale.setScalar(Math.max(0.2,s0+(Math.min(1,0.35*S.n)-s0)*t)));
            if(S.n>=3){ setTimeout(()=>finishStake(),900); } else setTimeout(()=>{ if(dirs.stake===S) S.raise(); },1100); };
        } else { S.strike=async()=>{ S.n++; stakeAt(k,chestOf(c),0.2); S.spasm=1; sfx('stake'); FXS.blood(chestOf(c),V3(0,1,0),24,2.4); if(S.n>=3) finishStake(); }; }
        S.cheer=()=>{ for(const h of dirs.holders){ setTimeout(()=>{ if(h.state==='holder'){ calm(h); h.V.fixed=false; h.V.lookAt(null); act(h,pick(['happy','happy2','laugh2']),{ then:null }); } },300+Math.random()*700); } };
        function finishStake(){ const st=dirs.stake; if(!st) return; tween(2200,(t)=>{ st.fight=1-t; c.V.setVampire(1-t); }); c.V.setIK('l',null,{}); c.V.setIK('r',null,{}); c.V.setPose('impaled');
          let n=0; const iv=setInterval(()=>{ FXS.ash(chestOf(c),4); if(++n>40) clearInterval(iv); },90); sfx('evilDie'); }
        // çekim: yandan, alçak
        if(!skipping){ camS(V3(sx-1.7,2.5,Z+2.9),V3(sx+0.05,0.35,Z-0.25),42,0,0.06); camMv(STK.group.localToWorld(V3(sx-1.3,2.2,Z+2.3)),STK.group.localToWorld(V3(sx+0.05,0.35,Z-0.25)),{ dur:6, fov:40 }); undip(320); }
        // sahne ışığı (meşale gibi sıcak)
        if(!S.light){ S.light=new THREE.PointLight(0xffa050,0,9,1.6); W.scene.add(S.light); } const lp=STK.group.localToWorld(V3(sx-0.9,2.3,Z+0.9)); S.light.position.copy(lp); tween(500,(t)=>{ S.light.intensity=14*t; });
        S.raise&&setTimeout(()=>{ if(dirs.stake===S && staker) S.raise(); },400);
        c.alive=false;
        await gwait(600); break; }
      case 'fangs': { const c=C(e.who); if(!c) break; if(c.state!=='square'){ await toSquare([c]); } c.V.setVampire(1); c.V.once('Spell_Simple_Enter'); break; }
      case 'pause': await wait(e.ms||600); break;
    }
  }
  let finalK=0;

  async function run(){
    if(busy) return; busy=true;
    while(queue.length){ const e=queue.shift(); try{ await apply(e); }catch(err){ console.error('3B sahne hatası',e.t,err); } }
    normalTime(); untrack(); bars(false); veil.style.opacity='0'; flash.style.opacity='0';
    // kazık sahnesini kapat
    if(dirs.stake){ const S=dirs.stake; const c=S.c; S.hold=false; if(S.light){ const L=S.light; tween(skipping?0:1500,(t)=>{ L.intensity=14*(1-t); }).then(()=>W.scene.remove(L)); } if(c.state==='staking'){ c.state='impaled'; calm(c); c.V.setVampire(0); c.V.setPose('impaled'); W.setMourning(c.id,true,false); if(!STK.stakes[S.k].visible){ c.V.holder.updateMatrixWorld(true); stakeAt(S.k,chestOf(c),0.2); } STK.pools[S.k].visible=true; } dirs.stake=null; }
    dirs.mute=new Set();
    if(dirs.galLight){ const L=dirs.galLight; dirs.galLight=null; tween(skipping?0:1200,(t)=>{ L.intensity=12*(1-t); }).then(()=>W.scene.remove(L)); }
    // tutanları / cellatı / bekçileri meydana geri al
    for(const c of [...cast.values()]){ if(c.state==='holder'||c.state==='exec'||c.state==='guard'||c.state==='crowd'||c.state==='walkHang'){ calm(c); c.gest=null; c.V.fixed=false; c.V.holder.position.y=0; c.state='square'; c.V.place(c.spot.x,c.spot.z,c.spot.yaw); } }
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
    skip(){ if(!busy) return; skipping=true; normalTime(); untrack(); try{ speechSynthesis.cancel(); }catch(e){} for(const w of [...wakes]) w(); },
    get busy(){ return busy; },
    /** kalıcı durum: {id:{dead|hanged,hangK|impaled,stakeK}} */
    sync(vs){
      for(const c of cast.values()){ const s=vs[c.id]||{};
        if(s.impaled){ if(c.state!=='impaled'||c.stakeK!==s.stakeK) onStake(c,s.stakeK||0,{ instant:true }); c.alive=false; W.setMourning(c.id,true); }
        else if(s.hanged){ if(c.state!=='hanged'){ hangInstant(c,freeNoose(1)); } c.alive=false; W.setMourning(c.id,true); }
        else if(s.dead){ if(c.state!=='dead' && c.state!=='hanged') setDead(c); c.alive=false; }
        else if(c.state==='hanged' && c.alive){ /* asılı vampir — kazığa gidecek */ }
      }
      stoolsReset();
    },
    reset(){ queue=[]; skipping=false; normalTime(); },
    setMode(m){ if(m===mode){ refreshLabels(); return; } mode=m; applyMode(); },
    setCandidates(ids){ candidates=ids&&ids.length?ids:null; refreshLabels(); },
    highlight(id,on){
      W.unringAll('sel'); selId=on?id:null; refreshLabels(); if(!on||!id) return; const c=C(id); if(!c) return;
      if(c.state==='square'||c.state==='accused'){ W.ringAt('sel',(v)=>v.copy(c.V.holder.position)); }
      else if(c.house){ W.ringAt('sel',(v)=>v.copy(c.house.door),0xffc457,1.6); if(!busy && (mode==='select'||mode==='night')){ const h=c.house; const out=V3(-h.door.x,0,-h.door.z).normalize(); const sd=V3(out.z,0,-out.x); W.setFrameShift(0.12); camMv(h.door.clone().addScaledVector(out,10).addScaledVector(sd,1.2).add(V3(0,4.2,0)), h.door.clone().add(V3(0,2.0,0)),{ dur:1.4, fov:50 }); } }
    },
    focusVillage(){ SH.crane(); },
    dispose(){ for(const c of cast.values()) W.removeActor(c.V); if(shadow) W.removeActor(shadow.V); FXS.dispose(); for(const el of [barT,barB,veil,flash]) el.remove(); W.unlabelAll(''); W.unringAll(''); },
  };
}
