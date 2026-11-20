/* =====================================================================
   ARKADAŞLARLA OYNA — köy akışı (host mantığı + köy sahneli ekranlar)
   index.html bağlantı/lobi işini yapar, oyun içini bu modül yönetir.
   ===================================================================== */
import * as SC from './scenes.js';
import * as BT from './bots.js';
import * as RL from './rules.js';
export { BOT_LEVELS, BOT_NAMES, BOT_NAMES_F } from './bots.js';
import { createVillage } from './village.js';
import { createScene } from './scene.js';
import * as LN from './lines.js';
import SFX from './sfx.js';
import { stageWanted, stage3d, hideStage, loadingHTML, setRenderPref } from './stage-prefs.js';
import { createSpeaker, prefetchLines, loadVoices, setSpeechRate } from './voice.js';
import * as UB from './ui-bits.js';

export const unlockAudio=()=>SFX.unlock();
export const ROLE_INFO = RL.ROLES; export const ROLES=RL.ROLES; export const rolesFor=RL.rolesFor;
const MIN_PLAYERS=4; export const MAX_PLAYERS=16;
const DEF_SEC=40, SEL_SEC=45, FIN_SEC=40, NIGHT_SEC=45, DUEL_SEC=20;
const P=(S,id)=>S.players.find(p=>p.id===id);
const alive=(S)=>S.players.filter(p=>p.alive);
const shuffle=(a)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const pickR=(a)=>a[Math.floor(Math.random()*a.length)];
/** bot ya da yerine bot geçmiş (bağlantısı kopmuş) oyuncu */
const auto=(p)=>!!(p&&(p.bot||p.away||p.connected===false));
/** az kişi kalınca süreler kısalır */
const secs=(S,n)=>Math.round(n*(alive(S).length<=4?0.6:1));

/* =================== HOST =================== */
export function newGameFields(S){
  Object.assign(S,{ phase:'lobby', day:0, roleAck:{}, night:null, lastNight:null, lastVote:null, winner:null, timerEnd:null,
    act:0, evs:[], vstate:{}, sel:{}, accused:null, defense:null, fin:{}, pleaded:false, hangCount:0, stakeCount:0, gameId:(S.gameId||0),
    clues:[], hist:[], event:null, nightEvent:null, usedEvents:[], tally:RL.newTally(), dragCount:0, execCount:0, vampExec:0,
    insp:{}, priv:{}, duel:null, pendingClue:null, gossip:null, gate:null, ghostW:{}, bets:{}, deliWon:null, vampFriends:[] });
}
function startAct(S){ S.act=(S.act||0)+1; S.evs=[]; }
function ev(S,e){ e.day=S.day; S.evs.push(e); RL.tallyEvent(S.tally,e); }
function say(S,p,text,kind='talk'){ ev(S,{ t:'say', who:p?p.id:null, name:p?p.name:'Anlatıcı', title:p?.title||'', avatar:p?p.avatar:'🌙', pitch:p?.pitch||1, arch:p?.arch||null, text, voice:LN.spokenFor(text), kind }); }
function narr(S,text){ ev(S,{ t:'narr', who:null, name:'Anlatıcı', avatar:'🌙', text, voice:LN.spokenFor(text), kind:'narr' }); }
const RS=LN.regSpoken;
function sfx(S,name){ ev(S,{t:'sfx',name}); }
/** botlar için gecikmeli iş: aşama/gün değişmişse iptal */
function later(S,ctx,ms,fn){ const ph=S.phase, day=S.day, gid=S.gameId; const run=()=>{ if(S.phase!==ph||S.day!==day||S.gameId!==gid) return; fn(); ctx.broadcast(); };
  if(ctx.later) ctx.later(ms,run); else setTimeout(run,ms); }
/** sahne bitince ilerle: oyuncuların yarıdan fazlası "hazır" olunca ya da süre dolunca (testte hemen) */
const GATES=new WeakMap();
function gate(S,ctx,fn,maxMs=90000,minMs=0){
  if(ctx.instant){ S.gate=null; fn(); return; }
  const act=S.act, ph=S.phase, gid=S.gameId, t0=Date.now(); const G=S.gate={ act, ready:{} }; S.timerEnd=null;
  const go=()=>{ if(S.phase!==ph||S.gameId!==gid||S.gate!==G) return; S.gate=null; GATES.delete(S); fn(); ctx.broadcast(); };
  // çoğunluk "izledim" dese bile sonucu okuyacak kadar bekle (minMs)
  const soft=()=>{ const left=minMs-(Date.now()-t0); if(left>150){ if(!G.soon){ G.soon=1; setTimeout(go,left); } } else go(); };
  GATES.set(S,soft); ctx.armTimer(Date.now()+maxMs,go);
}
function openGate(S){ const go=GATES.get(S); if(go) go(); }
const observe=(S,o)=>{ try{ BT.botsObserve(S,o); }catch(e){} };
const io=(S)=>({ say:(p,t,k)=>say(S,p,t,k), narr:(t)=>narr(S,t), sfx:(n)=>sfx(S,n), ev:(e)=>ev(S,e), rnd:Math.random });
function vstate(S){ const s={}; const hanged=S.players.filter(p=>p.fate==='hanged').sort((a,b)=>a.hangOrder-b.hangOrder).slice(-3);
  for(const p of S.players){ if(p.fate==='impaled') s[p.id]={impaled:true,stakeK:p.stakeK,ash:!!p.ash}; else if(p.fate==='hanged'&&hanged.includes(p)) s[p.id]={hanged:true,hangK:hanged.indexOf(p)}; else if(!p.alive) s[p.id]={dead:true}; }
  S.vstate=s; }
const speaker=(S,ex=[])=>{ const c=alive(S).filter(p=>!ex.includes(p)); return c.length?pickR(c):null; };
const muhtar=(S)=>alive(S).find(p=>p.title==='Muhtar')||speaker(S);
const NEG=new Set([LN.ACCUSE, LN.ACCUSE_HERD, LN.SEER_VAMP, LN.COUNTER_SEER, LN.RESPONSE_DOUBT]);
const line=(arr,m)=>LN.fillT(LN.pick(arr),m||{},NEG.has(arr));
const tellBy=(S)=>{ const m=muhtar(S); return (t)=>{ if(m) say(S,m,t); else narr(S,t); }; };
const today=(S)=>S.hist[S.hist.length-1]||null;
/* kadın karakter tipleri (odalı mod, karışık kadro) */
const FEMALE_ARCH=[ { key:'kadin1', title:'Teyze', pitch:1.4 }, { key:'kadin2', title:'Gelin', pitch:1.35 }, { key:'kadin3', title:'Nine', pitch:1.5 } ];
const M_AV=['👨','👴','🧔','👨‍🦱','👨‍🦳','🧑','👨‍🌾','👲','🧓','👱‍♂️','👨‍🦰','🤵','🧑‍🌾','👷‍♂️','🧑‍🦲','🤠'];
const F_AV=['👩','👵','👱‍♀️','👩‍🦰','👩‍🦳','🧕','👩‍🌾','👩‍🦱','👩‍🍳'];

export function hostStart(S){
  const n=S.players.length; if(n<MIN_PLAYERS) return false;
  const extras=S.settings?.extras!==false;
  const sh=shuffle(RL.rolesFor(n,{ extras })); const mav=shuffle(M_AV), fav=shuffle(F_AV); const arch=[LN.ARCHETYPES[0], ...shuffle(LN.ARCHETYPES.slice(1))]; const farch=shuffle(FEMALE_ARCH);
  const allMale=(S.settings?.cast||'mixed')==='male';
  let mi=0, fi=0; const order=shuffle(S.players.map((_,i)=>i));
  for(const i of order){ const p=S.players[i]; p.role=sh[i]; p.alive=true; p.fate=null; p.hangOrder=null; p.stakeK=null; p.claimed=null; p.lover=null; p.guardLog=null; p.ash=false; p.lastSeerTarget=null; p.lastSeerClean=null; p._lastTalk=0; p._lastFx=0;
    const g=allMale?'m':(p.gender==='f'?'f':'m'); p.sex=g;
    if(g==='f'){ const a=farch[fi%farch.length]; p.arch=a.key; p.title=a.title; p.pitch=a.pitch; p.avatar=fav[fi%fav.length]; fi++; }
    else { const a=arch[mi%arch.length]; p.arch=a.key; p.title=a.title; p.pitch=a.pitch; p.avatar=mav[mi%mav.length]; mi++; } }
  const gid=(S.gameId||0)+1; newGameFields(S); S.gameId=gid;
  RL.pickLovers(S.players,Math.random,{ extras });
  S.phase='roles'; startAct(S);
  for(const p of S.players) if(p.bot){ p.connected=true; S.roleAck[p.id]=true; }
  BT.botsReset(S); S.prevAccusers=[]; S.accusedBy={}; S.defendedBy={};
  return true;
}
export function hostHandle(S,a,ctx){
  const p=P(S,a.from);
  switch(a.type){
    case 'ackRole': if(S.phase==='roles'){ S.roleAck[a.from]=true; if(S.players.every(x=>S.roleAck[x.id]||auto(x))) toOpening(S,ctx); } break;
    case 'ready': if(S.gate&&a.act===S.gate.act&&p){ S.gate.ready[p.id]=1; const hs=S.players.filter(x=>!auto(x)); const n=hs.filter(x=>S.gate.ready[x.id]).length; if(n>=hs.length||n>hs.length/2) openGate(S); } break;
    case 'select': if(S.phase==='select'&&p&&p.alive&&a.target!==p.id&&P(S,a.target)?.alive&&(!S.duel||S.duel.includes(a.target))){ S.sel[p.id]=a.target; if(alive(S).every(x=>S.sel[x.id])) resolveSelect(S,ctx); } break;
    case 'defense': if(S.phase==='defense'&&a.from===S.accused) doDefense(S,a,ctx); break;
    case 'talk': humanTalk(S,p,a,ctx); break;
    case 'inspect': if(p&&p.alive&&(S.phase==='dawn'||S.phase==='discussion')){ const c=S.clues.find(x=>x.id===a.clue); const mine=(S.insp[p.id] ||= {}); const lim=S.event==='pazar'?2:1; if(c&&!mine[c.id]&&Object.keys(mine).length<lim) mine[c.id]=RL.inspectClue(c,Math.random,p.role==='kahin'?0.85:0.75); } break;
    case 'react': if(p&&p.alive&&LN.REACT[a.k]&&['discussion','select','defense','final'].includes(S.phase)&&!S.gate){ const now=Date.now(); if((p._lastFx||0)>now-5000) break; p._lastFx=now; say(S,p,LN.REACT[a.k],'react'); } break;
    case 'ghost': ghostAct(S,p,a,ctx); break;
    case 'intervene': if(S.phase==='final'&&p&&p.alive&&p.id!==S.accused&&!(S.ivd||={})[p.id]){ S.ivd[p.id]=1; const acc=P(S,S.accused); const k=a.kind==='support'?'support':'refute'; say(S,p,LN.fillT(LN.pick(LN.INTERVENE[k]),{t:acc.name})); applyObs(S,[{ t:k==='support'?'defend':'accuse', from:p.id, to:acc.id, pow:0.6 }]); ev(S,{ t:'stance', marks:BT.botStance(S,acc,1) }); } break;
    case 'final': if(S.phase==='final'&&p&&p.alive&&p.id!==S.accused&&!S.fin[p.id]&&(a.v==='hang'||a.v==='release')) lockVote(S,p,a.v,ctx); break;
    case 'night': if(S.phase==='night'&&p&&p.alive) nightAction(S,p,a.k,a.target,ctx); break;
    case 'next': if(a.from===S.hostId) hostNext(S,ctx); break;
  }
}
export function hostNext(S,ctx){
  ctx.clearTimer(); S.gate=null; GATES.delete(S);
  switch(S.phase){
    case 'roles': toOpening(S,ctx); break;
    case 'opening': toNight(S,ctx,true); break;
    case 'discussion': toSelect(S,ctx); break;
    case 'select': resolveSelect(S,ctx); break;
    case 'defense': if(S.defStep===2) defense2(S,{ i:1 },ctx); else if(S.defStep===3) defense3(S,{ key:'forgive' },ctx); else doDefense(S,{ key:auto(P(S,S.accused))?'bot':'silent' },ctx); break;
    case 'final': resolveFinal(S,ctx); break;
    case 'verdict': toNight(S,ctx); break;
    case 'night': forceNight(S,ctx); break;
    case 'dawn': toDiscussion(S,ctx); break;
  }
}
/** bağlantı takibi: kopanın yerine bot oynar, dönünce yerini geri alır (index.html birkaç saniyede bir çağırır) */
export function hostTick(S,ctx,now=Date.now()){
  if(!S||S.phase==='lobby'||S.phase==='end') return; let ch=false;
  for(const p of S.players){ if(p.bot||p.id===S.hostId) continue; const away=p.connected===false||(now-(p.seen||now))>26000; if(!!p.away!==away){ p.away=away; ch=true; } }
  if(S.phase==='roles'){ for(const p of S.players) if(auto(p)&&!S.roleAck[p.id]){ S.roleAck[p.id]=true; ch=true; } if(ch&&S.players.every(x=>S.roleAck[x.id])) toOpening(S,ctx); }
  else for(const p of alive(S)) if(p.away&&autoAct(S,p,ctx)) ch=true;
  if(ch) ctx.broadcast();
}
function autoAct(S,p,ctx){
  switch(S.phase){
    case 'select': if(!S.sel[p.id]){ botPickSelect(S,p,ctx); return true; } break;
    case 'defense': if(S.accused===p.id&&!S.gate){ if(S.defStep===2) defense2(S,{ i:1 },ctx); else if(S.defStep===3) defense3(S,{ key:'forgive' },ctx); else if(!S.defense) doDefense(S,{ key:'bot' },ctx); return true; } break;
    case 'final': if(p.id!==S.accused&&!S.fin[p.id]){ const acc=P(S,S.accused); const hangs=Object.values(S.fin).filter(v=>v==='hang').length; lockVote(S,p,BT.botFinal(S,p,acc,hangs,eligible(S).length),ctx); return true; } break;
    case 'night': if(nightNeed(S,p)){ botDoNight(S,p,ctx); return true; } break;
  }
  return false;
}

