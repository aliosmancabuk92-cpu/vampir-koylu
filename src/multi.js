/* =====================================================================
   ARKADAŞLARLA OYNA — köy akışı (host mantığı + köy sahneli ekranlar)
   index.html bağlantı/lobi işini yapar, oyun içini bu modül yönetir.
   ===================================================================== */
import * as SC from './scenes.js';
import * as BT from './bots.js';
export { BOT_LEVELS, BOT_NAMES, BOT_NAMES_F } from './bots.js';
import { createVillage } from './village.js';
import { createScene } from './scene.js';
import * as LN from './lines.js';
import SFX from './sfx.js';
import { stageWanted, stage3d, hideStage, loadingHTML, setRenderPref } from './stage-prefs.js';
import { createSpeaker, prefetchLines, loadVoices } from './voice.js';

export const unlockAudio=()=>SFX.unlock();
export const ROLE_INFO = {
  vampir:{ name:'Vampir', ic:'🧛', desc:'Her gece diğer vampirlerle bir köylünün evine girip kanını emersiniz. Gündüz masum rolü yapın. Köylü sayısı vampirlere eşitlenince kazanırsınız.' },
  doktor:{ name:'Doktor', ic:'🩺', desc:'Her gece bir evi korursun. Vampir o eve girerse kimse ölmez. Kendini de koruyabilirsin.' },
  kahin: { name:'Kâhin', ic:'🔮', desc:'Her gece bir eve bakar, oradakinin vampir olup olmadığını öğrenirsin. Bilgini akıllıca kullan.' },
  koylu: { name:'Köylü', ic:'🧑‍🌾', desc:'Özel gücün yok ama oy senin silahın. Konuş, şüphelen, doğru kişiyi meydana getir.' },
};
const AVATARS=['👩','👨','👵','👴','🧔','👱‍♀️','👩‍🦰','👨‍🦱','👩‍🦳','🧑','👨‍🌾','👩‍🍳','🧕','👲','👩‍🦱','👨‍🦳'];
const MIN_PLAYERS=4; export const MAX_PLAYERS=16;
const DEF_SEC=45, SEL_SEC=60, FIN_SEC=60;
const P=(S,id)=>S.players.find(p=>p.id===id);
const alive=(S)=>S.players.filter(p=>p.alive);
const shuffle=(a)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const pickR=(a)=>a[Math.floor(Math.random()*a.length)];
const roleSuffix=(r)=>({koylu:'ymüş',doktor:'muş',kahin:'miş',vampir:'miş'})[r]||'miş';
function roleCounts(n){ const v=n>=12?3:n>=8?2:1; return { vampir:v, doktor:1, kahin:1, koylu:n-v-2 }; }

/* =================== HOST =================== */
export function newGameFields(S){
  Object.assign(S,{ phase:'lobby', day:0, roleAck:{}, night:null, lastNight:null, lastVote:null, winner:null, timerEnd:null,
    act:0, evs:[], vstate:{}, sel:{}, accused:null, defense:null, fin:{}, pleaded:false, hangCount:0, stakeCount:0, gameId:(S.gameId||0) });
}
function startAct(S){ S.act=(S.act||0)+1; S.evs=[]; }
function ev(S,e){ e.day=S.day; S.evs.push(e); }
function say(S,p,text,kind='talk'){ ev(S,{ t:'say', who:p?p.id:null, name:p?p.name:'Anlatıcı', title:p?.title||'', avatar:p?p.avatar:'🌙', pitch:p?.pitch||1, arch:p?.arch||null, text, voice:LN.spokenFor(text), kind }); }
function narr(S,text){ ev(S,{ t:'narr', who:null, name:'Anlatıcı', avatar:'🌙', text, voice:LN.spokenFor(text), kind:'narr' }); }
const RS=LN.regSpoken;
function sfx(S,name){ ev(S,{t:'sfx',name}); }
/** botlar için gecikmeli iş: aşama/gün değişmişse iptal */
function later(S,ctx,ms,fn){ const ph=S.phase, day=S.day, gid=S.gameId; const run=()=>{ if(S.phase!==ph||S.day!==day||S.gameId!==gid) return; fn(); ctx.broadcast(); };
  if(ctx.later) ctx.later(ms,run); else setTimeout(run,ms); }
const observe=(S,o)=>{ try{ BT.botsObserve(S,o); }catch(e){} };
const io=(S)=>({ say:(p,t,k)=>say(S,p,t,k), narr:(t)=>narr(S,t), sfx:(n)=>sfx(S,n), ev:(e)=>ev(S,e), rnd:Math.random });
function vstate(S){ const s={}; const hanged=S.players.filter(p=>p.fate==='hanged').sort((a,b)=>a.hangOrder-b.hangOrder).slice(-3);
  for(const p of S.players){ if(p.fate==='impaled') s[p.id]={impaled:true,stakeK:p.stakeK,ash:!!p.ash}; else if(p.fate==='hanged'&&hanged.includes(p)) s[p.id]={hanged:true,hangK:hanged.indexOf(p)}; else if(!p.alive) s[p.id]={dead:true}; }
  S.vstate=s; }
const speaker=(S,ex=[])=>{ const c=alive(S).filter(p=>!ex.includes(p)); return c.length?pickR(c):null; };
const muhtar=(S)=>alive(S).find(p=>p.title==='Muhtar')||speaker(S);
const NEG=new Set([LN.ACCUSE, LN.ACCUSE_HERD, LN.SEER_VAMP, LN.COUNTER_SEER, LN.RESPONSE_DOUBT]);
const line=(arr,m)=>LN.fillT(LN.pick(arr),m||{},NEG.has(arr));
/* kadın karakter tipleri (odalı mod, karışık kadro) */
const FEMALE_ARCH=[ { key:'kadin1', title:'Teyze', pitch:1.4 }, { key:'kadin2', title:'Gelin', pitch:1.35 }, { key:'kadin3', title:'Nine', pitch:1.5 } ];
const M_AV=['👨','👴','🧔','👨‍🦱','👨‍🦳','🧑','👨‍🌾','👲','🧓','👱‍♂️','👨‍🦰','🤵','🧑‍🌾','👷‍♂️','🧑‍🦲','🤠'];
const F_AV=['👩','👵','👱‍♀️','👩‍🦰','👩‍🦳','🧕','👩‍🌾','👩‍🦱','👩‍🍳'];

