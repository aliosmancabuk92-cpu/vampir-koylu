/* =====================================================================
   ARKADAŞLARLA OYNA — köy akışı (host mantığı + köy sahneli ekranlar)
   index.html bağlantı/lobi işini yapar, oyun içini bu modül yönetir.
   ===================================================================== */
import { createVillage } from './village.js';
import { createScene } from './scene.js';
import * as LN from './lines.js';
import SFX from './sfx.js';

export const unlockAudio=()=>SFX.unlock();
export const ROLE_INFO = {
  vampir:{ name:'Vampir', ic:'🧛', desc:'Her gece diğer vampirlerle bir köylünün evine girip kanını emersiniz. Gündüz masum rolü yapın. Köylü sayısı vampirlere eşitlenince kazanırsınız.' },
  doktor:{ name:'Doktor', ic:'🩺', desc:'Her gece bir evi korursun. Vampir o eve girerse kimse ölmez. Kendini de koruyabilirsin.' },
  kahin: { name:'Kâhin', ic:'🔮', desc:'Her gece bir eve bakar, oradakinin vampir olup olmadığını öğrenirsin. Bilgini akıllıca kullan.' },
  koylu: { name:'Köylü', ic:'🧑‍🌾', desc:'Özel gücün yok ama oy senin silahın. Konuş, şüphelen, doğru kişiyi meydana getir.' },
};
const AVATARS=['👩','👨','👵','👴','🧔','👱‍♀️','👩‍🦰','👨‍🦱','👩‍🦳','🧑','👨‍🌾','👩‍🍳','🧕','👲','👩‍🦱','👨‍🦳'];
const MIN_PLAYERS=4;
const DEF_SEC=45, SEL_SEC=60, FIN_SEC=60;
const P=(S,id)=>S.players.find(p=>p.id===id);
const alive=(S)=>S.players.filter(p=>p.alive);
const shuffle=(a)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const pickR=(a)=>a[Math.floor(Math.random()*a.length)];
const roleSuffix=(r)=>({koylu:'müş',doktor:'muş',kahin:'miş',vampir:'miş'})[r]||'miş';
function roleCounts(n){ const v=n>=12?3:n>=8?2:1; return { vampir:v, doktor:1, kahin:1, koylu:n-v-2 }; }

/* =================== HOST =================== */
export function newGameFields(S){
  Object.assign(S,{ phase:'lobby', day:0, roleAck:{}, night:null, lastNight:null, lastVote:null, winner:null, timerEnd:null,
    act:0, evs:[], vstate:{}, sel:{}, accused:null, defense:null, fin:{}, pleaded:false, hangCount:0, stakeCount:0, gameId:(S.gameId||0) });
}
function startAct(S){ S.act=(S.act||0)+1; S.evs=[]; }
function ev(S,e){ e.day=S.day; S.evs.push(e); }
function say(S,p,text,kind='talk'){ ev(S,{ t:'say', who:p?p.id:null, name:p?p.name:'Anlatıcı', title:p?.title||'', avatar:p?p.avatar:'🌙', pitch:p?.pitch||1, text, kind }); }
function narr(S,text){ ev(S,{ t:'narr', who:null, name:'Anlatıcı', avatar:'🌙', text, kind:'narr' }); }
function sfx(S,name){ ev(S,{t:'sfx',name}); }
function vstate(S){ const s={}; const hanged=S.players.filter(p=>p.fate==='hanged').sort((a,b)=>a.hangOrder-b.hangOrder).slice(-3);
  for(const p of S.players){ if(p.fate==='impaled') s[p.id]={impaled:true,stakeK:p.stakeK}; else if(p.fate==='hanged'&&hanged.includes(p)) s[p.id]={hanged:true,hangK:hanged.indexOf(p)}; else if(!p.alive) s[p.id]={dead:true}; }
  S.vstate=s; }
const speaker=(S,ex=[])=>{ const c=alive(S).filter(p=>!ex.includes(p)); return c.length?pickR(c):null; };
const muhtar=(S)=>alive(S).find(p=>p.title==='Muhtar')||speaker(S);
const line=(arr,m)=>LN.fillT(LN.pick(arr),m||{});