/* ---- açılış: akşam toplantısı, sonra ilk gece ---- */
function toOpening(S,ctx){
  S.phase='opening'; S.day=0; startAct(S);
  ev(S,{t:'gather'}); sfx(S,'bell');
  const cast=shuffle(alive(S)); const m=cast.find(p=>p.title==='Muhtar'); if(m){ cast.splice(cast.indexOf(m),1); cast.unshift(m); }
  for(const s of LN.OPENING){ const who=cast[s.who%cast.length]; if(s.sfx) sfx(S,s.sfx); say(S,who,LN.pick([s.text])); }
  vstate(S);
  gate(S,ctx,()=>toNight(S,ctx,true),150000);
}
/* ---- tartışma (yüz yüze) ---- */
function toDiscussion(S,ctx){
  S.phase='discussion'; startAct(S);
  ev(S,{t:'gather'}); sfx(S,'murmur');
  narr(S, S.day===1 ? 'Şimdi yüz yüze konuşun! Kim vampir olabilir? Herkes fikrini söylesin.' : 'Meydanda toplanıldı. Konuşun bakalım, dün gece ne oldu?');
  const sec=Math.round(secs(S,S.settings.discussionSec||90)*(S.event==='pazar'?1.35:1));
  S.timerEnd=Date.now()+sec*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='discussion'){ toSelect(S,ctx); ctx.broadcast(); } });
  S.accusedBy={}; S.defendedBy={}; S.spoke=[];
  try{ BT.botsClues(S,S.clues); }catch(e){}
  const span=Math.max(10,sec*0.72)*1000; const bs=alive(S).filter(p=>auto(p)&&p.bot);
  bs.forEach((p)=>{ const n=Math.random()<.55?2:1; for(let k=0;k<n;k++) later(S,ctx,3500+Math.random()*span,()=>botSpeak(S,p)); });
}
function botSpeak(S,p){ if(!p.alive) return; const td=new Set(S.spoke||[]); const r=BT.botTalk(S,p,td); for(const [w,t,k] of r.say) say(S,w,t,k||'talk'); applyObs(S,r.obs); (S.spoke||=[]).push(p.id); }
function applyObs(S,obs){ for(const o of obs||[]){ observe(S,o);
  if(o.t==='accuse'){ (S.accusedBy[o.to]||=[]).push(o.from); RL.tallyAccuse(S.tally,o.from,o.to); }
  if(o.t==='defend'){ (S.defendedBy[o.to]||=[]).push(o.from); RL.tallyDefend(S.tally,o.from,o.to); }
  if(o.t==='claimSeer'){ const c=P(S,o.from); if(c){ c.claimed='kahin'; if(o.isVamp) c.lastSeerTarget=o.to; else c.lastSeerClean=o.to; } }
  if(o.t==='claimDoctor'){ const c=P(S,o.from); if(c) c.claimed='doktor'; }
  if(o.t==='claimBekci'){ const c=P(S,o.from); if(c) c.claimed='bekci'; } } }