export function hostStart(S){
  const n=S.players.length; if(n<MIN_PLAYERS) return false;
  const rc=roleCounts(n); const pool=[]; for(const [r,c] of Object.entries(rc)) for(let i=0;i<c;i++) pool.push(r);
  const sh=shuffle(pool); const mav=shuffle(M_AV), fav=shuffle(F_AV); const arch=[LN.ARCHETYPES[0], ...shuffle(LN.ARCHETYPES.slice(1))]; const farch=shuffle(FEMALE_ARCH);
  const allMale=(S.settings?.cast||'mixed')==='male';
  let mi=0, fi=0; const order=shuffle(S.players.map((_,i)=>i));
  for(const i of order){ const p=S.players[i]; p.role=sh[i]; p.alive=true; p.fate=null; p.hangOrder=null; p.stakeK=null; p.claimed=null;
    const g=allMale?'m':(p.gender==='f'?'f':'m'); p.sex=g;
    if(g==='f'){ const a=farch[fi%farch.length]; p.arch=a.key; p.title=a.title; p.pitch=a.pitch; p.avatar=fav[fi%fav.length]; fi++; }
    else { const a=arch[mi%arch.length]; p.arch=a.key; p.title=a.title; p.pitch=a.pitch; p.avatar=mav[mi%mav.length]; mi++; } }
  const gid=(S.gameId||0)+1; newGameFields(S); S.gameId=gid;
  S.phase='roles'; startAct(S);
  for(const p of S.players) if(p.bot){ p.connected=true; S.roleAck[p.id]=true; }
  BT.botsReset(S); S.prevAccusers=[]; S.accusedBy={}; S.defendedBy={};
  return true;
}
export function hostHandle(S,a,ctx){
  const p=P(S,a.from);
  switch(a.type){
    case 'ackRole': if(S.phase==='roles'){ S.roleAck[a.from]=true; if(S.players.every(x=>S.roleAck[x.id]||!x.connected)) toOpening(S,ctx); } break;
    case 'select': if(S.phase==='select'&&p&&p.alive&&a.target!==p.id&&P(S,a.target)?.alive){ S.sel[p.id]=a.target; if(alive(S).every(x=>S.sel[x.id])) resolveSelect(S,ctx); } break;
    case 'defense': if(S.phase==='defense'&&a.from===S.accused) doDefense(S,a,ctx); break;
    case 'talk': humanTalk(S,p,a,ctx); break;
    case 'intervene': if(S.phase==='final'&&p&&p.alive&&p.id!==S.accused&&!(S.ivd||={})[p.id]){ S.ivd[p.id]=1; const acc=P(S,S.accused); const k=a.kind==='support'?'support':'refute'; say(S,p,LN.fillT(LN.pick(LN.INTERVENE[k]),{t:acc.name})); applyObs(S,[{ t:k==='support'?'defend':'accuse', from:p.id, to:acc.id, pow:0.6 }]); ev(S,{ t:'stance', marks:BT.botStance(S,acc,1) }); } break;
    case 'final': if(S.phase==='final'&&p&&p.alive&&p.id!==S.accused&&!S.fin[p.id]&&(a.v==='hang'||a.v==='release')) lockVote(S,p,a.v,ctx); break;
    case 'night': if(S.phase==='night'&&p&&p.alive) nightAction(S,p,a.target,ctx); break;
    case 'next': if(a.from===S.hostId) hostNext(S,ctx); break;
  }
}
export function hostNext(S,ctx){
  ctx.clearTimer();
  switch(S.phase){
    case 'roles': toOpening(S,ctx); break;
    case 'opening': toDiscussion(S,ctx); break;
    case 'discussion': toSelect(S,ctx); break;
    case 'select': resolveSelect(S,ctx); break;
    case 'defense': doDefense(S,{key:'silent'},ctx); break;
    case 'final': resolveFinal(S,ctx); break;
    case 'verdict': toNight(S,ctx); break;
    case 'night': { const al=alive(S); al.filter(x=>x.role==='vampir'&&!S.night.vampVotes[x.id]).forEach(x=>S.night.vampVotes[x.id]='__none'); S.night.doctor=S.night.doctor||'__none'; S.night.seer=S.night.seer||'__none'; resolveNight(S,ctx); break; }
    case 'dawn': toDiscussion(S,ctx); break;
  }
}