export function hostStart(S){
  const n=S.players.length; if(n<MIN_PLAYERS) return false;
  const rc=roleCounts(n); const pool=[]; for(const [r,c] of Object.entries(rc)) for(let i=0;i<c;i++) pool.push(r);
  const sh=shuffle(pool); const avs=shuffle(AVATARS); const arch=[LN.ARCHETYPES[0], ...shuffle(LN.ARCHETYPES.slice(1))];
  const order=shuffle(S.players.map((_,i)=>i));
  S.players.forEach((p,i)=>{ p.role=sh[i]; p.alive=true; p.fate=null; p.hangOrder=null; p.stakeK=null; p.avatar=avs[i%avs.length]; const a=arch[order[i]%arch.length]; p.title=a.title; p.pitch=a.pitch; p.claimed=null; });
  const gid=(S.gameId||0)+1; newGameFields(S); S.gameId=gid;
  S.phase='roles'; startAct(S);
  return true;
}
export function hostHandle(S,a,ctx){
  const p=P(S,a.from);
  switch(a.type){
    case 'ackRole': if(S.phase==='roles'){ S.roleAck[a.from]=true; if(S.players.every(x=>S.roleAck[x.id]||!x.connected)) toOpening(S,ctx); } break;
    case 'select': if(S.phase==='select'&&p&&p.alive&&a.target!==p.id&&P(S,a.target)?.alive){ S.sel[p.id]=a.target; if(alive(S).every(x=>S.sel[x.id])) resolveSelect(S,ctx); } break;
    case 'defense': if(S.phase==='defense'&&a.from===S.accused&&!S.defense) doDefense(S,a,ctx); break;
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
}
/* ---- ev seçimi ---- */
function toSelect(S,ctx){
  S.phase='select'; S.sel={}; startAct(S);
  const m=muhtar(S); const t=line(LN.SELECT_INTRO); if(m) say(S,m,t); else narr(S,t);
  S.timerEnd=Date.now()+(S.settings.voteSec||SEL_SEC)*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='select'){ resolveSelect(S,ctx); ctx.broadcast(); } });
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
  for(const v of voters) say(S,v,`Ben ${LN.suf(acc.name,'i')} seçtim!`);
  narr(S, max ? `En çok seçilen: ${acc.name} (${max} oy). Evinden alınıp meydana getiriliyor!` : `Kimse seçim yapmadı… kura ${acc.name} çıktı! Meydana!`);
  const crowd=shuffle(alive(S).filter(p=>p!==acc)).slice(0,4).map(p=>p.id);
  ev(S,{t:'drag',target:acc.id,crowd});
  const c=P(S,crowd[0]); if(c) say(S,c,LN.pick(LN.DRAG.crowd));
  say(S,acc,LN.pick(LN.DRAG.accused));
  ev(S,{t:'badges',counts:{}});
  S.accused=acc.id; S.selTally=t; S.defense=null;
  S.phase='defense';
  narr(S,`${acc.name}, söz senin. Kendini savun!`);
  S.timerEnd=Date.now()+DEF_SEC*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='defense'){ doDefense(S,{key:'silent'},ctx); ctx.broadcast(); } });
}
/* ---- savunma ---- */
function doDefense(S,a,ctx){
  ctx.clearTimer();
  const acc=P(S,S.accused); startAct(S);
  const others=alive(S).filter(p=>p!==acc);
  switch(a.key){
    case 'innocent': { const o=P(S,a.target)||pickR(others); say(S,acc,`Ben köylüyüm la! Dün gece evdeydim, ${o.name} şahidim.`); break; }
    case 'blame': { const t=P(S,a.target)||pickR(others); say(S,acc,`Beni bırakın, asıl vampir ${t.name}! Gözlerine bakın gözlerine!`); break; }
    case 'role': { const r=ROLE_INFO[a.role]?a.role:'koylu'; acc.claimed=r; say(S,acc, r==='koylu'?'Ben düz köylüyüm la, bi suçum yok! Yapmayın!':`Dinleyin beni: ben ${ROLE_INFO[r].name.toLowerCase()}ım! Beni asarsanız köy biter.`); break; }
    default: say(S,acc,'…','quiet');
  }
  S.defense=a.key||'silent';
  const resp=speaker(S,[acc]); if(resp) say(S,resp, Math.random()<.5?line(LN.RESPONSE_BELIEVE,{t:acc.name}):line(LN.RESPONSE_DOUBT,{t:acc.name}));
  toFinal(S,ctx,true);
}
/* ---- son karar + kilit ---- */
function toFinal(S,ctx,keepAct){
  S.phase='final'; S.fin={}; S.pleaded=false; if(!keepAct) startAct(S);
  const acc=P(S,S.accused);
  narr(S,`Son karar: ${acc.name} asılsın mı? Herkes AS ya da BIRAK desin ve oyunu kitlesin!`);
  S.timerEnd=Date.now()+(S.settings.voteSec||FIN_SEC)*1000;
  ctx.armTimer(S.timerEnd, ()=>{ if(S.phase==='final'){ resolveFinal(S,ctx); ctx.broadcast(); } });
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
  narr(S,`Sonuç: ${hang} AS, ${rel} BIRAK.`);
  if(hang>rel) execute(S,acc,hang,rel);
  else { ev(S,{t:'release',who:acc.id}); say(S,muhtar(S)||acc,LN.pick(LN.RELEASE)); S.lastVote={hanged:null,name:acc.name,released:true,hang,rel}; S.phase='verdict'; }
  vstate(S);
  checkWin(S);
}
function execute(S,acc,hang,rel){
  sfx(S,'drum');
  if(!S.pleaded) say(S,acc,LN.pick(LN.PLEAD));
  const ex=speaker(S,[acc]);
  ev(S,{t:'stool',who:acc.id});
  if(ex) say(S,ex,LN.pick(LN.EXECUTIONER));
  sfx(S,'thud'); sfx(S,'creak');
  if(acc.role==='vampir'){
    ev(S,{t:'hang',who:acc.id,vamp:true}); sfx(S,'evil');
    const s1=speaker(S,[acc]); say(S,s1||acc,LN.pick(LN.HANG_VAMPIRE_SURPRISE));
    say(S,acc,LN.pick(LN.VAMPIRE_HANGED_LINES));
    const kickers=shuffle(alive(S).filter(p=>p!==acc&&p.role!=='vampir')).slice(0,3);
    for(const k of kickers){ ev(S,{t:'kick',who:acc.id,by:k.id}); sfx(S,'kick'); say(S,k,LN.pick(LN.KICK)); }
    acc.alive=false; acc.fate='impaled'; acc.stakeK=(S.stakeCount++)%3;
    ev(S,{t:'impale',who:acc.id,k:acc.stakeK});
    const holders=shuffle(alive(S).filter(p=>p.role!=='vampir'));
    for(let i=0;i<3;i++){ const h=holders[i%Math.max(1,holders.length)]; if(h) say(S,h,LN.pick(LN.IMPALE)); sfx(S,'scream'); say(S,acc,LN.pick(LN.SCREAMS),'scream'); }
    sfx(S,'impale'); sfx(S,'cheer');
    const f=speaker(S); if(f) say(S,f,LN.pick(LN.AFTER_IMPALE));
  } else {
    ev(S,{t:'hang',who:acc.id,vamp:false});
    acc.alive=false; acc.fate='hanged'; acc.hangOrder=S.hangCount++;
    const s1=speaker(S,[acc]); if(s1) say(S,s1,LN.pick(LN.HANG_VILLAGER));
    narr(S,`${acc.name} ${ROLE_INFO[acc.role].name.toLowerCase()}${roleSuffix(acc.role)}.`);
  }
  S.lastVote={hanged:acc.id,name:acc.name,role:acc.role,hang,rel};
  S.phase='verdict';
}
/* ---- gece ---- */
function toNight(S,ctx){
  S.phase='night'; startAct(S); S.night={vampVotes:{},doctor:null,seer:null,seerResult:null};
  ev(S,{t:'home'}); ev(S,{t:'night',on:true}); sfx(S,'howl');
  narr(S,line(LN.NIGHT_INTRO)+' Vampirler, doktor ve kâhin: telefonlarınızdan seçin.');
  S.timerEnd=null; checkNightDone(S,ctx);
}
function nightAction(S,p,target,ctx){
  if(!P(S,target)?.alive) return;
  if(p.role==='vampir'){ if(P(S,target).role==='vampir') return; S.night.vampVotes[p.id]=target; }
  else if(p.role==='doktor'){ if(S.night.doctor) return; S.night.doctor=target; }
  else if(p.role==='kahin'){ if(S.night.seer||target===p.id) return; S.night.seer=target; S.night.seerResult=P(S,target).role==='vampir'; }
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
  if(killed){ ev(S,{t:'dead',who:killed.id}); const t=line(LN.DAWN_DEAD,{v:killed.name}); if(m) say(S,m,t); else narr(S,t); narr(S,`${killed.name} ${ROLE_INFO[killed.role].name.toLowerCase()}${roleSuffix(killed.role)}.`); }
  else { const t=line(saved?LN.DAWN_SAVED:LN.DAWN_NONE); if(m) say(S,m,t); else narr(S,t); }
  S.phase='dawn'; vstate(S);
  checkWin(S);
}
/* ---- bitiş ---- */
function checkWin(S){
  const al=alive(S); const v=al.filter(p=>p.role==='vampir').length; const o=al.length-v;
  if(v===0) S.winner='koylu'; else if(v>=o) S.winner='vampir'; else return false;
  S.phase='end'; S.timerEnd=null;
  ev(S,{t:'night',on:S.winner==='vampir'}); ev(S,{t:'gather'});
  if(S.winner==='vampir'){
    const vamps=al.filter(p=>p.role==='vampir'); const vills=al.filter(p=>p.role!=='vampir');
    vamps.forEach(p=>ev(S,{t:'fangs',who:p.id}));
    vills.forEach(p=>{ ev(S,{t:'hang',who:p.id,vamp:false,final:true}); p.fate='hanged'; p.hangOrder=S.hangCount++; });
    sfx(S,'evil');
    const multi=S.players.filter(p=>p.role==='vampir').length>1;
    say(S,vamps[0],LN.pick(multi?LN.END_VAMP_MULTI:LN.END_VAMP_SOLO));
    narr(S,'Vampirler köyü ele geçirdi!');
  } else { sfx(S,'festive'); const sp=speaker(S); if(sp) say(S,sp,LN.pick(LN.END_VILLAGE)); narr(S,'Son vampir de kazığa oturtuldu. Köy kurtuldu!'); }
  vstate(S);
  return true;
}