/** insanın tartışmadaki sözü (düğmeyle): sahnede seslendirilir, botlar tavır alır */
const TALK_GAP=5000;
function humanTalk(S,p,a,ctx){
  if(S.phase!=='discussion'||!p||!p.alive) return; const now=Date.now(); if((p._lastTalk||0)>now-TALK_GAP) return;
  const t=P(S,a.target); const needT=['accuse','defend','press','ally','claimBekci'].includes(a.kind); if(needT&&(!t||!t.alive||t===p)) return;
  p._lastTalk=now; (S.spoke||=[]).push(p.id);
  switch(a.kind){
    case 'accuse': { const rs=LN.ACCUSE_WHY[a.reason]?a.reason:'gut'; let truth=null, pow=1;
      if(rs==='quiet'){ truth=!(S.spoke||[]).includes(t.id); pow=truth?1.3:0.35; } else if(rs==='pushed'){ truth=(S.prevAccusers||[]).includes(t.id); pow=truth?1.5:0.4; } else if(rs==='clue'){ truth=S.clues.some(c=>c.ids.includes(t.id)); pow=truth?1.3:0.4; } else if(rs==='gut') pow=0.6;
      say(S,p,LN.fillT(LN.pick(LN.ACCUSE_WHY[rs]),{t:t.name})); applyObs(S,[{ t:'accuse', from:p.id, to:t.id, pow }]);
      for(const [w,x] of BT.botReactions(S,p,t,1,truth)) say(S,w,x); ev(S,{ t:'stance', marks:BT.botStance(S,t,1) }); break; }
    case 'defend': { const rs=LN.DEFEND_WHY[a.reason]?a.reason:'vouch'; let truth=null, pow=rs==='alibi'?1:0.85;
      if(rs==='seer'){ truth=alive(S).some(x=>x.claimed==='kahin'&&x.lastSeerClean===t.id); pow=truth?1.5:0.4; }
      say(S,p,LN.fillT(LN.pick(LN.DEFEND_WHY[rs]),{t:t.name})); applyObs(S,[{ t:'defend', from:p.id, to:t.id, pow }]);
      for(const [w,x] of BT.botReactions(S,p,t,-1,truth)) say(S,w,x); ev(S,{ t:'stance', marks:BT.botStance(S,t,-1) }); break; }
    case 'press': { say(S,p,LN.fillT(LN.pick(LN.PRESS.ask),{y:t.name}));
      if(auto(t)){ const k=BT.botPressed(S,t); say(S,t,LN.pick(LN.PRESS[k])); observe(S,{ t:'self', who:t.id, v:k==='bad'?0.9:k==='angry'?0.25:-0.3 }); } ev(S,{ t:'stance', marks:BT.botStance(S,t,1) }); break; }
    case 'ally': { say(S,p,LN.fillT(LN.pick(LN.ALLY.ask),{y:t.name})); if(auto(t)){ const ok=BT.botAlly(S,t,p); say(S,t,LN.pick(ok?LN.ALLY.yes:LN.ALLY.no)); } break; }
    case 'calm': say(S,p,LN.pick(LN.CALM)); observe(S,{ t:'self', who:p.id, v:-0.15 }); break;
    case 'oath': say(S,p,LN.pick(LN.OATH)); observe(S,{ t:'self', who:p.id, v:-0.25 }); break;
    case 'claimBekci': { const out=a.out!==false; say(S,p,LN.fillT(LN.pick(out?LN.BEKCI_SAW:LN.BEKCI_HOME),{t:t.name},out)); applyObs(S,[{ t:'claimBekci', from:p.id, to:t.id, out }]); ev(S,{ t:'stance', marks:BT.botStance(S,t,out?1:-1) }); break; }
    case 'gossip': { const g=S.gossip; if(!g||g.for!==p.id||g.said){ p._lastTalk=0; return; } g.said=true; const [x,o]=g.ids.map(id=>P(S,id)); say(S,p,LN.fillT(LN.pick(LN.GOSSIP),{t:x.name,o:o.name})); applyObs(S,[{ t:'gossip', from:p.id, ids:g.ids }]); break; }
    default: p._lastTalk=0; return;
  }
}
/* ---- hayaletler: domates, kapı tıkırdatma, bahis, fısıltı ---- */
function ghostAct(S,p,a,ctx){
  if(!p||p.alive||!p.role||S.phase==='end'||S.phase==='lobby') return; const t=P(S,a.target); const now=Date.now();
  switch(a.kind){
    case 'bet': if(t&&t!==p){ S.bets[p.id]=t.id; S.tally.bets[p.id]=t.id; } break;
    case 'tomato': if(t&&t.alive&&!S.gate&&['discussion','defense','final','verdict'].includes(S.phase)){ if((p._lastFx||0)>now-6000) break; p._lastFx=now; ev(S,{ t:'tomato', who:t.id, by:p.id }); if(Math.random()<.5) say(S,t,LN.pick(LN.TOMATO_HIT),'react'); } break;
    case 'rattle': if(t&&t.alive&&!S.gate&&['night','dawn','select'].includes(S.phase)){ if((p._lastFx||0)>now-6000) break; p._lastFx=now; ev(S,{ t:'rattle', who:t.id, by:p.id }); if(Math.random()<.5) say(S,t,LN.pick(LN.RATTLE),'inside'); } break;
    case 'whisper': if(t&&t.alive&&!S.ghostW[p.id]){ const c=RL.groupClue({ players:S.players, kind:'hayalet', id:`g${S.day}_${p.id.slice(-3)}`, rnd:Math.random }); if(!c) break; S.ghostW[p.id]=true; c.to=t.id;
        try{ BT.botsHint(S,c.ids,t.id); }catch(e){}
        if(S.phase==='dawn'||S.phase==='discussion'){ S.clues.push(c); announceClues(S,[c],()=>{}); const H=today(S); if(H) H.clues.push({ ...c }); } else S.pendingClue=c; } break;
  }
}
/* ---- ev seçimi ---- */
function toSelect(S,ctx){
  if(S.event==='dugun') return wedding(S,ctx);
  S.phase='select'; S.sel={}; S.duel=null; startAct(S);
  const t=line(LN.SELECT_INTRO); tellBy(S)(t);
  ev(S,{t:'disperse'});
  armSelect(S,ctx,secs(S,S.settings.voteSec||SEL_SEC));
}
function armSelect(S,ctx,sec){
  S.timerEnd=Date.now()+sec*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='select'){ resolveSelect(S,ctx); ctx.broadcast(); } });
  for(const p of alive(S).filter(auto)) later(S,ctx,2200+Math.random()*(S.duel?4000:9000),()=>botPickSelect(S,p,ctx));
}
function botPickSelect(S,p,ctx){ if(S.phase!=='select'||S.sel[p.id]||!p.alive) return; const tally={}; for(const v of Object.values(S.sel)) tally[v]=(tally[v]||0)+1; const t=BT.botSelect(S,p,tally,S.duel); if(!t) return; S.sel[p.id]=t.id; if(alive(S).every(x=>S.sel[x.id])) resolveSelect(S,ctx); }
/** düğün günü: kimse asılmaz, halay çekilir; halaydan kaybolan için ek ipucu */
function wedding(S,ctx){
  ctx.clearTimer(); startAct(S);
  SC.weddingScene(io(S),{ alive:alive(S) });
  const c=RL.groupClue({ players:S.players, kind:'dugun', id:`w${S.day}`, rnd:Math.random });
  if(c){ S.clues.push(c); announceClues(S,[c],tellBy(S)); const H=today(S); if(H){ H.clues.push({ ...c }); H.wedding=true; } try{ BT.botsHint(S,c.ids,null); }catch(e){} }
  S.lastVote={ wedding:true }; S.phase='verdict'; S.timerEnd=null; vstate(S);
  gate(S,ctx,()=>toNight(S,ctx),90000,5000);
}
function resolveSelect(S,ctx){
  ctx.clearTimer();
  const t={}; for(const v of Object.values(S.sel)) t[v]=(t[v]||0)+1;
  let max=0; for(const c of Object.values(t)) max=Math.max(max,c);
  let top=Object.keys(t).filter(id=>t[id]===max).map(id=>P(S,id)).filter(x=>x&&x.alive);
  if(!top.length) top=alive(S);
  // beraberlik: iki şüpheli söz düellosu yapar, köy ikisi arasında yeniden seçer
  if(max>0&&top.length>1&&!S.duel&&alive(S).length>3){
    const pair=shuffle(top).slice(0,2); startAct(S); S.duel=pair.map(p=>p.id);
    ev(S,{t:'badges',counts:t}); SC.duelScene(io(S),{ a:pair[0], b:pair[1] }); ev(S,{t:'badges',counts:{}});
    S.sel={}; S.sel[pair[0].id]=pair[1].id; S.sel[pair[1].id]=pair[0].id;
    armSelect(S,ctx,DUEL_SEC+8); return;
  }
  S.duel=null;
  const acc=pickR(top);
  startAct(S);
  ev(S,{t:'badges',counts:t});
  const voters=shuffle(Object.keys(S.sel).filter(id=>S.sel[id]===acc.id).map(id=>P(S,id))).slice(0,S.dragCount?1:2);
  for(const v of voters) say(S,v,RS(`Ben ${LN.suf(acc.name,'i')} seçtim!`,'Ben bu herifi seçtim!'));
  narr(S, max ? RS(`En çok seçilen: ${acc.name} (${max} oy). Evinden alınıp meydana getiriliyor!`,'Köy kararını verdi! Evinden alınıp meydana getiriliyor!') : RS(`Kimse seçim yapmadı… kura ${acc.name} çıktı! Meydana!`,'Kimse seçim yapmadı… Kura çekildi! Meydana!'));
  SC.dragScene(io(S),{ acc, others:alive(S).filter(p=>p!==acc), short:S.dragCount++>0 });
  ev(S,{t:'badges',counts:{}});
  S.accused=acc.id; S.selTally=t; S.defense=null; S.defStep=1; S.ivd={};
  S.phase='defense';
  narr(S,RS(`${acc.name}, söz senin. Kendini savun!`,'Söz sende. Kendini savun!'));
  // süre, sahne bittikten sonra başlar
  gate(S,ctx,()=>{ if(S.defense||S.defStep!==1) return; S.timerEnd=Date.now()+secs(S,DEF_SEC)*1000;
    ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='defense'&&S.defStep===1&&!S.defense){ doDefense(S,{key:auto(acc)?'bot':'silent'},ctx); ctx.broadcast(); } });
    if(auto(acc)) later(S,ctx,1500,()=>doDefense(S,{ key:'bot' },ctx)); },80000);
}
/* ---- savunma ---- */
function doDefense(S,a,ctx){
  if(S.defStep===2) return defense2(S,a,ctx); if(S.defStep===3) return defense3(S,a,ctx); if(S.defense) return;
  ctx.clearTimer(); S.gate=null; GATES.delete(S);
  const acc=P(S,S.accused); startAct(S);
  const others=alive(S).filter(p=>p!==acc);
  if(auto(acc) && a.key==='bot'){ const r=BT.botDefense(S,acc); for(const [w,t,k] of r.say) say(S,w,t,k||'talk'); applyObs(S,r.obs); S.defense='bot'; return askQuestion(S,acc,ctx); }
  const key=a.key==='innocent'?'witness':(a.key||'silent'); const txt=(k)=>LN.DEFENSE_OPEN.find(x=>x.key===k).text;
  switch(key){
    case 'witness': { let o=P(S,a.target); if(!o||!o.alive||o===acc) o=pickR(others); say(S,acc,LN.fillT(txt('witness'),{o:o.name})); observe(S,{ t:'self', who:acc.id, v:-0.3 });
      if(auto(o)){ const yes=BT.botWitness(S,o,acc); say(S,o,LN.pick(yes?LN.WITNESS_YES:LN.WITNESS_NO)); observe(S,{ t:'self', who:acc.id, v:yes?-0.5:0.6 }); } break; }
    case 'blame': { const t=P(S,a.target)||pickR(others); say(S,acc,RS(`Beni bırakın, asıl vampir ${t.name}! Gözlerine bakın gözlerine!`,'Beni bırakın, asıl vampir bu herif! Gözlerine bakın gözlerine!')); applyObs(S,[{ t:'accuse', from:acc.id, to:t.id, pow:0.8 }]); break; }
    case 'role': { const r=RL.ROLES[a.role]?.claim?a.role:'koylu'; acc.claimed=r;
      if(r==='koylu') say(S,acc,'Ben düz köylüyüm la, bi suçum yok! Yapmayın!'); else if(r==='doktor') say(S,acc,LN.pick(LN.HOCA_CLAIM)); else if(r==='aga') say(S,acc,LN.pick(LN.AGA_CLAIM)); else say(S,acc,LN.fillT(LN.ROLE_CLAIM,{ role:RL.ROLES[r].claim }));
      if(r==='doktor') observe(S,{ t:'claimDoctor', from:acc.id }); else if(r!=='koylu') observe(S,{ t:'claimRole', from:acc.id, role:r }); break; }
    case 'oath': say(S,acc,txt('oath')); observe(S,{ t:'self', who:acc.id, v:-0.25 }); break;
    case 'beg': say(S,acc,txt('beg')); observe(S,{ t:'self', who:acc.id, v:Math.random()<.5?-0.35:0.15 }); break;
    case 'threat': say(S,acc,txt('threat')); observe(S,{ t:'self', who:acc.id, v:Math.random()<.5?-0.3:0.4 }); break;
    default: say(S,acc,'…','quiet'); observe(S,{ t:'self', who:acc.id, v:0.2 }); S.defense='silent'; return finishDefense(S,acc,ctx);
  }
  S.defense=key; askQuestion(S,acc,ctx);
}
function askQuestion(S,acc,ctx){
  const qi=Math.floor(Math.random()*LN.DEFENSE_Q.length); const Q=LN.DEFENSE_Q[qi]; const asker=speaker(S,[acc]); if(asker) say(S,asker,Q.q); else narr(S,Q.q);
  S.defStep=2; S.defQ=qi; S.timerEnd=Date.now()+25000; ctx.armTimer(S.timerEnd,()=>{ if(S.phase==='defense'&&S.defStep===2){ defense2(S,{ i:1 },ctx); ctx.broadcast(); } });
  if(auto(acc)) later(S,ctx,2400,()=>defense2(S,{ i:(acc.role==='vampir'||acc.role==='deli')&&Math.random()<.45?2:Math.floor(Math.random()*2) },ctx));
}
function defense2(S,a,ctx){ if(S.phase!=='defense'||S.defStep!==2) return; ctx.clearTimer(); const acc=P(S,S.accused); const Q=LN.DEFENSE_Q[S.defQ]; const x=Q.a[+a.i]||Q.a[1];
  say(S,acc,x.text); observe(S,{ t:'self', who:acc.id, v:x.v>0?-0.4:x.v<0?0.5:0 });
  S.defStep=3; S.timerEnd=Date.now()+20000; ctx.armTimer(S.timerEnd,()=>{ if(S.phase==='defense'&&S.defStep===3){ defense3(S,{ key:'forgive' },ctx); ctx.broadcast(); } });
  if(auto(acc)) later(S,ctx,2000,()=>defense3(S,{ key:pickR(LN.LAST_WORD).key },ctx)); }