/* ---- açılış ---- */
function toOpening(S,ctx){
  S.phase='opening'; S.day=1; startAct(S);
  ev(S,{t:'gather'}); sfx(S,'bell');
  const cast=shuffle(alive(S)); const m=cast.find(p=>p.title==='Muhtar'); if(m){ cast.splice(cast.indexOf(m),1); cast.unshift(m); }
  for(const s of LN.OPENING){ const who=cast[s.who%cast.length]; if(s.sfx) sfx(S,s.sfx); say(S,who,LN.pick([s.text])); }
  sfx(S,'murmur');
  vstate(S);
}
/* ---- tartışma (yüz yüze) ---- */
function toDiscussion(S,ctx){
  S.phase='discussion'; startAct(S);
  ev(S,{t:'gather'}); sfx(S,'murmur');
  narr(S, S.day===1 ? 'Şimdi yüz yüze konuşun! Kim vampir olabilir? Herkes fikrini söylesin.' : 'Meydanda toplanıldı. Konuşun bakalım, dün gece ne oldu?');
  S.timerEnd=Date.now()+(S.settings.discussionSec||120)*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='discussion'){ toSelect(S,ctx); ctx.broadcast(); } });
  S.accusedBy={}; S.defendedBy={}; S.spoke=[];
  const span=Math.max(10,(S.settings.discussionSec||120)*0.72)*1000; const bs=alive(S).filter(p=>p.bot);
  bs.forEach((p,i)=>{ const n=Math.random()<.55?2:1; for(let k=0;k<n;k++) later(S,ctx,3500+Math.random()*span,()=>botSpeak(S,p)); });
}
function botSpeak(S,p){ if(!p.alive) return; const today=new Set(S.spoke||[]); const r=BT.botTalk(S,p,today); for(const [w,t,k] of r.say) say(S,w,t,k||'talk'); applyObs(S,r.obs); (S.spoke||=[]).push(p.id); }
function applyObs(S,obs){ for(const o of obs||[]){ observe(S,o); if(o.t==='accuse'){ (S.accusedBy[o.to]||=[]).push(o.from); } if(o.t==='defend'){ (S.defendedBy[o.to]||=[]).push(o.from); } if(o.t==='claimSeer'){ const c=P(S,o.from); if(c){ c.claimed='kahin'; c.lastSeerTarget=o.to; } } if(o.t==='claimDoctor'){ const c=P(S,o.from); if(c) c.claimed='doktor'; } } }
/** insanın tartışmadaki sözü (düğmeyle): sahnede seslendirilir, botlar tavır alır */
const TALK_GAP=5000;
function humanTalk(S,p,a,ctx){
  if(S.phase!=='discussion'||!p||!p.alive) return; const now=Date.now(); if((p._lastTalk||0)>now-TALK_GAP) return; p._lastTalk=now;
  const t=P(S,a.target); const needT=['accuse','defend','press','ally'].includes(a.kind); if(needT&&(!t||!t.alive||t===p)) return;
  (S.spoke||=[]).push(p.id);
  switch(a.kind){
    case 'accuse': { const rs=LN.ACCUSE_WHY[a.reason]?a.reason:'gut'; let truth=null, pow=1;
      if(rs==='quiet'){ truth=!(S.spoke||[]).includes(t.id); pow=truth?1.3:0.35; } else if(rs==='pushed'){ truth=(S.prevAccusers||[]).includes(t.id); pow=truth?1.5:0.4; } else if(rs==='gut') pow=0.6;
      say(S,p,LN.fillT(LN.pick(LN.ACCUSE_WHY[rs]),{t:t.name})); applyObs(S,[{ t:'accuse', from:p.id, to:t.id, pow }]);
      for(const [w,x] of BT.botReactions(S,p,t,1,truth)) say(S,w,x); ev(S,{ t:'stance', marks:BT.botStance(S,t,1) }); break; }
    case 'defend': { const rs=LN.DEFEND_WHY[a.reason]?a.reason:'vouch'; let truth=null, pow=rs==='alibi'?1:0.85;
      if(rs==='seer'){ truth=alive(S).some(x=>x.claimed==='kahin'&&x.lastSeerClean===t.id); pow=truth?1.5:0.4; }
      say(S,p,LN.fillT(LN.pick(LN.DEFEND_WHY[rs]),{t:t.name})); applyObs(S,[{ t:'defend', from:p.id, to:t.id, pow }]);
      for(const [w,x] of BT.botReactions(S,p,t,-1,truth)) say(S,w,x); ev(S,{ t:'stance', marks:BT.botStance(S,t,-1) }); break; }
    case 'press': { say(S,p,LN.fillT(LN.pick(LN.PRESS.ask),{y:t.name}));
      if(t.bot){ const k=BT.botPressed(S,t); say(S,t,LN.pick(LN.PRESS[k])); observe(S,{ t:'self', who:t.id, v:k==='bad'?0.9:k==='angry'?0.25:-0.3 }); } ev(S,{ t:'stance', marks:BT.botStance(S,t,1) }); break; }
    case 'ally': { say(S,p,LN.fillT(LN.pick(LN.ALLY.ask),{y:t.name})); if(t.bot){ const ok=BT.botAlly(S,t,p); say(S,t,LN.pick(ok?LN.ALLY.yes:LN.ALLY.no)); } break; }
    case 'calm': say(S,p,LN.pick(LN.CALM)); observe(S,{ t:'self', who:p.id, v:-0.15 }); break;
    case 'oath': say(S,p,LN.pick(LN.OATH)); observe(S,{ t:'self', who:p.id, v:-0.25 }); break;
    default: return;
  }
}
/* ---- ev seçimi ---- */
function toSelect(S,ctx){
  S.phase='select'; S.sel={}; startAct(S);
  const m=muhtar(S); const t=line(LN.SELECT_INTRO); if(m) say(S,m,t); else narr(S,t);
  ev(S,{t:'disperse'});
  S.timerEnd=Date.now()+(S.settings.voteSec||SEL_SEC)*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='select'){ resolveSelect(S,ctx); ctx.broadcast(); } });
  for(const p of alive(S).filter(x=>x.bot)) later(S,ctx,2500+Math.random()*9000,()=>{ if(S.sel[p.id]||!p.alive) return; const tally={}; for(const v of Object.values(S.sel)) tally[v]=(tally[v]||0)+1; const t=BT.botSelect(S,p,tally); if(!t) return; S.sel[p.id]=t.id; if(alive(S).every(x=>S.sel[x.id])) resolveSelect(S,ctx); });
}
function resolveSelect(S,ctx){
  ctx.clearTimer();
  const t={}; for(const v of Object.values(S.sel)) t[v]=(t[v]||0)+1;
  let max=0; for(const c of Object.values(t)) max=Math.max(max,c);
  let top=Object.keys(t).filter(id=>t[id]===max).map(id=>P(S,id)).filter(Boolean);
  if(!top.length) top=alive(S);
  const acc=pickR(top);
  startAct(S);
  ev(S,{t:'badges',counts:t});
  const voters=shuffle(Object.keys(S.sel).filter(id=>S.sel[id]===acc.id).map(id=>P(S,id))).slice(0,2);
  for(const v of voters) say(S,v,RS(`Ben ${LN.suf(acc.name,'i')} seçtim!`,'Ben bu herifi seçtim!'));
  narr(S, max ? RS(`En çok seçilen: ${acc.name} (${max} oy). Evinden alınıp meydana getiriliyor!`,'Köy kararını verdi! Evinden alınıp meydana getiriliyor!') : RS(`Kimse seçim yapmadı… kura ${acc.name} çıktı! Meydana!`,'Kimse seçim yapmadı… Kura çekildi! Meydana!'));
  SC.dragScene(io(S),{ acc, others:alive(S).filter(p=>p!==acc) });
  ev(S,{t:'badges',counts:{}});
  S.accused=acc.id; S.selTally=t; S.defense=null; S.defStep=1; S.ivd={};
  S.phase='defense';
  narr(S,RS(`${acc.name}, söz senin. Kendini savun!`,'Söz sende. Kendini savun!'));
  S.timerEnd=Date.now()+DEF_SEC*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='defense'&&S.defStep===1&&!S.defense){ doDefense(S,{key:'silent'},ctx); ctx.broadcast(); } });
  if(acc.bot) later(S,ctx,2600,()=>doDefense(S,{ key:'bot' },ctx));
}
/* ---- savunma ---- */
function doDefense(S,a,ctx){
  if(S.defStep===2) return defense2(S,a,ctx); if(S.defStep===3) return defense3(S,a,ctx); if(S.defense) return;
  ctx.clearTimer();
  const acc=P(S,S.accused); startAct(S);
  const others=alive(S).filter(p=>p!==acc);
  if(acc.bot && a.key==='bot'){ const r=BT.botDefense(S,acc); for(const [w,t,k] of r.say) say(S,w,t,k||'talk'); applyObs(S,r.obs); S.defense='bot'; return askQuestion(S,acc,ctx); }
  const key=a.key==='innocent'?'witness':(a.key||'silent'); const txt=(k)=>LN.DEFENSE_OPEN.find(x=>x.key===k).text;
  switch(key){
    case 'witness': { let o=P(S,a.target); if(!o||!o.alive||o===acc) o=pickR(others); say(S,acc,LN.fillT(txt('witness'),{o:o.name})); observe(S,{ t:'self', who:acc.id, v:-0.3 });
      if(o.bot){ const yes=BT.botWitness(S,o,acc); say(S,o,LN.pick(yes?LN.WITNESS_YES:LN.WITNESS_NO)); observe(S,{ t:'self', who:acc.id, v:yes?-0.5:0.6 }); } break; }
    case 'blame': { const t=P(S,a.target)||pickR(others); say(S,acc,RS(`Beni bırakın, asıl vampir ${t.name}! Gözlerine bakın gözlerine!`,'Beni bırakın, asıl vampir bu herif! Gözlerine bakın gözlerine!')); applyObs(S,[{ t:'accuse', from:acc.id, to:t.id, pow:0.8 }]); break; }
    case 'role': { const r=ROLE_INFO[a.role]?a.role:'koylu'; acc.claimed=r; say(S,acc, r==='koylu'?'Ben düz köylüyüm la, bi suçum yok! Yapmayın!':`Dinleyin beni: ben ${ROLE_INFO[r].name.toLowerCase()}${r==='doktor'?'um':'im'}! Beni asarsanız köy biter.`); if(r==='doktor') observe(S,{ t:'claimDoctor', from:acc.id }); break; }
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
  if(acc.bot) later(S,ctx,2400,()=>defense2(S,{ i:acc.role==='vampir'&&Math.random()<.45?2:Math.floor(Math.random()*2) },ctx));
}
function defense2(S,a,ctx){ if(S.phase!=='defense'||S.defStep!==2) return; ctx.clearTimer(); const acc=P(S,S.accused); const Q=LN.DEFENSE_Q[S.defQ]; const x=Q.a[+a.i]||Q.a[1];
  say(S,acc,x.text); observe(S,{ t:'self', who:acc.id, v:x.v>0?-0.4:x.v<0?0.5:0 });
  S.defStep=3; S.timerEnd=Date.now()+20000; ctx.armTimer(S.timerEnd,()=>{ if(S.phase==='defense'&&S.defStep===3){ defense3(S,{ key:'forgive' },ctx); ctx.broadcast(); } });
  if(acc.bot) later(S,ctx,2000,()=>defense3(S,{ key:pickR(LN.LAST_WORD).key },ctx)); }
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
  S.timerEnd=Date.now()+(S.settings.voteSec||FIN_SEC)*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='final'){ resolveFinal(S,ctx); ctx.broadcast(); } });
  for(const p of eligible(S).filter(x=>x.bot)) later(S,ctx,2500+Math.random()*9000,()=>{ if(S.fin[p.id]||!p.alive) return; const hangs=Object.values(S.fin).filter(v=>v==='hang').length; lockVote(S,p,BT.botFinal(S,p,acc,hangs,eligible(S).length),ctx); });
  if(!eligible(S).length) resolveFinal(S,ctx);
}
const eligible=(S)=>alive(S).filter(p=>p.id!==S.accused);
function lockVote(S,p,v,ctx){
  S.fin[p.id]=v;
  say(S,p,`${v==='hang'?'AS':'BIRAK'}! ${LN.pick(LN.LOCK)}`);
  ev(S,{t:'lock',who:p.id,v});
  const el=eligible(S); const hangs=Object.values(S.fin).filter(x=>x==='hang').length;
  if(!S.pleaded && hangs>el.length/2){ S.pleaded=true; const acc=P(S,S.accused); say(S,acc,LN.pick(LN.PLEAD)); }
  if(el.every(x=>S.fin[x.id])) resolveFinal(S,ctx);
}
function resolveFinal(S,ctx){
  ctx.clearTimer(); S.timerEnd=null;
  const acc=P(S,S.accused);
  const hang=Object.values(S.fin).filter(v=>v==='hang').length, rel=Object.values(S.fin).filter(v=>v==='release').length;
  startAct(S);
  narr(S,RS(`Sonuç: ${hang} AS, ${rel} BIRAK.`, hang>rel?'Oylar sayıldı. Köy AS dedi!':'Oylar sayıldı. Köy BIRAK dedi!'));
  if(hang>rel) execute(S,acc,hang,rel);
  else { ev(S,{t:'release',who:acc.id}); say(S,muhtar(S)||acc,LN.pick(LN.RELEASE)); S.lastVote={hanged:null,name:acc.name,released:true,hang,rel}; S.phase='verdict'; }
  vstate(S);
  checkWin(S);
}
function execute(S,acc,hang,rel){
  const res=SC.executeScene(io(S),{ acc, alive:alive(S), pleaded:!!S.pleaded, onStakeK:()=>{ acc.stakeK=(S.stakeCount++)%3; return acc.stakeK; } });
  { const accusers=S.accusedBy?.[acc.id]||[], voters=Object.keys(S.fin||{}).filter(k=>S.fin[k]==='hang'), defenders=S.defendedBy?.[acc.id]||[];
    observe(S,{ t:'hanged', who:acc.id, role:acc.role, accusers, voters, defenders }); if(acc.role!=='vampir') S.prevAccusers=[...accusers]; }
  if(acc.role==='vampir'){ acc.alive=false; acc.fate='impaled'; acc.ash=!!res.ash; }
  else {
    acc.alive=false; acc.fate='hanged'; acc.hangOrder=S.hangCount++;
    const s1=speaker(S,[acc]); if(s1) say(S,s1,LN.pick(LN.HANG_VILLAGER));
    narr(S,RS(`${acc.name} ${ROLE_INFO[acc.role].name.toLowerCase()}${roleSuffix(acc.role)}.`,`Meğer ${ROLE_INFO[acc.role].name.toLowerCase()}${roleSuffix(acc.role)}!`));
  }
  S.lastVote={hanged:acc.id,name:acc.name,role:acc.role,hang,rel};
  S.phase='verdict';
}
/* ---- gece ---- */
function toNight(S,ctx){
  S.phase='night'; startAct(S); S.night={vampVotes:{},doctor:null,seer:null,seerResult:null};
  ev(S,{t:'home'}); ev(S,{t:'night',on:true}); sfx(S,'howl');
  { const ni=line(LN.NIGHT_INTRO); narr(S,RS(ni+' Vampirler, doktor ve kâhin: telefonlarınızdan seçin.',ni)); }
  S.timerEnd=null; checkNightDone(S,ctx);
  const humanV=alive(S).some(x=>x.role==='vampir'&&!x.bot);
  for(const p of alive(S).filter(x=>x.bot&&['vampir','doktor','kahin'].includes(x.role))){ if(p.role==='vampir'&&humanV) continue;
    later(S,ctx,2500+Math.random()*5000,()=>{ const t=BT.botNight(S,p); nightAction(S,p,t?t.id:'__none',ctx); }); }
  if(humanV) later(S,ctx,45000,()=>{ for(const p of alive(S).filter(x=>x.bot&&x.role==='vampir'&&!S.night.vampVotes[x.id])){ const t=BT.botNight(S,p); nightAction(S,p,t?t.id:'__none',ctx); } });
}
function nightAction(S,p,target,ctx){
  if(target==='__none'){ if(p.role==='vampir') S.night.vampVotes[p.id]='__none'; else if(p.role==='doktor') S.night.doctor=S.night.doctor||'__none'; else if(p.role==='kahin') S.night.seer=S.night.seer||'__none'; checkNightDone(S,ctx); return; }
  if(!P(S,target)?.alive) return;
  if(p.role==='vampir'){ if(P(S,target).role==='vampir') return; S.night.vampVotes[p.id]=target; if(!p.bot) for(const b of alive(S).filter(x=>x.bot&&x.role==='vampir'&&!S.night.vampVotes[x.id])) S.night.vampVotes[b.id]=target; }
  else if(p.role==='doktor'){ if(S.night.doctor) return; S.night.doctor=target; }
  else if(p.role==='kahin'){ if(S.night.seer||target===p.id) return; S.night.seer=target; S.night.seerResult=P(S,target).role==='vampir'; if(p.bot) BT.botSeerResult(p,target,S.night.seerResult); }
  checkNightDone(S,ctx);
}
function checkNightDone(S,ctx){
  const al=alive(S); const vamps=al.filter(x=>x.role==='vampir');
  const doc=al.find(x=>x.role==='doktor'); const seer=al.find(x=>x.role==='kahin');
  if(vamps.every(v=>S.night.vampVotes[v.id]) && (!doc||S.night.doctor) && (!seer||S.night.seer)) resolveNight(S,ctx);
}
function resolveNight(S,ctx){
  const tally={}; Object.values(S.night.vampVotes).forEach(t=>{ if(t&&t!=='__none') tally[t]=(tally[t]||0)+1; });
  let victim=null,max=0; for(const [t,c] of Object.entries(tally)){ if(c>max||(c===max&&Math.random()<.5)){max=c;victim=t;} }
  const saved=victim&&S.night.doctor===victim; let killed=null;
  if(victim&&!saved){ const v=P(S,victim); v.alive=false; v.fate='killed'; killed=v; }
  S.lastNight={ killed:killed?killed.id:null, saved:!!saved, seer:(S.night.seer&&S.night.seer!=='__none')?{target:S.night.seer,isVamp:S.night.seerResult}:null };
  S.day++; startAct(S);
  ev(S,{t:'night',on:false}); sfx(S,'bell');
  const m=muhtar(S);
  if(killed){ ev(S,{t:'dead',who:killed.id}); const t=line(LN.DAWN_DEAD,{v:killed.name}); if(m) say(S,m,t); else narr(S,t); narr(S,RS(`${killed.name} ${ROLE_INFO[killed.role].name.toLowerCase()}${roleSuffix(killed.role)}.`,`Meğer ${ROLE_INFO[killed.role].name.toLowerCase()}${roleSuffix(killed.role)}!`)); }
  else { const t=line(saved?LN.DAWN_SAVED:LN.DAWN_NONE); if(m) say(S,m,t); else narr(S,t); }
  S.phase='dawn'; vstate(S);
  checkWin(S);
}
/* ---- bitiş ---- */
function checkWin(S){
  const al=alive(S); const v=al.filter(p=>p.role==='vampir').length; const o=al.length-v;
  if(v===0) S.winner='koylu'; else if(v>=o) S.winner='vampir'; else return false;
  S.phase='end'; S.timerEnd=null;
  if(S.winner==='vampir'){
    const vamps=al.filter(p=>p.role==='vampir'); const vills=al.filter(p=>p.role!=='vampir');
    SC.vampWinScene(io(S),{ vamps, vills, multi:S.players.filter(p=>p.role==='vampir').length>1 });
    vills.forEach(p=>{ p.fate='bitten'; });
  } else SC.villageWinScene(io(S),{ alive:al });
  vstate(S);
  return true;
}