/* =================== İSTEMCİ ARAYÜZÜ =================== */
export function createMultiUI({ app, esc, voice, send, toast, isHost, meId, onLeave }){
  let V=null, SC=null, gameId=null, act=-1, idx=0, sel=null, finChoice=null, defMode=null, roleClaim=null, S=null, lines=[], timerTick=null, lastPhase='';
  const mine=()=>S&&P(S,meId());

  function build(){
    app.innerHTML=`<div class="game fade">
      <div class="topbar" id="mTop"></div>
      <div class="vwrap" id="mVillage"></div>
      <div class="lines" id="mLines"></div>
      <div id="mPanel"></div></div>`;
    V=createVillage(app.querySelector('#mVillage'),{ players:S.players.map(p=>({id:p.id,name:p.id===meId()?p.name+' (sen)':p.name,avatar:p.avatar})), onHouse });
    SC=createScene({ village:V, voice, onLine:addLine });
    V.setNight(false); act=-1; idx=0; lines=[];
  }
  function addLine(e){ lines.push(e); if(lines.length>3) lines.shift(); const el=app.querySelector('#mLines'); if(!el) return;
    el.innerHTML=lines.map((l,i)=>`<div class="ln ${l.t==='narr'?'narr':''} ${l.kind==='scream'?'scream':''} ${i===lines.length-1?'last':''}"><b>${l.t==='narr'?'🌙':esc(l.avatar)} ${esc(l.name)}${l.title?` <span class="tt">${esc(l.title)}</span>`:''}:</b> ${esc(l.text)}</div>`).join(''); }

  function render(state){
    S=state; if(!S) return;
    if(!V || gameId!==S.gameId || !app.querySelector('#mVillage')){ gameId=S.gameId; build(); }
    if(S.phase!==lastPhase){ lastPhase=S.phase; sel=null; finChoice=null; defMode=null; roleClaim=null; V.highlight(null); }
    // sahne olayları
    let fresh=[];
    if(S.act!==act){ act=S.act; idx=0; }
    if(S.evs && S.evs.length>idx){ fresh=S.evs.slice(idx); idx=S.evs.length; }
    if(fresh.length) SC.play(fresh, ()=>{ SC.sync(S.vstate||{}); drawPanel(); });
    else if(!SC.busy) SC.sync(S.vstate||{});
    drawTop(); drawPanel();
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
    if(S.phase==='defense'&&S.accused===m.id&&(defMode==='blame'||defMode==='innocent')) return alive(S).filter(p=>p.id!==m.id).map(p=>p.id);
    return null;
  }
  function nightCands(m){
    if(m.role==='vampir'&&!S.night.vampVotes[m.id]) return alive(S).filter(p=>p.role!=='vampir').map(p=>p.id);
    if(m.role==='doktor'&&!S.night.doctor) return alive(S).map(p=>p.id);
    if(m.role==='kahin'&&!S.night.seer) return alive(S).filter(p=>p.id!==m.id).map(p=>p.id);
    return null;
  }
  function onHouse(id){ const c=pickCands(); if(!c||!c.includes(id)) return; sel=id; V.highlight(id,true); drawPanel(); }
  const chips=(ids,counts)=>`<div class="chips">${ids.map(id=>{ const p=P(S,id); return `<button class="chip ${sel===id?'on':''}" data-chip="${id}">${p.avatar} ${esc(p.id===meId()?p.name+' (sen)':p.name)}${counts&&counts[id]?` <small class="bad">${counts[id]}</small>`:''}</button>`; }).join('')}</div>`;
  const hostBtn=(label,cls='gold')=>isHost()?`<button class="btn ${cls}" id="mNext">${label}</button>`:'';
  const waitNote=(t='Anlatıcının devam etmesi bekleniyor…')=>isHost()?'':`<p class="note pulse">${t}</p>`;
  const timer=()=>S.timerEnd?`<div class="timer" id="mTimer">--</div>`:'';

  function drawPanel(){
    const el=app.querySelector('#mPanel'); if(!el||!S) return;
    if(SC.busy){ el.innerHTML=`<div class="card panelc"><button class="btn sec" id="mSkip">⏩ Geç</button></div>`; el.querySelector('#mSkip').onclick=()=>SC.skip(); return; }
    const m=mine(); const dead=m&&!m.alive; let html='';
    const deadNote=dead&&S.phase!=='end'?`<div class="note">👻 Öldün; izliyorsun. Rolleri görebilirsin.</div>`:'';
    switch(S.phase){
      case 'roles': {
        if(!m){ html=spect(); break; }
        const r=ROLE_INFO[m.role]; const mates=m.role==='vampir'?S.players.filter(p=>p.role==='vampir'&&p.id!==m.id):[];
        html=`<div class="rolecard ${m.role}" style="padding:16px"><div class="ic" style="font-size:54px">${r.ic}</div><div class="rn">${r.name}</div><div class="rd">${r.desc}</div>${mates.length?`<div style="margin-top:10px;color:var(--blood2);font-weight:800">Diğer vampirler: ${mates.map(x=>esc(x.name)).join(', ')}</div>`:''}<div class="note">Karakterin: ${m.avatar} ${esc(m.title||'')}</div></div>
          ${S.roleAck[m.id]?`<p class="note pulse">Diğerleri bekleniyor… (${Object.keys(S.roleAck).length}/${S.players.length})</p>${hostBtn('Beklemeden başla','sec')}`:`<button class="btn" id="mAck">Anladım, gizle</button>`}`; break; }
      case 'opening': html=`<div class="card panelc" style="text-align:center"><b>Köy meydanda toplandı.</b><div class="note">Konuşmalar bitti mi? Tartışmaya geçelim.</div>${hostBtn('🗣️ Tartışmaya başla')}${waitNote()}</div>`; break;
      case 'discussion': html=`<div class="card panelc" style="text-align:center"><b>🗣️ Yüz yüze konuşun! Kim vampir?</b>${timer()}${seerNote(m)}${hostBtn('🏠 Seçime geç')}${waitNote('Süre bitince ev seçimine geçilecek…')}</div>${deadNote}`; break;
      case 'select': {
        const voted=Object.keys(S.sel).length, n=alive(S).length;
        if(m&&m.alive&&!S.sel[m.id]) html=`<div class="card panelc"><label>🏠 Şüphelendiğin kişinin evine dokun</label>${timer()}${chips(pickCands())}<button class="btn" id="mSel" ${sel?'':'disabled'}>${sel?`${esc(P(S,sel).name)} meydana getirilsin!`:'Bir ev seç'}</button></div>`;
        else html=`<div class="card panelc" style="text-align:center">${m&&S.sel[m.id]?`Seçimin: <b>${esc(P(S,S.sel[m.id]).name)}</b> ✔`:''}<div class="note">${voted}/${n} kişi seçti</div>${timer()}${hostBtn('Seçimi bitir','sec')}</div>${deadNote}`;
        break; }
      case 'defense': {
        const acc=P(S,S.accused);
        if(m&&m.id===acc.id){
          if(defMode==='blame'||defMode==='innocent') html=`<div class="card panelc"><label>${defMode==='blame'?'Kimi işaret edeceksin?':'Kim şahidin?'}</label>${chips(pickCands())}<div class="row"><button class="btn sec" id="mCancel">Vazgeç</button><button class="btn" id="mDefGo" ${sel?'':'disabled'}>Söyle!</button></div></div>`;
          else if(defMode==='role') html=`<div class="card panelc"><label>Hangi rolü söyleyeceksin? (yalan da olabilir)</label><div class="acts">${['koylu','doktor','kahin'].map(r=>`<button class="btn sm sec" data-claimr="${r}">${ROLE_INFO[r].ic} ${ROLE_INFO[r].name}</button>`).join('')}</div><button class="btn sec" id="mCancel">Vazgeç</button></div>`;
          else html=`<div class="card panelc" style="border-color:var(--blood2)"><label style="color:var(--blood2)">⚖️ Meydanda sen varsın! Kendini savun:</label>${timer()}<div class="acts">${LN.DEFENSE_HUMAN.map(o=>`<button class="btn sm ${o.key==='silent'?'sec':o.key==='role'?'blue':o.key==='blame'?'':'green'}" data-def="${o.key}">${o.label}</button>`).join('')}</div><div class="note">Sözlü de savunabilirsin; seçimin anlatıcı telefonda okunur.</div></div>`;
        } else html=`<div class="card panelc" style="text-align:center"><b>${acc.avatar} ${esc(acc.name)}</b> savunma yapıyor…${timer()}${hostBtn('Savunmayı geç','sec')}</div>${deadNote}`;
        break; }
      case 'final': {
        const acc=P(S,S.accused); const el2=alive(S).filter(p=>p.id!==S.accused);
        const hangs=Object.values(S.fin).filter(v=>v==='hang').length, rels=Object.values(S.fin).filter(v=>v==='release').length;
        const lockRow=`<div class="note">🔒 ${Object.keys(S.fin).length}/${el2.length} kitledi · 🪢 ${hangs} AS · 🕊️ ${rels} BIRAK</div>`;
        if(m&&m.alive&&m.id!==acc.id&&!S.fin[m.id]) html=`<div class="card panelc"><label>Son karar: <b style="color:var(--gold)">${acc.avatar} ${esc(acc.name)}</b> asılsın mı?</label>${timer()}${lockRow}
          <div class="row"><button class="btn ${finChoice==='hang'?'':'sec'}" data-fv="hang">🪢 AS</button><button class="btn ${finChoice==='release'?'green':'sec'}" data-fv="release">🕊️ BIRAK</button></div>
          <button class="btn gold" id="mLock" ${finChoice?'':'disabled'}>🔒 Oyumu kitledim</button></div>`;
        else html=`<div class="card panelc" style="text-align:center">${m&&m.id===acc.id?'<b style="color:var(--blood2)">Köy senin hakkında karar veriyor…</b>':m&&S.fin[m.id]?`Oyun: <b>${S.fin[m.id]==='hang'?'🪢 AS':'🕊️ BIRAK'}</b> 🔒`:''}${timer()}${lockRow}${hostBtn('Kararı açıkla','sec')}</div>${deadNote}`;
        break; }
      case 'verdict': {
        const lv=S.lastVote||{};
        html=`<div class="card panelc" style="text-align:center">${lv.hanged?(lv.role==='vampir'?`<div class="big" style="color:var(--blood2)">🧛 VAMPİR ÇIKTI!</div><div class="note">${esc(lv.name)} kazığa oturtuldu.</div>`:`<div class="big">🪢 ${esc(lv.name)}</div><div class="note">${ROLE_INFO[lv.role].ic} ${ROLE_INFO[lv.role].name} idi. (${lv.hang} AS / ${lv.rel} BIRAK)</div>`):`<div class="big">🕊️ Bırakıldı</div><div class="note">${esc(lv.name||'')} bugün kurtuldu (${lv.hang} AS / ${lv.rel} BIRAK).</div>`}
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
    el.innerHTML=html; bind(el); runTimer();
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
    el.querySelectorAll('[data-def]').forEach(b=>b.onclick=()=>{ const k=b.dataset.def; if(k==='blame'||k==='innocent'||k==='role'){ defMode=k; sel=null; drawPanel(); } else send({type:'defense',key:k}); });
    el.querySelectorAll('[data-claimr]').forEach(b=>b.onclick=()=>send({type:'defense',key:'role',role:b.dataset.claimr}));
    q('#mCancel')&&(q('#mCancel').onclick=()=>{ defMode=null; sel=null; V.highlight(null); drawPanel(); });
    q('#mDefGo')&&(q('#mDefGo').onclick=()=>send({type:'defense',key:defMode,target:sel}));
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
  return { render, reset(){ V=null; gameId=null; lastPhase=''; } };
}