function defense3(S,a,ctx){ if(S.phase!=='defense'||S.defStep!==3) return; ctx.clearTimer(); const acc=P(S,S.accused); const o=LN.LAST_WORD.find(x=>x.key===a.key)||LN.LAST_WORD[0];
  say(S,acc,o.text); observe(S,{ t:'self', who:acc.id, v:a.key==='forgive'?-0.2:a.key==='warn'?-0.15:0.05 }); finishDefense(S,acc,ctx); }
function finishDefense(S,acc,ctx){ S.defStep=0;
  const resp=speaker(S,[acc]); if(resp) say(S,resp, Math.random()<.5?line(LN.RESPONSE_BELIEVE,{t:acc.name}):line(LN.RESPONSE_DOUBT,{t:acc.name}));
  toFinal(S,ctx,true); }
/* ---- son karar + kilit ---- */
function toFinal(S,ctx,keepAct){
  S.phase='final'; S.fin={}; S.pleaded=false; if(!keepAct) startAct(S);
  const acc=P(S,S.accused);
  narr(S,RS(`Son karar: ${acc.name} asılsın mı? Herkes AS ya da BIRAK desin ve oyunu kitlesin!`,'Son karar! Asılsın mı, bırakılsın mı? Herkes oyunu versin ve kitlesin!'));
  S.timerEnd=Date.now()+secs(S,S.settings.voteSec||FIN_SEC)*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='final'){ resolveFinal(S,ctx); ctx.broadcast(); } });
  for(const p of eligible(S).filter(auto)) later(S,ctx,2500+Math.random()*9000,()=>{ if(S.fin[p.id]||!p.alive) return; const hangs=Object.values(S.fin).filter(v=>v==='hang').length; lockVote(S,p,BT.botFinal(S,p,acc,hangs,eligible(S).length),ctx); });
  if(!eligible(S).length) resolveFinal(S,ctx);
}
const eligible=(S)=>alive(S).filter(p=>p.id!==S.accused);
function lockVote(S,p,v,ctx){
  if(S.phase!=='final'||S.fin[p.id]) return;
  S.fin[p.id]=v; RL.tallyFinal(S.tally,p.id,S.accused,v);
  say(S,p,`${v==='hang'?'AS':'BIRAK'}! ${LN.pick(LN.LOCK)}`);
  ev(S,{t:'lock',who:p.id,v});
  const el=eligible(S); const hangs=Object.values(S.fin).filter(x=>x==='hang').length;
  if(!S.pleaded && hangs>el.length/2){ S.pleaded=true; const acc=P(S,S.accused); say(S,acc,LN.pick(acc.role==='deli'?LN.DELI_PLEAD:LN.PLEAD)); }
  if(el.every(x=>S.fin[x.id])) resolveFinal(S,ctx);
}
function resolveFinal(S,ctx){
  if(S.phase!=='final') return;
  ctx.clearTimer(); S.timerEnd=null;
  const acc=P(S,S.accused);
  // ağanın oyu iki sayılır
  const W=(v)=>Object.entries(S.fin).filter(([,x])=>x===v).reduce((a,[id])=>a+RL.voteWeight(P(S,id)),0);
  const hang=W('hang'), rel=W('release');
  const H=today(S); if(H) Object.assign(H,{ accused:acc.id, role:acc.role, hang, rel, hanged:hang>rel, votes:{ ...S.fin } });
  startAct(S);
  narr(S,RS(`Sonuç: ${hang} AS, ${rel} BIRAK.`, hang>rel?'Oylar sayıldı. Köy AS dedi!':'Oylar sayıldı. Köy BIRAK dedi!'));
  if(hang>rel) execute(S,acc,hang,rel);
  else { ev(S,{t:'release',who:acc.id}); say(S,muhtar(S)||acc,LN.pick(LN.RELEASE)); S.lastVote={hanged:null,name:acc.name,released:true,hang,rel}; S.phase='verdict'; }
  vstate(S);
  if(!checkWin(S)) gate(S,ctx,()=>toNight(S,ctx),hang>rel?160000:40000,6000);
}
function execute(S,acc,hang,rel){
  const res=SC.executeScene(io(S),{ acc, alive:alive(S), pleaded:!!S.pleaded, short:S.execCount++>0, shortVamp:acc.role==='vampir'&&S.vampExec++>0, onStakeK:()=>{ acc.stakeK=(S.stakeCount++)%3; return acc.stakeK; } });
  { const accusers=S.accusedBy?.[acc.id]||[], voters=Object.keys(S.fin||{}).filter(k=>S.fin[k]==='hang'), defenders=S.defendedBy?.[acc.id]||[];
    observe(S,{ t:'hanged', who:acc.id, role:acc.role, accusers, voters, defenders }); if(acc.role!=='vampir') S.prevAccusers=[...accusers]; else S.vampFriends=[...new Set(defenders.filter(id=>P(S,id)?.alive&&P(S,id).role!=='vampir'))]; }
  if(acc.role==='vampir'){ acc.alive=false; acc.fate='impaled'; acc.ash=!!res.ash; }
  else {
    acc.alive=false; acc.fate='hanged'; acc.hangOrder=S.hangCount++;
    const s1=speaker(S,[acc]);
    if(acc.role==='deli'){ if(s1) say(S,s1,LN.pick(LN.DELI_WIN)); narr(S,LN.DELI_NARR); sfx(S,'laugh'); S.deliWon=acc.id; }
    else { if(s1) say(S,s1,LN.pick(LN.HANG_VILLAGER)); narr(S,LN.revealLine(acc.name,RL.ROLES[acc.role].reveal)); }
  }
  // âşığı da dayanamaz
  if(acc.lover&&!S.deliWon){ const l=P(S,acc.lover); if(l&&l.alive){ l.alive=false; l.fate='grief'; narr(S,line(LN.LOVER_DEATH,{v:l.name})); narr(S,LN.revealLine(l.name,RL.ROLES[l.role].reveal)); const H=today(S); if(H) H.griefDay=[l.id]; } }
  S.lastVote={hanged:acc.id,name:acc.name,role:acc.role,hang,rel};
  S.phase='verdict';
}
/* ---- gece: herkesin bir işi var ---- */
/** bu oyuncunun gecede sıradaki seçimi: bite | bite2 | plant | doctor | seer | guard | watch | null (bitti) */
export function nightNeed(S,p){
  const N=S&&S.night; if(!N||!p||!p.alive) return null; const id=p.id;
  switch(RL.nightKind(p.role)){
    case 'vamp': if(!N.first&&!N.vampVotes[id]) return 'bite'; if(!N.first&&N.double&&N.vamp2[id]===undefined) return 'bite2'; return N.plantV[id]===undefined?'plant':null;
    case 'doktor': if(N.first) return N.watch[id]===undefined?'watch':null; return N.doctor?null:'doctor';
    case 'kahin': return N.seer?null:'seer';
    case 'bekci': return N.guard?null:'guard';
    default: return N.watch[id]===undefined?'watch':null;
  }
}
function toNight(S,ctx,first=false){
  S.nightEvent=(!first&&(S.event==='firtina'||S.event==='dolunay'))?S.event:null;
  S.phase='night'; startAct(S);
  S.night={ first:!!first, double:S.nightEvent==='dolunay'&&RL.canDoubleBite(S.players), vampVotes:{}, vamp2:{}, plantV:{}, doctor:null, seer:null, seerResult:null, guard:null, watch:{} };
  ev(S,{t:'home'}); ev(S,{t:'night',on:true}); sfx(S,'howl');
  { const ni=line(LN.NIGHT_INTRO); narr(S,RS(ni+' Herkes telefonundan seçimini yapsın.',ni)); }
  S.timerEnd=Date.now()+(NIGHT_SEC+8)*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='night'){ forceNight(S,ctx); ctx.broadcast(); } });
  const humanV=alive(S).some(x=>x.role==='vampir'&&!auto(x));
  for(const p of alive(S).filter(auto)){ if(p.role==='vampir'&&humanV) continue; later(S,ctx,2500+Math.random()*5000,()=>botDoNight(S,p,ctx)); }
  if(alive(S).every(x=>!nightNeed(S,x))) resolveNight(S,ctx);
}
function botDoNight(S,p,ctx){
  if(!p.alive||S.phase!=='night') return; const N=S.night; let r={}; try{ r=BT.botNight(S,p,{ first:N.first, double:N.double })||{}; }catch(e){}
  let g=0, k; while(S.phase==='night'&&(k=nightNeed(S,p))&&g++<5){ const t=k==='bite'?r.bite:k==='bite2'?r.bite2:k==='plant'?r.plant:r.target; nightAction(S,p,k,t?t.id:'__none',ctx,true); }
}
/** süre doldu / anlatıcı geçti: kalanlar için botlar seçer, insanlar boş geçer */
function forceNight(S,ctx){
  if(S.phase!=='night') return; const gid=S.gameId, day=S.day;
  for(const p of alive(S)){ if(S.phase!=='night'||S.gameId!==gid||S.day!==day) return; if(!nightNeed(S,p)) continue;
    if(auto(p)||p.role==='vampir') botDoNight(S,p,ctx); else { let g=0,k; while(S.phase==='night'&&(k=nightNeed(S,p))&&g++<5) nightAction(S,p,k,'__none',ctx,true); } }
  if(S.phase==='night'&&S.day===day) resolveNight(S,ctx);
}
function nightAction(S,p,k,target,ctx,forced=false){
  const N=S.night; if(!N||nightNeed(S,p)!==k) return; const none=!target||target==='__none'; const t=none?null:P(S,target);
  if(!none&&(!t||!t.alive)) return;
  if(none&&!forced&&!['bite2','plant','watch'].includes(k)) return;
  const mates=(f)=>alive(S).filter(x=>auto(x)&&x.role==='vampir'&&x!==p&&f(x));
  switch(k){
    case 'bite': { if(none){ N.vampVotes[p.id]='__none'; break; } if(t.role==='vampir') return; N.vampVotes[p.id]=target; if(!auto(p)) for(const b of mates(x=>!N.vampVotes[x.id])) N.vampVotes[b.id]=target; break; }
    case 'bite2': { if(none) N.vamp2[p.id]='__none'; else { if(t.role==='vampir'||target===N.vampVotes[p.id]) return; N.vamp2[p.id]=target; } if(!auto(p)) for(const b of mates(x=>N.vamp2[x.id]===undefined)) N.vamp2[b.id]=N.vamp2[p.id]; break; }
    case 'plant': { if(none) N.plantV[p.id]='__none'; else { if(t.role==='vampir') return; N.plantV[p.id]=target; } if(!auto(p)) for(const b of mates(x=>N.plantV[x.id]===undefined)) N.plantV[b.id]='__none'; break; }
    case 'doctor': N.doctor=none?'__none':target; break;
    case 'seer': { if(!none&&target===p.id) return; N.seer=none?'__none':target; if(!none){ N.seerResult=t.role==='vampir'; if(p.bot) BT.botSeerResult(p,target,N.seerResult); } break; }
    case 'guard': { if(!none&&target===p.id) return; N.guard=none?'__none':target; break; }
    case 'watch': { if(!none&&target===p.id) return; N.watch[p.id]=none?'__none':target; break; }
    default: return;
  }
  if(alive(S).every(x=>!nightNeed(S,x))) resolveNight(S,ctx);
}
function announceClues(S,list,tell){ for(const c of list){ const txt=LN.clueLine(c.kind,c.ids.map(id=>P(S,id)?.name||'?')); const who=c.to&&P(S,c.to)?.alive?P(S,c.to):null; ev(S,{ t:'clue', id:c.id, kind:c.kind, ids:c.ids }); if(who) say(S,who,txt); else tell(txt); } }
function resolveNight(S,ctx){
  if(S.phase!=='night') return;
  ctx.clearTimer(); S.timerEnd=null; const N=S.night;
  const plur=(m)=>{ const t={}; Object.values(m).forEach(x=>{ if(x&&x!=='__none') t[x]=(t[x]||0)+1; }); let v=null,max=0; for(const [k,c] of Object.entries(t)){ if(c>max||(c===max&&Math.random()<.5)){ max=c; v=k; } } return v; };
  const val=(x)=>x&&x!=='__none'?x:null;
  const b1=plur(N.vampVotes); const m2={}; for(const [k,v] of Object.entries(N.vamp2)) if(v!==b1) m2[k]=v; const b2=N.double?plur(m2):null;
  const plant=Object.values(N.plantV).find(x=>val(x)&&x!==b1&&x!==b2)||null;
  const watch={}; for(const [k,v] of Object.entries(N.watch)) if(val(v)) watch[k]=v;
  const res=RL.resolveNight({ players:S.players, bite:[b1,b2].filter(Boolean), plant, protect:val(N.doctor), seer:val(N.seer), guard:val(N.guard), watch, first:N.first, event:S.nightEvent, rnd:Math.random });
  const dead=[]; for(const id of res.killed){ const v=P(S,id); v.alive=false; v.fate='killed'; dead.push(v); } for(const id of res.grief){ const v=P(S,id); v.alive=false; v.fate='grief'; dead.push(v); }
  const saved=res.saved.length>0;
  // gece öğrenilenler (kişiye özel)
  S.priv={}; const pv=(id)=>(S.priv[id] ||= {});
  const bek=alive(S).find(p=>p.role==='bekci'); if(bek&&res.guardRes){ pv(bek.id).guard=res.guardRes; if(res.guardRes.out!==null){ (bek.guardLog ||= []).push(res.guardRes); if(bek.bot) BT.botGuardResult(bek,res.guardRes.target,res.guardRes.out); } }
  for(const [pid,w] of Object.entries(res.watchRes)){ const p=P(S,pid); if(!p||!p.alive) continue; pv(pid).watch=w; if(p.bot) BT.botWatchResult(p,w.target,w.saw); }
  for(const v of alive(S).filter(p=>p.role==='vampir')) pv(v.id).wentOut=res.vOut.includes(v.id);
  S.lastNight={ killed:res.killed[0]||null, dead:dead.map(v=>v.id), saved, first:N.first, seer:val(N.seer)?{target:N.seer,isVamp:N.seerResult}:null };
  const carry=(S.clues||[]).filter(c=>c.kind==='dugun');
  S.day++; startAct(S);
  ev(S,{t:'night',on:false}); sfx(S,'bell');
  const tell=tellBy(S);
  if(N.first){ ev(S,{t:'chicken'}); tell(line(LN.DAWN_CHICKEN)); }
  else if(res.killed.length){ for(const id of res.killed){ const v=P(S,id); ev(S,{t:'dead',who:v.id}); tell(line(LN.DAWN_DEAD,{v:v.name})); narr(S,LN.revealLine(v.name,RL.ROLES[v.role].reveal)); } }
  else tell(line(saved?LN.DAWN_SAVED:LN.DAWN_NONE));
  for(const id of res.grief){ const v=P(S,id); ev(S,{t:'dead',who:v.id}); narr(S,line(LN.LOVER_DEATH,{v:v.name})); narr(S,LN.revealLine(v.name,RL.ROLES[v.role].reveal)); }
  S.phase='dawn';
  const H={ day:S.day, event:null, clues:[], killed:res.killed.slice(), grief:res.grief.slice(), saved, first:N.first }; S.hist.push(H);
  S.clues=[]; S.event=null; S.gossip=null; S.insp={};
  vstate(S);
  if(checkWin(S)) return;
  // köy olayı
  S.event=RL.rollEvent({ day:S.day, used:S.usedEvents, aliveN:alive(S).length, nightEvent:S.nightEvent, rnd:Math.random, enabled:S.settings?.events!==false });
  if(S.event){ S.usedEvents.push(S.event); H.event=S.event; ev(S,{ t:'event', k:S.event }); tell(LN.pick(LN.EVENT[S.event])); }
  // ipuçları
  S.clues=RL.makeClues({ players:S.players, vOut:res.vOut, plant:res.plant, watchers:Object.keys(watch), dayEvent:S.event, nightEvent:S.nightEvent, first:N.first, day:S.day, rnd:Math.random });
  if(S.pendingClue){ S.clues.push(S.pendingClue); S.pendingClue=null; }
  announceClues(S,S.clues,tell);
  if(!S.clues.length&&S.event!=='sis') tell(LN.pick(LN.CLUE_NONE));
  for(const c of carry) if(c.ids.filter(id=>P(S,id)?.alive).length>=2) S.clues.push(c);
  H.clues=S.clues.map(c=>({ ...c }));
  // dedikodu
  const ded=alive(S).find(p=>p.role==='dedikoducu');
  if(ded){ const g=RL.gossipFor({ players:S.players, outs:res.outs, self:ded.id, rnd:Math.random }); if(g) S.gossip={ for:ded.id, ids:g.ids, said:false }; }
  gate(S,ctx,()=>toDiscussion(S,ctx),80000,7000);
}
/* ---- bitiş ---- */
function checkWin(S){
  const al=alive(S); const v=al.filter(p=>p.role==='vampir').length; const o=al.length-v;
  if(S.deliWon) S.winner='deli'; else if(v===0) S.winner='koylu'; else if(v>=o) S.winner='vampir'; else return false;
  S.phase='end'; S.timerEnd=null; S.gate=null; GATES.delete(S);
  if(S.winner==='vampir'){
    const vamps=al.filter(p=>p.role==='vampir'); const vills=al.filter(p=>p.role!=='vampir');
    SC.vampWinScene(io(S),{ vamps, vills, multi:S.players.filter(p=>p.role==='vampir').length>1 });
    vills.forEach(p=>{ p.fate='bitten'; });
  } else if(S.winner==='koylu') SC.villageWinScene(io(S),{ alive:al });
  vstate(S);
  return true;
}