/* =================== İSTEMCİ ARAYÜZÜ =================== */
const MODE3D={ roles:'roles', opening:'talk', discussion:'talk', select:'select', defense:'defense', final:'final', verdict:'verdict', night:'night', dawn:'dawn', end:'end' };
const ACC_R=[['night','Gece dışarıdaydı'],['quiet','Hiç konuşmuyor'],['pushed','Dün masumu astırdı'],['lie','Lafı tutmuyor'],['gut','İçimden bir ses']];
const DEF_R=[['alibi','Gece benimleydi'],['seer','Kâhin temiz dedi'],['accuser','Suçlayan şüpheli'],['vouch','Ona kefilim']];
export function createMultiUI({ app, esc, voice, send, toast, isHost, meId, onLeave }){
  let talkMode=null, talkReason=false;
  let V=null, SC=null, D=null, is3d=false, loading3d=false, gameId=null, act=-1, idx=0, sel=null, finChoice=null, defMode=null, roleClaim=null, S=null, lines=[], timerTick=null, lastPhase='';
  const mine=()=>S&&P(S,meId());
  const speaker=createSpeaker(voice); loadVoices();
  const disposeD=()=>{ if(D){ try{ D.dispose(); }catch(e){} D=null; } };

  function build(){
    disposeD(); SC=null; V=null; act=-1; idx=0; lines=[];
    is3d=stageWanted();
    if(is3d){
      app.innerHTML=`<div class="game g3d fade"><div class="topbar" id="mTop"></div><div class="spacer"></div><div class="subs" id="mLines"></div><div id="mPanel"></div>${loadingHTML()}</div>`;
      const gid=gameId; loading3d=true;
      (async()=>{ try{
        const S3=await stage3d(); S3.showStage(true); const bar=app.querySelector('#gLoadBar');
        await S3.ensureStage((p)=>{ if(bar) bar.style.width=Math.round(p*100)+'%'; });
        if(gid!==gameId || !S) return;
        D=await S3.newDirector(S.players.map(p=>({ ...p, human:p.id===meId(), name:p.name })),{ voice, onLine:addLine, onPick:onHouse, speak:speaker, prefetch:prefetchLines, meId:meId() });
        SC=D; V={ highlight:(id,on)=>D.highlight(id,on) }; loading3d=false;
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
    SC=createScene({ village:V, voice, onLine:addLine, speak:speaker });
    V.setNight(false);
  }
  function sync3d(){ if(!is3d||!D||!SC||SC.busy||!S) return; D.setMode(MODE3D[S.phase]||'talk'); D.setCandidates(pickCands()); }
  function addLine(e){ lines.push(e); if(lines.length>3) lines.shift(); const el=app.querySelector('#mLines'); if(!el) return;
    if(is3d){ const l=e; const pv=lines.length>1?lines[lines.length-2]:null; const cut=(t,n)=>t.length>n?t.slice(0,n-2)+'…':t;
      el.innerHTML=`${pv?`<div class="prev">${esc(pv.t==='narr'?'Anlatıcı':pv.name)}: ${esc(cut(pv.text,72))}</div>`:''}<div class="who">${l.t==='narr'?'🌙 Anlatıcı':`${esc(l.avatar)} ${esc(l.name)}${l.title?` <span class="tt">· ${esc(l.title)}</span>`:''}`}</div><div class="tx ${l.t==='narr'?'narr':''} ${l.kind==='scream'?'scream':''}">${esc(l.text)}</div>`; return; }
    el.innerHTML=lines.map((l,i)=>`<div class="ln ${l.t==='narr'?'narr':''} ${l.kind==='scream'?'scream':''} ${i===lines.length-1?'last':''}"><b>${l.t==='narr'?'🌙':esc(l.avatar)} ${esc(l.name)}${l.title?` <span class="tt">${esc(l.title)}</span>`:''}:</b> ${esc(l.text)}</div>`).join(''); }

  function render(state){
    S=state; if(!S) return;
    if(gameId!==S.gameId || !app.querySelector('#mTop')){ gameId=S.gameId; lastPhase=''; build(); }
    if(!SC){ drawTop(); return; }
    if(S.phase!==lastPhase){ lastPhase=S.phase; sel=null; finChoice=null; defMode=null; roleClaim=null; talkMode=null; talkReason=false; V.highlight(null); }
    // sahne olayları
    let fresh=[];
    if(S.act!==act){ act=S.act; idx=0; }
    if(S.evs && S.evs.length>idx){ fresh=S.evs.slice(idx); idx=S.evs.length; }
    if(fresh.length){ if(is3d&&D) D.setCandidates(null); SC.play(fresh, ()=>{ SC.sync(S.vstate||{}); drawPanel(); sync3d(); }); }
    else if(!SC.busy) SC.sync(S.vstate||{});
    drawTop(); drawPanel(); sync3d();
  }
  function drawTop(){
    const t=app.querySelector('#mTop'); if(!t) return; const m=mine();
    const ph={roles:'Roller',opening:'Meydan',discussion:'Tartışma',select:'Seçim',defense:'Savunma',final:'Son karar',verdict:'Hüküm',night:'Gece',dawn:'Sabah',end:'Bitti'}[S.phase]||'';
    t.innerHTML=`<span class="pill">Oda <b style="color:var(--gold)">${S.code}</b></span><span class="pill">${S.day?`Gün ${S.day} · `:''}${ph}</span>${m&&m.role?`<span class="pill">${ROLE_INFO[m.role].ic}</span>`:''}<button id="mVoice">${voice.on?'🔊':'🔇'}</button>`;
    t.querySelector('#mVoice').onclick=()=>{ voice.set(!voice.on); if(!voice.on){ try{speechSynthesis.cancel();}catch(e){} } else SFX.unlock(); drawTop(); };
  }
  function pickCands(){
    const m=mine(); if(!m||!m.alive||SC?.busy) return null;
    if(S.phase==='select'&&!S.sel[m.id]) return alive(S).filter(p=>p.id!==m.id).map(p=>p.id);
    if(S.phase==='night') return nightCands(m);
    if(S.phase==='defense'&&S.accused===m.id&&(defMode==='blame'||defMode==='innocent'||defMode==='witness')) return alive(S).filter(p=>p.id!==m.id).map(p=>p.id);
    if(S.phase==='discussion'&&talkMode&&!talkReason) return alive(S).filter(p=>p.id!==m.id).map(p=>p.id);
    return null;
  }
  function nightCands(m){
    if(m.role==='vampir'&&!S.night.vampVotes[m.id]) return alive(S).filter(p=>p.role!=='vampir').map(p=>p.id);
    if(m.role==='doktor'&&!S.night.doctor) return alive(S).map(p=>p.id);
    if(m.role==='kahin'&&!S.night.seer) return alive(S).filter(p=>p.id!==m.id).map(p=>p.id);
    return null;
  }
  function onHouse(id){ const c=pickCands(); if(!c||!c.includes(id)) return; sel=id; V.highlight(id,true); drawPanel(); if(is3d&&D) D.setCandidates(c); }
  const chips=(ids,counts)=>`<div class="chips">${ids.map(id=>{ const p=P(S,id); return `<button class="chip ${sel===id?'on':''}" data-chip="${id}">${p.avatar} ${esc(p.id===meId()?p.name+' (sen)':p.name)}${counts&&counts[id]?` <small class="bad">${counts[id]}</small>`:''}</button>`; }).join('')}</div>`;
  const hostBtn=(label,cls='gold')=>isHost()?`<button class="btn ${cls}" id="mNext">${label}</button>`:'';
  const waitNote=(t='Anlatıcının devam etmesi bekleniyor…')=>isHost()?'':`<p class="note pulse">${t}</p>`;
  const timer=()=>S.timerEnd?`<div class="timer" id="mTimer">--</div>`:'';

  function drawPanel(){
    const el=app.querySelector('#mPanel'); if(!el||!S||!SC) return;
    if(SC.busy){ el.innerHTML=is3d?`<div class="skipf"><button id="mSkip">⏩ Geç</button></div>`:`<div class="card panelc"><button class="btn sec" id="mSkip">⏩ Geç</button></div>`; el.querySelector('#mSkip').onclick=()=>SC.skip(); return; }
    const m=mine(); const dead=m&&!m.alive; let html='';
    const deadNote=dead&&S.phase!=='end'?`<div class="note">👻 Öldün; izliyorsun. Rolleri görebilirsin.</div>`:'';
    switch(S.phase){
      case 'roles': {
        if(!m){ html=spect(); break; }
        const r=ROLE_INFO[m.role]; const mates=m.role==='vampir'?S.players.filter(p=>p.role==='vampir'&&p.id!==m.id):[];
        html=`<div class="rolecard ${m.role}" style="padding:16px"><div class="ic" style="font-size:54px">${r.ic}</div><div class="rn">${r.name}</div><div class="rd">${r.desc}</div>${mates.length?`<div style="margin-top:10px;color:var(--blood2);font-weight:800">Diğer vampirler: ${mates.map(x=>esc(x.name)).join(', ')}</div>`:''}<div class="note">Karakterin: ${m.avatar} ${esc(m.title||'')}</div></div>
          ${S.roleAck[m.id]?`<p class="note pulse">Diğerleri bekleniyor… (${Object.keys(S.roleAck).length}/${S.players.length})</p>${hostBtn('Beklemeden başla','sec')}`:`<button class="btn" id="mAck">Anladım, gizle</button>`}`; break; }
      case 'opening': html=`<div class="card panelc" style="text-align:center"><b>Köy meydanda toplandı.</b><div class="note">Konuşmalar bitti mi? Tartışmaya geçelim.</div>${hostBtn('🗣️ Tartışmaya başla')}${waitNote()}</div>`; break;
      case 'discussion': {
        const canTalk=m&&m.alive;
        if(canTalk&&talkMode&&talkReason){ const t=P(S,sel); const rs=talkMode==='accuse'?ACC_R:DEF_R;
          html=`<div class="card panelc"><label>${talkMode==='accuse'?'Neden şüpheleniyorsun':'Neden güveniyorsun'}: <b style="color:var(--gold)">${t?esc(t.name):''}</b></label><div class="acts">${rs.map(r=>`<button class="btn sm ${talkMode==='accuse'?'':'green'}" data-why="${r[0]}">${r[1]}</button>`).join('')}</div><button class="btn sec" id="mTCancel">Vazgeç</button></div>`; }
        else if(canTalk&&talkMode){ const L={ accuse:['Kimi suçlayacaksın?','Devam →',''], defend:['Kimi savunacaksın?','Devam →','green'], press:['Kimi sıkıştıracaksın?','Sıkıştır','blue'], ally:['Kiminle anlaşacaksın?','İttifak öner','blue'] }[talkMode];
          html=`<div class="card panelc"><label>${L[0]}</label>${chips(alive(S).filter(p=>p.id!==m.id).map(p=>p.id))}<div class="row"><button class="btn sec" id="mTCancel">Vazgeç</button><button class="btn ${L[2]}" id="mTDo" ${sel?'':'disabled'}>${L[1]}</button></div></div>`; }
        else html=`<div class="card panelc" style="text-align:center"><b>🗣️ Yüz yüze konuşun! Kim vampir?</b>${timer()}${canTalk?`<div class="acts" style="margin-top:8px">${[['accuse','Suçla',''],['defend','Savun','green'],['press','Sıkıştır','blue'],['ally','İttifak','blue'],['calm','Yatıştır','gold'],['oath','Yemin et','gold']].map(([k,l,c])=>`<button class="btn sm ${c}" data-talk="${k}">${l}</button>`).join('')}</div><div class="note">İstersen düğmeyle konuş: sözün köyde seslendirilir, botlar tavır alır.</div>`:''}${seerNote(m)}${hostBtn('🏠 Seçime geç')}${waitNote('Süre bitince ev seçimine geçilecek…')}</div>${deadNote}`;
        break; }
      case 'select': {
        const voted=Object.keys(S.sel).length, n=alive(S).length;
        if(m&&m.alive&&!S.sel[m.id]) html=`<div class="card panelc"><label>🏠 Şüphelendiğin kişinin evine dokun</label>${timer()}${chips(pickCands())}<button class="btn" id="mSel" ${sel?'':'disabled'}>${sel?`${esc(P(S,sel).name)} meydana getirilsin!`:'Bir ev seç'}</button></div>`;
        else html=`<div class="card panelc" style="text-align:center">${m&&S.sel[m.id]?`Seçimin: <b>${esc(P(S,S.sel[m.id]).name)}</b> ✔`:''}<div class="note">${voted}/${n} kişi seçti</div>${timer()}${hostBtn('Seçimi bitir','sec')}</div>${deadNote}`;
        break; }
      case 'defense': {
        const acc=P(S,S.accused);
        if(m&&m.id===acc.id){
          if(S.defStep===2){ const Q=LN.DEFENSE_Q[S.defQ]; html=`<div class="card panelc" style="border-color:var(--blood2)"><label style="color:var(--blood2)">❓ ${esc(Q.q)}</label>${timer()}<div class="acts">${Q.a.map((x,i)=>`<button class="btn sm" data-dq="${i}">${esc(x.label)}</button>`).join('')}</div></div>`; }
          else if(S.defStep===3) html=`<div class="card panelc" style="border-color:var(--blood2)"><label style="color:var(--blood2)">🗣️ Son sözün?</label>${timer()}<div class="acts">${LN.LAST_WORD.map(o=>`<button class="btn sm sec" data-dl="${o.key}">${esc(o.label)}</button>`).join('')}</div></div>`;
          else if(S.defense) html=`<div class="card panelc" style="text-align:center"><div class="note pulse">Köy dinliyor…</div></div>`;
          else if(defMode==='blame'||defMode==='innocent'||defMode==='witness') html=`<div class="card panelc"><label>${defMode==='blame'?'Kimi işaret edeceksin?':'Kim şahidin?'}</label>${chips(pickCands())}<div class="row"><button class="btn sec" id="mCancel">Vazgeç</button><button class="btn" id="mDefGo" ${sel?'':'disabled'}>Söyle!</button></div></div>`;
          else if(defMode==='role') html=`<div class="card panelc"><label>Hangi rolü söyleyeceksin? (yalan da olabilir)</label><div class="acts">${['koylu','doktor','kahin'].map(r=>`<button class="btn sm sec" data-claimr="${r}">${ROLE_INFO[r].ic} ${ROLE_INFO[r].name}</button>`).join('')}</div><button class="btn sec" id="mCancel">Vazgeç</button></div>`;
          else html=`<div class="card panelc" style="border-color:var(--blood2)"><label style="color:var(--blood2)">⚖️ Meydanda sen varsın! Kendini savun:</label>${timer()}<div class="acts">${LN.DEFENSE_OPEN.map(o=>`<button class="btn sm ${o.key==='silent'?'sec':o.key==='role'?'blue':o.key==='blame'||o.key==='threat'?'':'green'}" data-def="${o.key}">${o.label}</button>`).join('')}</div><div class="note">Sözlü de savunabilirsin; seçimin anlatıcı telefonda okunur.</div></div>`;
        } else html=`<div class="card panelc" style="text-align:center"><b>${acc.avatar} ${esc(acc.name)}</b> savunma yapıyor…${timer()}${hostBtn('Savunmayı geç','sec')}</div>${deadNote}`;
        break; }
      case 'final': {
        const acc=P(S,S.accused); const el2=alive(S).filter(p=>p.id!==S.accused);
        const hangs=Object.values(S.fin).filter(v=>v==='hang').length, rels=Object.values(S.fin).filter(v=>v==='release').length;
        const lockRow=`<div class="note">🔒 ${Object.keys(S.fin).length}/${el2.length} kitledi · 🪢 ${hangs} AS · 🕊️ ${rels} BIRAK</div>`;
        if(m&&m.alive&&m.id!==acc.id&&!S.fin[m.id]) html=`<div class="card panelc"><label>Son karar: <b style="color:var(--gold)">${acc.avatar} ${esc(acc.name)}</b> asılsın mı?</label>${timer()}${lockRow}
          <div class="row"><button class="btn ${finChoice==='hang'?'':'sec'}" data-fv="hang">🪢 AS</button><button class="btn ${finChoice==='release'?'green':'sec'}" data-fv="release">🕊️ BIRAK</button></div>
          ${(S.ivd||{})[m.id]?'':`<div class="row"><button class="btn sm green" data-iv="support">🤝 Araya gir: savun</button><button class="btn sm" data-iv="refute">👊 Çürüt</button></div>`}
          <button class="btn gold" id="mLock" ${finChoice?'':'disabled'}>🔒 Oyumu kitledim</button></div>`;
        else html=`<div class="card panelc" style="text-align:center">${m&&m.id===acc.id?'<b style="color:var(--blood2)">Köy senin hakkında karar veriyor…</b>':m&&S.fin[m.id]?`Oyun: <b>${S.fin[m.id]==='hang'?'🪢 AS':'🕊️ BIRAK'}</b> 🔒`:''}${timer()}${lockRow}${hostBtn('Kararı açıkla','sec')}</div>${deadNote}`;
        break; }
      case 'verdict': {
        const lv=S.lastVote||{};
        html=`<div class="card panelc" style="text-align:center">${lv.hanged?(lv.role==='vampir'?`<div class="big" style="color:var(--blood2)">🧛 VAMPİR ÇIKTI!</div><div class="note">${esc(lv.name)} kalbine kazık çakıldı.</div>`:`<div class="big">🪢 ${esc(lv.name)}</div><div class="note">${ROLE_INFO[lv.role].ic} ${ROLE_INFO[lv.role].name} idi. (${lv.hang} AS / ${lv.rel} BIRAK)</div>`):`<div class="big">🕊️ Bırakıldı</div><div class="note">${esc(lv.name||'')} bugün kurtuldu (${lv.hang} AS / ${lv.rel} BIRAK).</div>`}
          ${hostBtn('🌙 Herkes evine, gece olsun','')}${waitNote()}</div>`; break; }
      case 'night': {
        const c=m&&m.alive?nightCands(m):null;
        if(c){ const t={vampir:'🧛 Kimin evine gireceksin?',doktor:'🩺 Kimin evini koruyacaksın?',kahin:'🔮 Kimin evine bakacaksın?'}[m.role];
          const counts={}; if(m.role==='vampir') Object.values(S.night.vampVotes).forEach(x=>counts[x]=(counts[x]||0)+1);
          html=`<div class="card panelc"><label>${t} <span class="tt">Eve dokun</span></label>${m.role==='vampir'?`<div class="note" style="text-align:left">Vampirler: ${alive(S).filter(p=>p.role==='vampir').map(p=>esc(p.name)).join(', ')}</div>`:''}${chips(c,counts)}<button class="btn ${m.role==='doktor'?'green':m.role==='kahin'?'blue':''}" id="mNightGo" ${sel?'':'disabled'}>${{vampir:'Kanını em',doktor:'Koru',kahin:'Bak'}[m.role]}</button></div>`; }
        else if(m&&m.alive&&m.role==='kahin'&&S.night.seer){ const t=P(S,S.night.seer); html=`<div class="card panelc" style="text-align:center">🔮 <b>${esc(t.name)}</b> ${S.night.seerResult?'<span class="bad">bir VAMPİR!</span>':'<span class="ok">vampir değil.</span>'}<div class="note">Sadece sen biliyorsun.</div></div>`; }
        else html=`<div class="card panelc" style="text-align:center"><div style="font-size:44px">😴</div><b>${m&&m.alive?(m.role==='koylu'?'Uyuyorsun':'Seçimin kaydedildi'):'Gece…'}</b><div class="note">Telefonuna bakıyormuş gibi yap, kimse rolünü anlamasın.</div></div>`;
        html+=hostBtn('Geceyi zorla bitir','sec')+deadNote; break; }
      case 'dawn': html=`${seerNote(m)}<div class="card panelc" style="text-align:center">${hostBtn('🔔 Meydana toplan')}${waitNote()}</div>${deadNote}`; break;
      case 'end': {
        const w=S.winner; const won=m?((m.role==='vampir')===(w==='vampir')):null;
        html=`<div class="banner ${w==='vampir'?'night':'day'}"><div class="big">${w==='vampir'?'🧛':'🏆'}</div><div class="t">${w==='vampir'?'Vampirler kazandı!':'Köylüler kazandı!'}</div>${won!==null?`<div class="d">${won?'Sen kazandın!':'Sen kaybettin.'}</div>`:''}</div>
          <div class="card"><label>Roller</label><ul class="plist">${S.players.map(p=>`<li class="${p.alive?'':'dead'} ${p.id===meId()?'me':''}"><span class="av">${p.avatar||'🙂'}</span><span class="nm">${esc(p.name)}</span><span class="tag">${ROLE_INFO[p.role].ic} ${ROLE_INFO[p.role].name}</span></li>`).join('')}</ul></div>
          ${isHost()?`<button class="btn" id="mRestart">Yeni Oyun (aynı oyuncular)</button>`:'<p class="note pulse">Anlatıcı yeni oyun başlatabilir.</p>'}<button class="btn sec" id="mLeave">Odadan Ayrıl</button>`; break; }
    }
    if(dead && S.phase!=='end') html+=rolesCard();
    if(is3d && (S.phase==='end' || dead)) html=`<div class="sheet-scroll">${html}</div>`;
    el.innerHTML=html; bind(el); runTimer(); if(is3d) sync3d();
  }
  function seerNote(m){ const sr=S.lastNight?.seer; if(!m||m.role!=='kahin'||!sr||!m.alive) return ''; const t=P(S,sr.target); if(!t) return ''; return `<div class="card panelc" style="text-align:center;border-color:var(--blue)">🔮 <b>${esc(t.name)}</b> ${sr.isVamp?'<span class="bad">bir VAMPİR!</span>':'<span class="ok">vampir değil.</span>'}<div class="note">Sadece sen biliyorsun.</div></div>`; }
  function spect(){ return `<div class="card panelc" style="text-align:center"><div style="font-size:44px">👻</div><b>Oyun devam ediyor</b><div class="note">Bu tura sonradan geldin, izliyorsun.</div></div>`; }
  function rolesCard(){ return `<div class="card"><label>Roller (sadece ölüler görür)</label><ul class="plist">${S.players.map(p=>`<li class="${p.alive?'':'dead'}"><span class="av">${p.avatar||'🙂'}</span><span class="nm">${esc(p.name)}</span><span class="tag">${ROLE_INFO[p.role].ic} ${ROLE_INFO[p.role].name}</span></li>`).join('')}</ul></div>`; }
  function bind(el){
    const q=(s)=>el.querySelector(s);
    q('#mAck')&&(q('#mAck').onclick=()=>send({type:'ackRole'}));
    q('#mNext')&&(q('#mNext').onclick=()=>{ SFX.unlock(); send({type:'next'}); });
    el.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>onHouse(b.dataset.chip));
    q('#mSel')&&(q('#mSel').onclick=()=>{ if(sel) send({type:'select',target:sel}); });
    el.querySelectorAll('[data-def]').forEach(b=>b.onclick=()=>{ const k=b.dataset.def; if(k==='blame'||k==='witness'||k==='role'){ defMode=k; sel=null; drawPanel(); } else send({type:'defense',key:k}); });
    el.querySelectorAll('[data-dq]').forEach(b=>b.onclick=()=>send({type:'defense',i:+b.dataset.dq}));
    el.querySelectorAll('[data-dl]').forEach(b=>b.onclick=()=>send({type:'defense',key:b.dataset.dl}));
    el.querySelectorAll('[data-iv]').forEach(b=>b.onclick=()=>send({type:'intervene',kind:b.dataset.iv}));
    el.querySelectorAll('[data-talk]').forEach(b=>b.onclick=()=>{ const k=b.dataset.talk; if(k==='calm'||k==='oath'){ send({type:'talk',kind:k}); return; } talkMode=k; talkReason=false; sel=null; drawPanel(); });
    el.querySelectorAll('[data-why]').forEach(b=>b.onclick=()=>{ send({type:'talk',kind:talkMode,target:sel,reason:b.dataset.why}); talkMode=null; talkReason=false; sel=null; V.highlight(null); drawPanel(); });
    q('#mTDo')&&(q('#mTDo').onclick=()=>{ if(!sel) return; if(talkMode==='accuse'||talkMode==='defend'){ talkReason=true; drawPanel(); return; } send({type:'talk',kind:talkMode,target:sel}); talkMode=null; sel=null; V.highlight(null); drawPanel(); });
    q('#mTCancel')&&(q('#mTCancel').onclick=()=>{ talkMode=null; talkReason=false; sel=null; V.highlight(null); drawPanel(); });
    el.querySelectorAll('[data-claimr]').forEach(b=>b.onclick=()=>send({type:'defense',key:'role',role:b.dataset.claimr}));
    q('#mCancel')&&(q('#mCancel').onclick=()=>{ defMode=null; sel=null; V.highlight(null); drawPanel(); });
    q('#mDefGo')&&(q('#mDefGo').onclick=()=>{ send({type:'defense',key:defMode,target:sel}); defMode=null; });
    el.querySelectorAll('[data-fv]').forEach(b=>b.onclick=()=>{ finChoice=b.dataset.fv; drawPanel(); });
    q('#mLock')&&(q('#mLock').onclick=()=>{ if(finChoice) send({type:'final',v:finChoice}); });
    q('#mNightGo')&&(q('#mNightGo').onclick=()=>{ if(sel) send({type:'night',target:sel}); sel=null; V.highlight(null); });
    q('#mRestart')&&(q('#mRestart').onclick=()=>send({type:'restart'}));
    q('#mLeave')&&(q('#mLeave').onclick=()=>onLeave());
  }
  function runTimer(){
    clearInterval(timerTick); const el=app.querySelector('#mTimer'); if(!el||!S.timerEnd) return;
    const upd=()=>{ const s=Math.max(0,Math.ceil((S.timerEnd-Date.now())/1000)); el.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; el.classList.toggle('warn',s<=10); if(s<=0) clearInterval(timerTick); };
    upd(); timerTick=setInterval(upd,500);
  }
  return { render, reset(){ disposeD(); hideStage(); V=null; SC=null; gameId=null; lastPhase=''; } };
}