/* =================== İSTEMCİ ARAYÜZÜ =================== */
const MODE3D={ roles:'roles', opening:'talk', discussion:'talk', select:'select', defense:'defense', final:'final', verdict:'verdict', night:'night', dawn:'dawn', end:'end' };
const ACC_R=[['night','Gece dışarıdaydı'],['clue','İpucu onu gösteriyor'],['quiet','Hiç konuşmuyor'],['pushed','Dün masumu astırdı'],['lie','Lafı tutmuyor'],['gut','İçimden bir ses']];
const DEF_R=[['alibi','Gece benimleydi'],['seer','Kâhin temiz dedi'],['accuser','Suçlayan şüpheli'],['vouch','Ona kefilim']];
export function createMultiUI({ app, esc, voice, send, toast, isHost, meId, onLeave }){
  let talkMode=null, talkReason=false, ghMode=null, fast=false, shareBusy=false, showClues=false;
  let V=null, SC=null, D=null, is3d=false, loading3d=false, gameId=null, act=-1, idx=0, sel=null, finChoice=null, defMode=null, roleClaim=null, S=null, lines=[], timerTick=null, lastPhase='', readySent=-1;
  const mine=()=>S&&P(S,meId());
  const speaker=createSpeaker(voice); loadVoices();
  const disposeD=()=>{ if(D){ try{ D.dispose(); }catch(e){} D=null; } };
  const setFast=(on,keep)=>{ fast=!!on; setSpeechRate(fast?1.45:1); if(SC&&SC.setFast) SC.setFast(fast); if(keep){ try{ localStorage.setItem('vk_fast',fast?'1':'0'); }catch(e){} } };
  const fastPref=()=>{ try{ return localStorage.getItem('vk_fast')==='1'; }catch(e){ return false; } };
  const nm=(id)=>{ const p=S&&P(S,id); return p?esc(p.id===meId()?p.name+' (sen)':p.name):'?'; }, av=(id)=>(S&&P(S,id)?.avatar)||'';

  function build(){
    disposeD(); SC=null; V=null; act=-1; idx=0; lines=[]; readySent=-1; setFast(false);
    is3d=stageWanted();
    if(is3d){
      app.innerHTML=`<div class="game g3d fade"><div class="topbar" id="mTop"></div><div class="spacer"></div><div class="subs" id="mLines"></div><div id="mPanel"></div>${loadingHTML()}</div>`;
      const gid=gameId; loading3d=true;
      (async()=>{ try{
        const S3=await stage3d(); S3.showStage(true); const bar=app.querySelector('#gLoadBar');
        await S3.ensureStage((p)=>{ if(bar) bar.style.width=Math.round(p*100)+'%'; });
        if(gid!==gameId || !S) return;
        D=await S3.newDirector(S.players.map(p=>({ ...p, human:p.id===meId(), name:p.name })),{ voice, onLine:addLine, onPick:onHouse, speak:speaker, prefetch:prefetchLines, meId:meId() });
        SC=D; V={ highlight:(id,on)=>D.highlight(id,on) }; loading3d=false; setFast(fastPref());
        const ld=app.querySelector('#gLoad'); if(ld){ ld.classList.add('out'); setTimeout(()=>ld.remove(),700); }
        render(S);
      }catch(err){ console.error('3B açılamadı',err); loading3d=false; setRenderPref('2d'); hideStage(); toast('3B grafik açılamadı, basit görünüme geçildi'); gameId=null; render(S); } })();
      return;
    }
    hideStage();
    app.innerHTML=`<div class="game fade">
      <div class="topbar" id="mTop"></div>
      <div class="vwrap" id="mVillage"></div>
      <div class="lines" id="mLines"></div>
      <div id="mPanel"></div></div>`;
    V=createVillage(app.querySelector('#mVillage'),{ players:S.players.map(p=>({id:p.id,name:p.id===meId()?p.name+' (sen)':p.name,avatar:p.avatar})), onHouse });
    SC=createScene({ village:V, voice, onLine:addLine, speak:speaker }); setFast(fastPref());
    V.setNight(false);
  }
  function sync3d(){ if(!is3d||!D||!SC||SC.busy||!S) return; D.setMode(MODE3D[S.phase]||'talk'); D.setCandidates(pickCands()); }
  function addLine(e){ lines.push(e); if(lines.length>3) lines.shift(); const el=app.querySelector('#mLines'); if(!el) return;
    if(is3d){ const l=e; const pv=lines.length>1?lines[lines.length-2]:null; const cut=(t,n)=>t.length>n?t.slice(0,n-2)+'…':t;
      el.innerHTML=`${pv?`<div class="prev">${esc(pv.t==='narr'?'Anlatıcı':pv.name)}: ${esc(cut(pv.text,72))}</div>`:''}<div class="who">${l.t==='narr'?'🌙 Anlatıcı':`${esc(l.avatar)} ${esc(l.name)}${l.title?` <span class="tt">· ${esc(l.title)}</span>`:''}`}</div><div class="tx ${l.t==='narr'?'narr':''} ${l.kind==='scream'?'scream':''}">${esc(l.text)}</div>`; return; }
    el.innerHTML=lines.map((l,i)=>`<div class="ln ${l.t==='narr'?'narr':''} ${l.kind==='scream'?'scream':''} ${i===lines.length-1?'last':''}"><b>${l.t==='narr'?'🌙':esc(l.avatar)} ${esc(l.name)}${l.title?` <span class="tt">${esc(l.title)}</span>`:''}:</b> ${esc(l.text)}</div>`).join(''); }
  /** sahneyi izledim: anlatıcı çoğunluk hazır olunca ilerler */
  function ready(){ if(!S||!S.gate||S.gate.act!==S.act||readySent===S.act||(SC&&SC.busy)) return; if(!P(S,meId())) return; readySent=S.act; send({ type:'ready', act:S.act }); }

  function render(state){
    S=state; if(!S) return;
    if(gameId!==S.gameId || !app.querySelector('#mTop')){ gameId=S.gameId; lastPhase=''; build(); }
    if(!SC){ drawTop(); return; }
    if(S.phase!==lastPhase){ lastPhase=S.phase; sel=null; finChoice=null; defMode=null; roleClaim=null; talkMode=null; talkReason=false; ghMode=null; V.highlight(null); }
    // sahne olayları
    let fresh=[];
    if(S.act!==act){ act=S.act; idx=0; }
    if(S.evs && S.evs.length>idx){ fresh=S.evs.slice(idx); idx=S.evs.length; }
    if(fresh.length){ if(is3d&&D) D.setCandidates(null); SC.play(fresh, ()=>{ SC.sync(S.vstate||{}); drawPanel(); sync3d(); ready(); }); }
    else if(!SC.busy){ SC.sync(S.vstate||{}); ready(); }
    drawTop(); drawPanel(); sync3d();
  }
  function drawTop(){
    const t=app.querySelector('#mTop'); if(!t) return; const m=mine();
    const ph={roles:'Roller',opening:'Meydan',discussion:'Tartışma',select:S.duel?'Düello':'Seçim',defense:'Savunma',final:'Son karar',verdict:'Hüküm',night:'Gece',dawn:'Sabah',end:'Bitti'}[S.phase]||'';
    t.innerHTML=`<span class="pill">Oda <b style="color:var(--gold)">${S.code}</b></span><span class="pill">${S.day?`Gün ${S.day} · `:''}${ph}${S.event&&RL.EVENTS[S.event]?' '+RL.EVENTS[S.event].ic:''}</span>${m&&m.role?`<span class="pill">${ROLE_INFO[m.role].ic}</span>`:''}<button id="mVoice">${voice.on?'🔊':'🔇'}</button>`;
    t.querySelector('#mVoice').onclick=()=>{ voice.set(!voice.on); if(!voice.on){ try{speechSynthesis.cancel();}catch(e){} } else SFX.unlock(); drawTop(); };
  }
  const others=(m)=>alive(S).filter(p=>p.id!==m.id).map(p=>p.id);
  function pickCands(){
    const m=mine(); if(!m||SC?.busy) return null;
    if(!m.alive) return ghMode?alive(S).map(p=>p.id):null;
    if(S.phase==='select'&&!S.sel[m.id]) return S.duel?S.duel.filter(id=>id!==m.id):others(m);
    if(S.phase==='night') return nightCands(m);
    if(S.phase==='defense'&&S.accused===m.id&&(defMode==='blame'||defMode==='innocent'||defMode==='witness')) return others(m);
    if(S.phase==='discussion'&&talkMode&&talkMode!=='claimBekci'&&!talkReason) return others(m);
    return null;
  }
  function nightCands(m){
    const k=nightNeed(S,m); if(!k) return null; const N=S.night;
    if(k==='bite') return alive(S).filter(p=>p.role!=='vampir').map(p=>p.id);
    if(k==='bite2') return alive(S).filter(p=>p.role!=='vampir'&&p.id!==N.vampVotes[m.id]).map(p=>p.id);
    if(k==='plant') return alive(S).filter(p=>p.role!=='vampir'&&p.id!==N.vampVotes[m.id]&&p.id!==N.vamp2[m.id]).map(p=>p.id);
    if(k==='doctor') return alive(S).map(p=>p.id);
    return others(m);
  }
  function onHouse(id){ const c=pickCands(); if(!c||!c.includes(id)) return; sel=id; V.highlight(id,true); drawPanel(); if(is3d&&D) D.setCandidates(c); }
  const chips=(ids,counts)=>`<div class="chips">${(ids||[]).map(id=>{ const p=P(S,id); return `<button class="chip ${sel===id?'on':''}" data-chip="${id}">${p.avatar} ${esc(p.id===meId()?p.name+' (sen)':p.name)}${counts&&counts[id]?` <small class="bad">${counts[id]}</small>`:''}</button>`; }).join('')}</div>`;
  const hostBtn=(label,cls='gold')=>isHost()?`<button class="btn ${cls}" id="mNext">${label}</button>`:'';
  const waitNote=(t='Herkes sahneyi izleyince devam edilecek…')=>`<p class="note pulse">${t}</p>`;
  const timer=()=>S.timerEnd?`<div class="timer" id="mTimer">--</div>`:'';
  const myInsp=()=>{ const m=mine(); return (m&&S.insp&&S.insp[m.id])||{}; };
  const cluesHTML=(open)=>{ const m=mine(); const can=!!(m&&m.alive&&(S.phase==='dawn'||S.phase==='discussion')); const left=can?Math.max(0,(S.event==='pazar'?2:1)-Object.keys(myInsp()).length):0;
    if(!S.clues||!S.clues.length) return ''; if(!open&&!showClues) return `<button class="btn sm sec" id="mClues" style="width:100%;margin-bottom:6px">🔎 İpuçları (${S.clues.length})${left?' · inceleme hakkın var':''}</button>`;
    return UB.clueCards({ clues:S.clues, nm, insp:myInsp(), left, canInspect:can })+(open?'':`<button class="btn sm sec" id="mClues" style="width:100%;margin-bottom:6px">İpuçlarını gizle</button>`); };
  const privHTML=()=>{ const m=mine(); if(!m||!m.alive) return ''; const pv={ ...((S.priv||{})[m.id]||{}) }; if(m.role==='kahin'&&S.lastNight?.seer) pv.seer=S.lastNight.seer; if(S.gossip&&S.gossip.for===m.id) pv.gossip=S.gossip.ids; return UB.privNotes(pv,nm); };
  const reactRow=()=>{ const m=mine(); if(!m||!m.alive) return ''; return `<div class="reacts">${Object.entries(UB.REACT_LABEL).map(([k,l])=>`<button data-react="${k}">${l}</button>`).join('')}</div>`; };
  /** hayalet: ölünce domates, kapı, bahis, fısıltı */
  function ghostHTML(){ const m=mine(); if(!m||m.alive||!m.role||S.phase==='end') return '';
    if(ghMode) return `<div class="card panelc"><label>${UB.GHOST_Q[ghMode]}</label>${chips(alive(S).map(p=>p.id))}<div class="row"><button class="btn sec" id="mGhX">Vazgeç</button><button class="btn gold" id="mGhGo" ${sel?'':'disabled'}>Tamam</button></div></div>`;
    return UB.ghostPanel({ canTomato:!S.gate&&['discussion','defense','final','verdict'].includes(S.phase), canRattle:!S.gate&&['night','dawn','select'].includes(S.phase), canWhisper:!(S.ghostW||{})[m.id], bet:(S.bets||{})[m.id], nm }); }

  function drawPanel(){
    const el=app.querySelector('#mPanel'); if(!el||!S||!SC) return;
    if(SC.busy){ el.innerHTML=is3d?`<div class="skipf"><button id="mFast" class="${fast?'on':''}">${fast?'▶ Normal hız':'⏩ Hızlandır'}</button><button id="mSkip">⏭ Geç</button></div>`:`<div class="card panelc"><div class="row"><button class="btn sec" id="mFast">${fast?'▶ Normal hız':'⏩ Hızlandır'}</button><button class="btn sec" id="mSkip">⏭ Geç</button></div></div>`;
      el.querySelector('#mSkip').onclick=()=>SC.skip(); el.querySelector('#mFast').onclick=()=>{ setFast(!fast,true); drawPanel(); }; return; }
    const m=mine(); const dead=m&&!m.alive; let html='';
    switch(S.phase){
      case 'roles': {
        if(!m){ html=spect(); break; }
        const r=ROLE_INFO[m.role]; const mates=m.role==='vampir'?S.players.filter(p=>p.role==='vampir'&&p.id!==m.id):[];
        html=`<div class="rolecard ${m.role}" style="padding:16px"><div class="ic" style="font-size:54px">${r.ic}</div><div class="rn">${r.name}</div><div class="rd">${r.desc}</div>${mates.length?`<div style="margin-top:10px;color:var(--blood2);font-weight:800">Diğer vampirler: ${mates.map(x=>esc(x.name)).join(', ')}</div>`:''}${m.lover?`<div style="margin-top:10px;color:#ff8fb3;font-weight:800">💘 Âşığın: ${nm(m.lover)} — biriniz ölürse öteki de dayanamaz.</div>`:''}<div class="note">Karakterin: ${m.avatar} ${esc(m.title||'')}</div></div>
          ${S.roleAck[m.id]?`<p class="note pulse">Diğerleri bekleniyor… (${Object.keys(S.roleAck).length}/${S.players.length})</p>${hostBtn('Beklemeden başla','sec')}`:`<button class="btn" id="mAck">Anladım, gizle</button>`}`; break; }
      case 'opening': html=`<div class="card panelc" style="text-align:center"><b>Akşam oldu, köy meydanda toplandı.</b><div class="note">Birazdan herkes evine: ilk gece kimse ölmez, sabaha ipuçları çıkar.</div>${hostBtn('🌙 Beklemeden geceye geç','sec')}${waitNote()}</div>`; break;
      case 'discussion': {
        const canTalk=m&&m.alive;
        if(canTalk&&talkMode==='claimBekci'){ const res=(m.guardLog||[]).filter(x=>P(S,x.target)?.alive); html=`<div class="card panelc"><label>Hangi gördüğünü açıklayacaksın?</label><div class="chips">${res.map((x,i)=>`<button class="chip" data-bek="${i}">${av(x.target)} ${nm(x.target)} <small class="${x.out?'bad':'ok'}">${x.out?'gece çıktı':'evdeydi'}</small></button>`).join('')}</div><button class="btn sec" id="mTCancel">Vazgeç</button></div>`; }
        else if(canTalk&&talkMode&&talkReason){ const t=P(S,sel); const rs=(talkMode==='accuse'?ACC_R:DEF_R).filter(r=>r[0]!=='clue'||(S.clues||[]).length);
          html=`<div class="card panelc"><label>${talkMode==='accuse'?'Neden şüpheleniyorsun':'Neden güveniyorsun'}: <b style="color:var(--gold)">${t?esc(t.name):''}</b></label><div class="acts">${rs.map(r=>`<button class="btn sm ${talkMode==='accuse'?'':'green'}" data-why="${r[0]}">${r[1]}</button>`).join('')}</div><button class="btn sec" id="mTCancel">Vazgeç</button></div>`; }
        else if(canTalk&&talkMode){ const L={ accuse:['Kimi suçlayacaksın?','Devam →',''], defend:['Kimi savunacaksın?','Devam →','green'], press:['Kimi sıkıştıracaksın?','Sıkıştır','blue'], ally:['Kiminle anlaşacaksın?','İttifak öner','blue'] }[talkMode];
          html=`<div class="card panelc"><label>${L[0]}</label>${chips(others(m))}<div class="row"><button class="btn sec" id="mTCancel">Vazgeç</button><button class="btn ${L[2]}" id="mTDo" ${sel?'':'disabled'}>${L[1]}</button></div></div>`; }
        else { const acts=[['accuse','Suçla',''],['defend','Savun','green'],['press','Sıkıştır','blue'],['ally','İttifak','blue'],['calm','Yatıştır','gold'],['oath','Yemin et','gold']];
          if(canTalk&&m.role==='bekci'&&(m.guardLog||[]).some(x=>P(S,x.target)?.alive)) acts.push(['claimBekci','🔦 Gördüğümü açıkla','blue']);
          if(canTalk&&S.gossip&&S.gossip.for===m.id&&!S.gossip.said) acts.push(['gossip','🗣️ Dedikoduyu yay','blue']);
          html=`${ghostHTML()}${ghMode?'':`${privHTML()}${cluesHTML(false)}<div class="card panelc" style="text-align:center"><b>🗣️ Yüz yüze konuşun! Kim vampir?</b>${timer()}${canTalk?`<div class="acts" style="margin-top:8px">${acts.map(([k,l,c])=>`<button class="btn sm ${c}" data-talk="${k}">${l}</button>`).join('')}</div>${reactRow()}`:''}${hostBtn('🏠 Seçime geç','sec')}</div>`}`; }
        break; }
      case 'select': {
        const voted=Object.keys(S.sel).length, n=alive(S).length;
        if(m&&m.alive&&!S.sel[m.id]) html=`${privHTML()}<div class="card panelc"><label>${S.duel?'⚔️ Oylar eşitti: ikisinden birini seç':'🏠 Şüphelendiğin kişinin evine dokun'}</label>${timer()}${chips(pickCands())}<button class="btn" id="mSel" ${sel?'':'disabled'}>${sel?`${esc(P(S,sel).name)} meydana getirilsin!`:'Bir ev seç'}</button></div>`;
        else html=`${ghostHTML()}${ghMode?'':`<div class="card panelc" style="text-align:center">${m&&S.sel[m.id]?`Seçimin: <b>${esc(P(S,S.sel[m.id]).name)}</b> ✔`:''}<div class="note">${voted}/${n} kişi seçti</div>${timer()}${reactRow()}${hostBtn('Seçimi bitir','sec')}</div>`}`;
        break; }
      case 'defense': {
        const acc=P(S,S.accused);
        if(m&&m.id===acc.id){
          if(S.defStep===2){ const Q=LN.DEFENSE_Q[S.defQ]; html=`<div class="card panelc" style="border-color:var(--blood2)"><label style="color:var(--blood2)">❓ ${esc(Q.q)}</label>${timer()}<div class="acts">${Q.a.map((x,i)=>`<button class="btn sm" data-dq="${i}">${esc(x.label)}</button>`).join('')}</div></div>`; }
          else if(S.defStep===3) html=`<div class="card panelc" style="border-color:var(--blood2)"><label style="color:var(--blood2)">🗣️ Son sözün?</label>${timer()}<div class="acts">${LN.LAST_WORD.map(o=>`<button class="btn sm sec" data-dl="${o.key}">${esc(o.label)}</button>`).join('')}</div></div>`;
          else if(S.defense) html=`<div class="card panelc" style="text-align:center"><div class="note pulse">Köy dinliyor…</div></div>`;
          else if(defMode==='blame'||defMode==='innocent'||defMode==='witness') html=`<div class="card panelc"><label>${defMode==='blame'?'Kimi işaret edeceksin?':'Kim şahidin?'}</label>${chips(pickCands())}<div class="row"><button class="btn sec" id="mCancel">Vazgeç</button><button class="btn" id="mDefGo" ${sel?'':'disabled'}>Söyle!</button></div></div>`;
          else if(defMode==='role') html=`<div class="card panelc"><label>Hangi rolü söyleyeceksin? (yalan da olabilir)</label><div class="acts">${['koylu','doktor','kahin','bekci','aga'].map(r=>`<button class="btn sm sec" data-claimr="${r}">${ROLE_INFO[r].ic} ${ROLE_INFO[r].name}</button>`).join('')}</div><button class="btn sec" id="mCancel">Vazgeç</button></div>`;
          else html=`<div class="card panelc" style="border-color:var(--blood2)"><label style="color:var(--blood2)">⚖️ Meydanda sen varsın! Kendini savun:</label>${timer()}<div class="acts">${LN.DEFENSE_OPEN.map(o=>`<button class="btn sm ${o.key==='silent'?'sec':o.key==='role'?'blue':o.key==='blame'||o.key==='threat'?'':'green'}" data-def="${o.key}">${o.label}</button>`).join('')}</div><div class="note">Sözlü de savunabilirsin; seçimin köyde seslendirilir.</div></div>`;
        } else html=`${ghostHTML()}${ghMode?'':`<div class="card panelc" style="text-align:center"><b>${acc.avatar} ${esc(acc.name)}</b> savunma yapıyor…${timer()}${reactRow()}${hostBtn('Savunmayı geç','sec')}</div>`}`;
        break; }
      case 'final': {
        const acc=P(S,S.accused); const el2=alive(S).filter(p=>p.id!==S.accused);
        const hangs=Object.values(S.fin).filter(v=>v==='hang').length, rels=Object.values(S.fin).filter(v=>v==='release').length;
        const lockRow=`<div class="note">🔒 ${Object.keys(S.fin).length}/${el2.length} kitledi · 🪢 ${hangs} AS · 🕊️ ${rels} BIRAK</div>`;
        if(m&&m.alive&&m.id!==acc.id&&!S.fin[m.id]) html=`<div class="card panelc"><label>Son karar: <b style="color:var(--gold)">${acc.avatar} ${esc(acc.name)}</b> asılsın mı?${m.role==='aga'?' <span class="tt">🎩 oyun 2 sayılır</span>':''}</label>${timer()}${lockRow}
          <div class="row"><button class="btn ${finChoice==='hang'?'':'sec'}" data-fv="hang">🪢 AS</button><button class="btn ${finChoice==='release'?'green':'sec'}" data-fv="release">🕊️ BIRAK</button></div>
          ${(S.ivd||{})[m.id]?'':`<div class="row"><button class="btn sm green" data-iv="support">🤝 Araya gir: savun</button><button class="btn sm" data-iv="refute">👊 Çürüt</button></div>`}
          <button class="btn gold" id="mLock" ${finChoice?'':'disabled'}>🔒 Oyumu kitledim</button></div>`;
        else html=`${ghostHTML()}${ghMode?'':`<div class="card panelc" style="text-align:center">${m&&m.id===acc.id?'<b style="color:var(--blood2)">Köy senin hakkında karar veriyor…</b>':m&&S.fin[m.id]?`Oyun: <b>${S.fin[m.id]==='hang'?'🪢 AS':'🕊️ BIRAK'}</b> 🔒`:''}${timer()}${lockRow}${m&&m.alive&&m.id!==acc.id?reactRow():''}${hostBtn('Kararı açıkla','sec')}</div>`}`;
        break; }
      case 'verdict': {
        const lv=S.lastVote||{};
        const head=lv.wedding?`<div class="big">🥁 Düğün günü</div><div class="note">Bugün kimse asılmadı. Halaydan kaybolanı unutmayın!</div>`
          :lv.hanged?(lv.role==='vampir'?`<div class="big" style="color:var(--blood2)">🧛 VAMPİR ÇIKTI!</div><div class="note">${esc(lv.name)} kazığı yedi.</div>`:`<div class="big">🪢 ${esc(lv.name)}</div><div class="note">${ROLE_INFO[lv.role].ic} ${ROLE_INFO[lv.role].name} idi. (${lv.hang} AS / ${lv.rel} BIRAK)</div>`):`<div class="big">🕊️ Bırakıldı</div><div class="note">${esc(lv.name||'')} bugün kurtuldu (${lv.hang} AS / ${lv.rel} BIRAK).</div>`;
        html=`${ghostHTML()}${ghMode?'':`<div class="card panelc" style="text-align:center">${head}${hostBtn('🌙 Beklemeden geceye geç','sec')}${waitNote('Birazdan gece olacak…')}</div>`}`; break; }
      case 'night': {
        const k=m&&m.alive?nightNeed(S,m):null;
        if(k){ const U=UB.NIGHT_UI[k]; const c=nightCands(m); const counts={}; if(k==='bite') Object.values(S.night.vampVotes).forEach(x=>counts[x]=(counts[x]||0)+1);
          html=`<div class="card panelc"><label>${U.q} <span class="tt">Eve dokun</span></label>${timer()}${m.role==='vampir'?`<div class="note" style="text-align:left">Vampirler: ${alive(S).filter(p=>p.role==='vampir').map(p=>esc(p.name)).join(', ')}</div>`:''}${k==='watch'&&S.night.first?'<div class="note" style="text-align:left;margin:0 0 6px">İlk gece kimse ölmez; ama vampir kümese iner. Sabaha ipuçları çıkar.</div>':''}${chips(c,counts)}${U.note?`<div class="note" style="text-align:left">${U.note}</div>`:''}
            <div class="row">${U.skip?`<button class="btn sec" id="mNightSkip">${U.skip}</button>`:''}<button class="btn ${U.cls}" id="mNightGo" ${sel?'':'disabled'}>${U.go}</button></div></div>`; }
        else if(m&&m.alive&&m.role==='kahin'&&S.night.seer&&S.night.seer!=='__none'){ const t=P(S,S.night.seer); html=`<div class="card panelc" style="text-align:center">🔮 <b>${esc(t.name)}</b> ${S.night.seerResult?'<span class="bad">bir VAMPİR!</span>':'<span class="ok">vampir değil.</span>'}<div class="note">Sadece sen biliyorsun.</div>${timer()}</div>`; }
        else html=`${ghostHTML()}${ghMode?'':`<div class="card panelc" style="text-align:center"><div style="font-size:44px">😴</div><b>${m&&m.alive?'Seçimin kaydedildi':'Gece…'}</b>${timer()}<div class="note">Herkes telefonundan bir seçim yapıyor; kimin ne olduğu anlaşılmaz.</div></div>`}`;
        html+=hostBtn('Geceyi bitir','sec'); break; }
      case 'dawn': html=`${privHTML()}${S.event?UB.eventCard(S.event):''}${cluesHTML(true)}${ghostHTML()}${ghMode?'':`<div class="card panelc" style="text-align:center">${hostBtn('🔔 Beklemeden meydana','sec')}${waitNote('Birazdan meydanda toplanılacak…')}</div>`}`; break;
      case 'end': {
        const w=S.winner; const won=m&&m.role?(w==='deli'?m.role==='deli':(m.role==='deli'?false:((m.role==='vampir')===(w==='vampir')))):null;
        const aw=RL.awards(S.tally,S.players);
        html=`<div class="banner ${w==='koylu'?'day':'night'}"><div class="big">${w==='vampir'?'🧛':w==='deli'?'🤪':'🏆'}</div><div class="t">${w==='vampir'?'Vampirler kazandı!':w==='deli'?'Deli kazandı!':'Köylüler kazandı!'}</div>${won!==null?`<div class="d">${won?'Sen kazandın!':'Sen kaybettin.'}</div>`:''}</div>
          ${UB.awardsHTML(aw,nm,av)}
          <div class="card"><label>Roller</label><ul class="plist">${S.players.map(p=>`<li class="${p.alive?'':'dead'} ${p.id===meId()?'me':''}"><span class="av">${p.avatar||'🙂'}</span><span class="nm">${esc(p.name)}${p.lover?' 💘':''}${p.bot?' 🤖':''}</span><span class="tag">${ROLE_INFO[p.role].ic} ${ROLE_INFO[p.role].name}</span></li>`).join('')}</ul></div>
          ${UB.timelineHTML(S.hist,S.players,nm)}
          <button class="btn blue" id="mShare">📤 Sonucu paylaş</button>
          ${isHost()?`<button class="btn" id="mRestart">🔁 Rövanş (aynı oyuncular)</button>`:'<p class="note pulse">Anlatıcı rövanşı başlatabilir.</p>'}<button class="btn sec" id="mLeave">Odadan Ayrıl</button>`; break; }
    }
    if(dead && S.phase!=='end' && !ghMode) html+=`<div class="note">👻 Öldün ama oyun bitmedi: roller oyun sonunda açıklanır.</div>`;
    if(is3d && (S.phase==='end' || S.phase==='dawn' || dead)) html=`<div class="sheet-scroll">${html}</div>`;
    el.innerHTML=html; bind(el); runTimer(); if(is3d) sync3d();
  }
  function spect(){ return `<div class="card panelc" style="text-align:center"><div style="font-size:44px">👻</div><b>Oyun devam ediyor</b><div class="note">Bu tura sonradan geldin, izliyorsun.</div></div>`; }
  function bind(el){
    const q=(s)=>el.querySelector(s);
    q('#mAck')&&(q('#mAck').onclick=()=>send({type:'ackRole'}));
    q('#mNext')&&(q('#mNext').onclick=()=>{ SFX.unlock(); send({type:'next'}); });
    q('#mClues')&&(q('#mClues').onclick=()=>{ showClues=!showClues; drawPanel(); });
    el.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>onHouse(b.dataset.chip));
    el.querySelectorAll('[data-insp]').forEach(b=>b.onclick=()=>send({type:'inspect',clue:b.dataset.insp}));
    el.querySelectorAll('[data-react]').forEach(b=>b.onclick=()=>send({type:'react',k:b.dataset.react}));
    el.querySelectorAll('[data-gh]').forEach(b=>b.onclick=()=>{ ghMode=b.dataset.gh; sel=null; drawPanel(); });
    q('#mGhX')&&(q('#mGhX').onclick=()=>{ ghMode=null; sel=null; V.highlight(null); drawPanel(); });
    q('#mGhGo')&&(q('#mGhGo').onclick=()=>{ if(!sel) return; const k=ghMode; send({type:'ghost',kind:k,target:sel}); if(k==='bet') toast('🎲 Bahsin kaydedildi'); else if(k==='whisper') toast('🌬️ Fısıldadın'); ghMode=null; sel=null; V.highlight(null); drawPanel(); });
    q('#mSel')&&(q('#mSel').onclick=()=>{ if(sel) send({type:'select',target:sel}); });
    el.querySelectorAll('[data-def]').forEach(b=>b.onclick=()=>{ const k=b.dataset.def; if(k==='blame'||k==='witness'||k==='role'){ defMode=k; sel=null; drawPanel(); } else send({type:'defense',key:k}); });
    el.querySelectorAll('[data-dq]').forEach(b=>b.onclick=()=>send({type:'defense',i:+b.dataset.dq}));
    el.querySelectorAll('[data-dl]').forEach(b=>b.onclick=()=>send({type:'defense',key:b.dataset.dl}));
    el.querySelectorAll('[data-iv]').forEach(b=>b.onclick=()=>send({type:'intervene',kind:b.dataset.iv}));
    el.querySelectorAll('[data-talk]').forEach(b=>b.onclick=()=>{ const k=b.dataset.talk; if(k==='calm'||k==='oath'||k==='gossip'){ send({type:'talk',kind:k}); return; } talkMode=k; talkReason=false; sel=null; drawPanel(); });
    el.querySelectorAll('[data-bek]').forEach(b=>b.onclick=()=>{ const m=mine(); const res=(m.guardLog||[]).filter(x=>P(S,x.target)?.alive); const x=res[+b.dataset.bek]; if(x) send({type:'talk',kind:'claimBekci',target:x.target,out:!!x.out}); talkMode=null; drawPanel(); });
    el.querySelectorAll('[data-why]').forEach(b=>b.onclick=()=>{ send({type:'talk',kind:talkMode,target:sel,reason:b.dataset.why}); talkMode=null; talkReason=false; sel=null; V.highlight(null); drawPanel(); });
    q('#mTDo')&&(q('#mTDo').onclick=()=>{ if(!sel) return; if(talkMode==='accuse'||talkMode==='defend'){ talkReason=true; drawPanel(); return; } send({type:'talk',kind:talkMode,target:sel}); talkMode=null; sel=null; V.highlight(null); drawPanel(); });
    q('#mTCancel')&&(q('#mTCancel').onclick=()=>{ talkMode=null; talkReason=false; sel=null; V.highlight(null); drawPanel(); });
    el.querySelectorAll('[data-claimr]').forEach(b=>b.onclick=()=>send({type:'defense',key:'role',role:b.dataset.claimr}));
    q('#mCancel')&&(q('#mCancel').onclick=()=>{ defMode=null; sel=null; V.highlight(null); drawPanel(); });
    q('#mDefGo')&&(q('#mDefGo').onclick=()=>{ send({type:'defense',key:defMode,target:sel}); defMode=null; });
    el.querySelectorAll('[data-fv]').forEach(b=>b.onclick=()=>{ finChoice=b.dataset.fv; drawPanel(); });
    q('#mLock')&&(q('#mLock').onclick=()=>{ if(finChoice) send({type:'final',v:finChoice}); });
    const nightGo=(t)=>{ const m=mine(); const k=m&&nightNeed(S,m); if(k) send({type:'night',k,target:t}); sel=null; V.highlight(null); };
    q('#mNightGo')&&(q('#mNightGo').onclick=()=>{ if(sel) nightGo(sel); });
    q('#mNightSkip')&&(q('#mNightSkip').onclick=()=>nightGo('__none'));
    q('#mShare')&&(q('#mShare').onclick=async()=>{ if(shareBusy) return; shareBusy=true; try{ const w=S.winner; const blob=await UB.makeShareCard({ title:w==='deli'?'Deli kazandı!':w==='vampir'?'Vampirler kazandı!':'Köylüler kazandı!', sub:`${S.day} gün · ${S.players.length} kişi`, players:S.players, awards:RL.awards(S.tally,S.players), days:S.day }); await UB.shareCard(blob,'Vampir Köylü oynadık 🧛 Sen de gel!',toast); }catch(e){ toast('Kart hazırlanamadı'); } shareBusy=false; });
    q('#mRestart')&&(q('#mRestart').onclick=()=>send({type:'restart'}));
    q('#mLeave')&&(q('#mLeave').onclick=()=>onLeave());
  }
  function runTimer(){
    clearInterval(timerTick); const el=app.querySelector('#mTimer'); if(!el||!S.timerEnd) return;
    const upd=()=>{ const s=Math.max(0,Math.ceil((S.timerEnd-Date.now())/1000)); el.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; el.classList.toggle('warn',s<=10); if(s<=0) clearInterval(timerTick); };
    upd(); timerTick=setInterval(upd,500);
  }
  return { render, reset(){ disposeD(); hideStage(); setFast(false); V=null; SC=null; gameId=null; lastPhase=''; } };
}
