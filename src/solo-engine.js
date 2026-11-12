import * as LN from './lines.js';
/* =====================================================================
   VAMPİR KÖYLÜ — Tek oyunculu motor (DOM'suz, Node'da test edilebilir)
   ===================================================================== */

export const ROLE_INFO = {
  vampir: { name:'Vampir', ic:'🧛' },
  doktor: { name:'Doktor', ic:'🩺' },
  kahin:  { name:'Kâhin',  ic:'🔮' },
  koylu:  { name:'Köylü',  ic:'🧑‍🌾' },
};

const BOT_NAMES = ['Ayşe','Mehmet','Zeynep','Mustafa','Elif','Hasan','Fatma','Kerem','Derya','Burak','Selin','Emre','Hatice','Yusuf','Melis','Can','Nur','Oğuz','İrem','Tolga','Leyla','Baran','Ece','Umut'];
const AVATARS = ['👩','👨','👵','👴','🧔','👱‍♀️','👩‍🦰','👨‍🦱','👩‍🦳','🧑','👨‍🌾','👩‍🍳','🧕','👲','👩‍🦱','👨‍🦳','🧓','👸','🤴','🧙‍♀️','🧝','🧑‍🎤','👩‍⚕️','👨‍🏫'];

export const PERSONALITIES = {
  sessiz:  { label:'Sessiz',  talk:.35, aggr:.3, logic:.6, herd:.4 },
  agresif: { label:'Agresif', talk:.9,  aggr:.9, logic:.4, herd:.3 },
  mantikli:{ label:'Mantıklı',talk:.6,  aggr:.5, logic:.95,herd:.2 },
  panik:   { label:'Panik',   talk:.7,  aggr:.6, logic:.3, herd:.95 },
  yalanci: { label:'Kurnaz',  talk:.7,  aggr:.6, logic:.8, herd:.3 },
};

/* ------------------------------ RNG ------------------------------ */
export function makeRng(seed){
  let s = (seed>>>0) || 0x9e3779b9;
  const r = ()=>{ s ^= s<<13; s>>>=0; s ^= s>>>17; s ^= s<<5; s>>>=0; return s/4294967296; };
  r.int=(n)=>Math.floor(r()*n); r.pick=(a)=>a[r.int(a.length)];
  r.shuffle=(a)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=r.int(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
  r.chance=(p)=>r()<p;
  return r;
}

/* --------------------------- İFADE METİNLERİ --------------------------- */
const T = {
  accuse: [
    '{t} bana hiç güven vermiyor. Dün geceden beri bir tuhaf.',
    'Bence {t}. Konuşmalarına dikkat edin, sürekli konuyu değiştiriyor.',
    '{t} çok sessiz. Vampirler hep böyle sessiz olur.',
    '{t} neden sürekli başkalarını işaret ediyor? Şüpheli.',
    'Ben oyumu {t_e} veriyorum, açık söylüyorum.',
    '{t_in} gözlerine bakın. Bir şey saklıyor.',
  ],
  accuseHerd: [
    'Ben de {t} diyorum. Herkes aynı şeyi düşünüyor zaten.',
    'Haklısınız, {t} olabilir. Riske giremeyiz.',
  ],
  defend: [
    '{t} masum, eminim. Dün bütün gün yanımdaydı.',
    'Hayır, {t} olamaz. Vampir olsa çoktan beni yerdi.',
    '{t_i} boşuna suçluyorsunuz. Asıl vampir sessizce bekliyor.',
    'Ben {t_e} kefilim.',
  ],
  seerVamp: [
    'Ben kâhinim. Dün gece {t_e} baktım: VAMPİR!',
    'Dinleyin, kâhin benim. {t} vampir, bugün asılmalı.',
  ],
  seerClean: [
    'Ben kâhinim. {t} temiz, ona oy vermeyin.',
    'Kâhin benim ve {t_in} vampir olmadığını biliyorum.',
  ],
  counterSeer: [
    'Yalan söylüyor! Asıl kâhin benim ve dün gece {t_e} baktım: vampir!',
    'Ben kâhinim. {t} kâhin değil, vampirin ta kendisi.',
  ],
  doctorSaved: [
    'Doktor benim. Dün gece {t_i} ben kurtardım.',
    'Söylemek zorundayım: ben doktorum, {t_i} korudum.',
  ],
  quiet: [
    'Hiçbir şey bilmiyorum. Herkes şüpheli.',
    'Dikkatli olalım, yanlış kişiyi asarsak biteriz.',
    'Ben kararsızım.',
    'Konuşanlara değil, susanlara bakın.',
    'Dün gece hiç uyuyamadım...',
    'Bir fikrim yok ama birini asmamız lazım.',
  ],
  afterKill: [
    '{v} öldü... Kim yapmış olabilir?',
    'Zavallı {v}. Bu gece sırada kim var?',
  ],
};


/* Türkçe ek yardımcısı: {t_e} yönelme, {t_i} belirtme, {t_in} tamlayan */
const V='aeıioöuü'; const VL=(w)=>{ const l=w.toLowerCase(); for(let i=l.length-1;i>=0;i--) if(V.includes(l[i])) return l[i]; return 'e'; };
const BACK='aıou', ROUND='oöuü';
export function suf(name, kind){
  const v=VL(name); const endsV=V.includes(name.slice(-1).toLowerCase()); const back=BACK.includes(v), round=ROUND.includes(v);
  const i4 = back?(round?'u':'ı'):(round?'ü':'i');
  if(kind==='e') return name+"'"+(endsV?'y':'')+(back?'a':'e');
  if(kind==='i') return name+"'"+(endsV?'y':'')+i4;
  if(kind==='in') return name+"'"+(endsV?'n':'')+i4+'n';
  if(kind==='de') return name+"'"+(back?'da':'de');
  return name;
}
function fill(tpl, m){ return tpl.replace(/\{(\w+?)(?:_(e|i|in|de))?\}/g,(_,k,kind)=>{ const v=m[k]??''; return kind?suf(v,kind):v; }); }


/* ------------------------------- OYUN ------------------------------- */
export class SoloGame {
  /**
   * level: {players, vampires, role, iq, rounds, objective, name}
   * opts: {rng, humanName, longIntro}
   */
  constructor(level, opts={}){
    this.rng = opts.rng || makeRng(Date.now()&0xffffffff);
    this.level = level;
    this.humanName = opts.humanName || 'Sen';
    this.iq = level.iq ?? .5;
    this.maxRounds = level.rounds ?? 2;
    this.longIntro = opts.longIntro !== false;
    this._build();
  }

  _build(){
    const r=this.rng, L=this.level;
    const n=L.players, v=L.vampires ?? (n>=12?3:n>=8?2:1);
    const roles=[]; for(let i=0;i<v;i++) roles.push('vampir'); roles.push('doktor','kahin'); while(roles.length<n) roles.push('koylu');
    const humanRole = L.role==='random' ? r.pick(['koylu','koylu','kahin','doktor','vampir']) : L.role;
    roles.splice(roles.indexOf(humanRole),1);
    const botRoles=r.shuffle(roles);
    const names=r.shuffle(BOT_NAMES).slice(0,n-1), avs=r.shuffle(AVATARS);
    const pkeys=Object.keys(PERSONALITIES);
    const arch=[LN.ARCHETYPES[0], ...r.shuffle(LN.ARCHETYPES.slice(1))];
    this.players=[{ id:'me', name:this.humanName, avatar:'🙋', role:humanRole, alive:true, human:true, cred:1, claimed:null, claims:[], knows:{}, sus:{}, title:'', pitch:1 }];
    botRoles.forEach((role,i)=>{
      const pk = role==='vampir' && r.chance(.5) ? 'yalanci' : r.pick(pkeys);
      const a=arch[i%arch.length];
      this.players.push({ id:'b'+i, name:names[i], avatar:avs[i], role, alive:true, human:false, pers:PERSONALITIES[pk], persKey:pk, cred:1, claimed:null, claims:[], knows:{}, sus:{}, title:a.title, pitch:a.pitch });
    });
    for(const p of this.players) for(const q of this.players) if(p!==q) p.sus[q.id]=0;
    const vamps=this.players.filter(p=>p.role==='vampir');
    for(const p of vamps) for(const q of vamps) if(p!==q) p.knows[q.id]=true;
    this.day=0; this.phase='roles'; this.feed=[]; this.events=[]; this.round=0;
    this.night=null; this.lastNight=null; this.lastVote=null; this.winner=null;
    this.accused=null; this.selectVotes={}; this.finalVotes={}; this.hangCount=0; this.stakeCount=0;
    this.stats={ wrongVotes:0, votesReceived:0, saves:0, vampHangedDay:null, days:0, humanDiedDay:null, quietRounds:0 };
    this.accusedBy={}; this.defendedBy={}; this.spokeToday=new Set();
    this.human=this.players[0];
  }

  /* ---------- yardımcılar ---------- */
  P(id){ return this.players.find(p=>p.id===id); }
  alive(){ return this.players.filter(p=>p.alive); }
  aliveVamps(){ return this.alive().filter(p=>p.role==='vampir'); }
  aliveBots(){ return this.alive().filter(p=>!p.human); }
  ev(e){ e.day=this.day; this.events.push(e); }
  say(who, text, kind='talk'){
    const e={ t:'say', day:this.day, who: who?who.id:null, name: who?who.name:'Anlatıcı', title: who?.title||'', avatar: who?who.avatar:'🌙', pitch: who?.pitch||1, text, kind };
    this.feed.push(e); this.events.push(e);
  }
  narr(text){ const e={ t:'narr', day:this.day, who:null, name:'Anlatıcı', avatar:'🌙', text, kind:'narr' }; this.feed.push(e); this.events.push(e); }
  sfx(name){ this.ev({t:'sfx', name}); }
  pk(arr){ return LN.pick(arr, this.rng); }
  line(arr, m){ return LN.fillT(this.pk(arr), m||{}); }
  /** Köy görseli için kalıcı durum */
  villageState(){ const s={}; const hanged=this.players.filter(p=>p.fate==='hanged').sort((a,b)=>a.hangOrder-b.hangOrder); const lastHanged=hanged.slice(-3);
    for(const p of this.players){ if(p.fate==='impaled') s[p.id]={impaled:true, stakeK:p.stakeK}; else if(p.fate==='hanged' && lastHanged.includes(p)) s[p.id]={hanged:true, hangK:lastHanged.indexOf(p)}; else if(!p.alive) s[p.id]={dead:true}; }
    return s; }
  speaker(exclude=[]){ const c=this.aliveBots().filter(p=>!exclude.includes(p)); return c.length?this.rng.pick(c):null; }
  muhtar(){ return this.aliveBots().find(p=>p.title==='Muhtar') || this.speaker(); }

  /* ================= AÇILIŞ ================= */
  ackRole(){
    if(this.phase!=='roles') return;
    this.day=1; this.stats.days=1;
    this.ev({t:'gather'}); this.sfx('bell');
    const bots=this.aliveBots();
    const script = this.longIntro ? LN.OPENING : LN.OPENING_SHORT;
    for(const s of script){ const who=bots[s.who % bots.length]; if(s.sfx) this.sfx(s.sfx); this.say(who, LN.fillT(LN.pick([s.text],this.rng),{})); }
    this.sfx('murmur');
    this.phase='talk'; this.round=1; this.roundsToday=1;
    this.accusedBy={}; this.defendedBy={}; this.spokeToday=new Set();
    this._botsSpeak();
    this.needs = this.human.alive ? { type:'talk' } : null;
  }

  /* ================= GECE ================= */
  toNight(){
    this.phase='night';
    this.night={ vampTarget:null, doctor:null, seer:null, seerResult:null };
    this.ev({t:'home'}); this.ev({t:'night', on:true}); this.sfx('howl');
    this.narr(this.line(LN.NIGHT_INTRO));
    const h=this.human; this.needs=null;
    if(h.alive && h.role==='vampir') this.needs={ type:'vamp', cands:this.alive().filter(p=>p.role!=='vampir').map(p=>p.id) };
    else if(h.alive && h.role==='doktor') this.needs={ type:'doktor', cands:this.alive().map(p=>p.id) };
    else if(h.alive && h.role==='kahin') this.needs={ type:'kahin', cands:this.alive().filter(p=>p!==h && h.knows[p.id]===undefined).map(p=>p.id) };
    if(this.needs && !this.needs.cands.length) this.needs=null;
    if(!this.needs) this._resolveNight();
  }
  nightAction(targetId){
    if(this.phase!=='night'||!this.needs) return;
    if(!this.needs.cands.includes(targetId)) return;
    const h=this.human;
    if(this.needs.type==='vamp') this.night.vampTarget=targetId;
    else if(this.needs.type==='doktor') this.night.doctor=targetId;
    else if(this.needs.type==='kahin'){ const t=this.P(targetId); this.night.seer=targetId; this.night.seerResult=(t.role==='vampir'); h.knows[targetId]=t.role==='vampir'; }
    this.needs=null;
    this._resolveNight();
  }
  _botNight(){
    const r=this.rng, iq=this.iq, al=this.alive();
    if(this.night.vampTarget===null){
      const vamps=this.aliveVamps().filter(p=>!p.human);
      if(vamps.length){
        let cands=al.filter(p=>p.role!=='vampir');
        if(this.day===1 && cands.length>1) cands=cands.filter(p=>!p.human); // ilk gece insan hedef alınmaz
        let target=null;
        const seerClaim=cands.find(p=>p.claimed==='kahin'); const docClaim=cands.find(p=>p.claimed==='doktor');
        if(seerClaim && r.chance(.6+iq*.35)) target=seerClaim;
        else if(docClaim && r.chance(.3+iq*.4)) target=docClaim;
        else { let best=null,bs=-1e9; for(const c of cands){ let s=(c.accusedVampCount||0)*2+(c.accuseCount||0)*1.2; for(const v of vamps) s+=(c.human?this._humanThreat():(c.sus[v.id]||0))*0.5; s+=r()*(0.6+(1-iq)*1.5); if(s>bs){bs=s;best=c;} } target=best; }
        this.night.vampTarget=target?target.id:null;
      }
    }
    const doc=al.find(p=>p.role==='doktor'&&!p.human);
    if(doc){
      const seerClaim=al.find(p=>p.claimed==='kahin' && p!==doc); let t;
      if(seerClaim && r.chance(.4+iq*.5)) t=seerClaim;
      else if(r.chance(.35)) t=doc;
      else { const others=al.filter(p=>p!==doc); let best=others[0],bs=-1e9; for(const c of others){ const s=-(doc.sus[c.id]||0)+(c.accuseCount||0)*0.6*iq+r()*2; if(s>bs){bs=s;best=c;} } t=best; }
      this.night.doctor=t.id;
    }
    const seer=al.find(p=>p.role==='kahin'&&!p.human);
    if(seer){
      const unknown=al.filter(p=>p!==seer && seer.knows[p.id]===undefined);
      if(unknown.length){
        let t; if(r.chance(iq)){ let best=unknown[0],bs=-1e9; for(const c of unknown){ const s=(seer.sus[c.id]||0)+r(); if(s>bs){bs=s;best=c;} } t=best; } else t=r.pick(unknown);
        seer.knows[t.id]=(t.role==='vampir'); this.night.seer=this.night.seer||t.id;
        if(t.role==='vampir') seer.sus[t.id]+=100; else seer.sus[t.id]-=100;
      }
    }
  }
  _humanThreat(){ const h=this.human; let s=0; if(h.claimed==='kahin') s+=3; if(h.claimed==='doktor') s+=2; return s; }
  _resolveNight(){
    this._botNight();
    const victimId=this.night.vampTarget; const saved = victimId && this.night.doctor===victimId;
    let killed=null;
    if(victimId && !saved){ const v=this.P(victimId); v.alive=false; v.fate='killed'; killed=v; if(v.human) this.stats.humanDiedDay=this.day; }
    if(saved && this.human.role==='doktor' && this.human.alive) this.stats.saves++;
    if(saved){ const d=this.alive().find(p=>p.role==='doktor'); if(d&&!d.human) d.savedSomeone=victimId; }
    const hs=this.human.role==='kahin' && this.night.seer && this.human.knows[this.night.seer]!==undefined && this.needsWasSeer!==false;
    this.lastNight={ killed:killed?killed.id:null, killedName:killed?killed.name:null, killedRole:killed?killed.role:null, saved:!!saved,
      seer: this.human.role==='kahin' && this.human.alive!==false && this.night.seer && this.human.knows[this.night.seer]!==undefined ? {target:this.night.seer,isVamp:this.human.knows[this.night.seer]} : null };
    if(killed && killed.claimed==='kahin'){ for(const c of killed.claims) this._applyClaim(killed, this.P(c.target), c.isVamp, 1.5, true); }
    // sabah
    this.day++; this.stats.days=this.day;
    this.ev({t:'night', on:false}); this.sfx('bell');
    const m=this.muhtar();
    if(killed){ this.ev({t:'dead', who:killed.id}); const txt=this.line(LN.DAWN_DEAD,{v:killed.name}); if(m) this.say(m, txt); else this.narr(txt); this.narr(`${killed.name} ${ROLE_INFO[killed.role].name.toLowerCase()}${roleSuffix(killed.role)}.`); }
    else { const txt=this.line(saved?LN.DAWN_SAVED:LN.DAWN_NONE); if(m) this.say(m, txt); else this.narr(txt); }
    this.phase='dawn'; this.needs=null;
    if(this._checkWin()) return;
    if(!this.human.alive) this._autoplayRest();
  }

  /* ================= GÜNDÜZ: TARTIŞMA ================= */
  startTalk(){
    if(this.phase!=='dawn') return;
    this.phase='talk'; this.round=1; this.roundsToday=this.maxRounds;
    this.accusedBy={}; this.defendedBy={}; this.spokeToday=new Set();
    this.ev({t:'gather'}); this.sfx('murmur');
    if(this.lastNight.killed && this.rng.chance(.6)){ const b=this.speaker(); if(b) this.say(b, this.line(LN.AFTER_KILL,{v:this.lastNight.killedName}), 'flavor'); }
    this._botsSpeak();
    this.needs = this.human.alive ? { type:'talk' } : null;
  }
  humanOptions(){
    const h=this.human, al=this.alive().filter(p=>p!==h);
    const opts=[];
    opts.push({ type:'accuse', label:'Suçla', targets:al.map(p=>p.id) });
    opts.push({ type:'defend', label:'Savun', targets:al.map(p=>p.id) });
    if(h.role==='kahin'){ const known=Object.entries(h.knows).filter(([id])=>this.P(id).alive).map(([id,isVamp])=>({target:id,isVamp})); if(known.length) opts.push({ type:'claimSeer', label:'Kâhin olduğunu açıkla', results:known }); }
    else if(h.claimed!=='kahin') opts.push({ type:'claimSeer', label:'Kâhinim de (yalan)', results: al.map(p=>({target:p.id,isVamp:true})).concat(al.map(p=>({target:p.id,isVamp:false}))) });
    if(h.claimed!=='doktor') opts.push({ type:'claimDoctor', label: h.role==='doktor'?'Doktor olduğunu açıkla':'Doktorum de (yalan)' });
    opts.push({ type:'quiet', label:'Sessiz kal' });
    return opts;
  }
  talkAction(a){
    if(this.phase!=='talk') return;
    const h=this.human;
    switch(a.type){
      case 'accuse': { const t=this.P(a.target); if(!t||!t.alive||t===h) return; this.say(h, `${t.name} vampir olabilir la. Ona oy vereceğim.`); this._accuse(h,t); break; }
      case 'defend': { const t=this.P(a.target); if(!t||!t.alive||t===h) return; this.say(h, `${t.name} masum, ona kefilim.`); this._defend(h,t); break; }
      case 'claimSeer': { const t=this.P(a.target); if(!t||!t.alive) return; const isVamp=!!a.isVamp;
        if(h.role==='kahin' && h.knows[a.target]!==isVamp) return;
        this.say(h, isVamp?`Ben kâhinim la! Dün gece ${LN.suf(t.name,'e')} baktım: VAMPİR!`:`Ben kâhinim. ${t.name} temiz, ona oy vermeyin.`);
        this._claimSeer(h,t,isVamp); break; }
      case 'claimDoctor': { this.say(h, this.lastNight?.saved?'Doktor benim, dün gece kurtaran bendim.':'Ben doktorum, bana dokunmayın.'); this._claimDoctor(h); break; }
      default: { this.stats.quietRounds++; this.say(h,'…','quiet'); }
    }
    this.spokeToday.add(h.id);
    this.round++;
    if(this.round>this.roundsToday){ this._toSelect(); return; }
    this._botsSpeak();
  }

  /* ---------- şüphe modeli ---------- */
  _others(x){ return this.alive().filter(p=>p!==x && !p.human); }
  _knowsTruth(b,t){ return b.knows[t.id]!==undefined || b.role==='vampir'; }
  _accuse(s,t){
    (this.accusedBy[t.id] ||= []).push(s.id);
    s.accuseCount=(s.accuseCount||0)+1;
    if(t.role==='vampir') s.accusedVampCount=(s.accusedVampCount||0)+1;
    for(const b of this._others(s)){
      if(b===t){ b.sus[s.id]+=1.2; continue; }
      if(this._knowsTruth(b,t)){ if(b.role!=='vampir' && b.knows[t.id]===false) b.sus[s.id]+=0.8*b.pers.logic; continue; }
      b.sus[t.id]+= 1.0*s.cred*(0.5+b.pers.herd*0.8);
      b.sus[s.id]+= 0.12*b.pers.logic;
    }
  }
  _defend(s,t){
    (this.defendedBy[t.id] ||= []).push(s.id);
    for(const b of this._others(s)){
      if(b===t){ b.sus[s.id]-=0.6; continue; }
      if(this._knowsTruth(b,t)){ if(b.knows[t.id]===true && b.role!=='vampir') b.sus[s.id]+=1.5*b.pers.logic; continue; }
      b.sus[t.id]-= 0.6*s.cred;
    }
  }
  _claimSeer(s,t,isVamp){ const prior=this.alive().find(p=>p!==s && p.claimed==='kahin'); s.claimed='kahin'; s.claims.push({target:t.id,isVamp}); this._applyClaim(s,t,isVamp,1,false,prior); }
  _applyClaim(s,t,isVamp,mult,dead,prior){
    for(const b of this._others(s)){
      if(b===t){ b.sus[s.id]+= isVamp?2.5:-1; continue; }
      if(b.role==='vampir') continue;
      if(b.role==='kahin' && !dead){ b.sus[s.id]+=4; continue; }
      let w=2.5*s.cred*mult;
      if(prior && !dead){ w*=0.5; b.sus[s.id]+=0.8*b.pers.logic; b.sus[prior.id]+=0.8*b.pers.logic; }
      b.sus[t.id]+= isVamp? w : -w*0.6;
    }
  }
  _claimDoctor(s){ s.claimed='doktor'; for(const b of this._others(s)){ if(b.role==='doktor'){ b.sus[s.id]+=3; continue; } if(b.role==='vampir') continue; b.sus[s.id]-=(this.lastNight?.saved?1.5:0.6)*s.cred; } }
  _botsSpeak(){
    const r=this.rng, iq=this.iq;
    const bots=r.shuffle(this.aliveBots());
    let spoken=0;
    for(const b of bots){
      if(spoken>=4) break;
      if(!r.chance(b.pers.talk*0.75+0.2)) continue;
      spoken++; this.spokeToday.add(b.id);
      const others=this.alive().filter(p=>p!==b);
      if(b.role==='vampir'){
        const seerClaim=others.find(p=>p.claimed==='kahin' && p.claims.some(c=>this.P(c.target).role==='vampir' && this.P(c.target).alive));
        const vampClaimed=this.players.some(p=>p.role==='vampir'&&p.claimed==='kahin');
        if(seerClaim && !vampClaimed && r.chance(iq*0.8)){ this.say(b, this.line(LN.COUNTER_SEER,{t:seerClaim.name})); this._claimSeer(b,seerClaim,true); continue; }
        const cands=others.filter(p=>p.role!=='vampir'); const t=this._crowdSuspect(cands,b)||r.pick(cands);
        if(r.chance(0.35+iq*0.4)){ this.say(b, this.line(LN.ACCUSE,{t:t.name})); this._accuse(b,t); } else this.say(b, this.line(LN.QUIET),'quiet');
        continue;
      }
      if(b.role==='kahin'){
        const found=Object.entries(b.knows).find(([id,v])=>v===true && this.P(id).alive && !b.claims.some(c=>c.target===id));
        if(found && r.chance(0.5+iq*0.5)){ const t=this.P(found[0]); this.say(b, this.line(LN.SEER_VAMP,{t:t.name})); this._claimSeer(b,t,true); continue; }
        const clean=Object.entries(b.knows).find(([id,v])=>v===false && this.P(id).alive && (this.accusedBy[id]||[]).length && !b.claims.some(c=>c.target===id));
        if(clean && b.claimed==='kahin' && r.chance(.6)){ const t=this.P(clean[0]); this.say(b, this.line(LN.SEER_CLEAN,{t:t.name})); this._claimSeer(b,t,false); continue; }
      }
      if(b.role==='doktor' && b.savedSomeone && !b.claimed && r.chance(.4)){ const t=this.P(b.savedSomeone); this.say(b, this.line(LN.DOCTOR_SAVED,{t:t.name})); this._claimDoctor(b); b.savedSomeone=null; continue; }
      const ranked=[...others].sort((x,y)=>(b.sus[y.id]||0)-(b.sus[x.id]||0));
      const top=ranked[0]; const topS=b.sus[top.id]||0;
      const herdTarget = b.pers.herd>0.6 ? this._crowdSuspect(others,b) : null;
      if(herdTarget && r.chance(b.pers.herd*0.6) && (b.sus[herdTarget.id]||0)>-1){ this.say(b, this.line(LN.ACCUSE_HERD,{t:herdTarget.name})); this._accuse(b,herdTarget); continue; }
      if(topS>0.6 && r.chance(b.pers.aggr*0.8+0.1)){ this.say(b, this.line(LN.ACCUSE,{t:top.name})); this._accuse(b,top); continue; }
      const accusedInnocent = others.find(p=>(this.accusedBy[p.id]||[]).length && (b.sus[p.id]||0)<-0.5);
      if(accusedInnocent && r.chance(.5)){ this.say(b, this.line(LN.DEFEND,{t:accusedInnocent.name})); this._defend(b,accusedInnocent); continue; }
      this.say(b, this.line(LN.QUIET),'quiet');
    }
    for(const b of this.aliveBots()) for(const p of this.alive()) if(p!==b && !this.spokeToday.has(p.id)) b.sus[p.id]+=0.08*b.pers.logic;
  }
  _crowdSuspect(cands, except){
    let best=null,bs=0.4;
    for(const c of cands){ let s=0,n=0; for(const b of this.aliveBots()) if(b!==c&&b!==except){ s+=(b.sus[c.id]||0); n++; } s=n?s/n:0; if(s>bs){bs=s;best=c;} }
    return best;
  }

  /* ================= EV SEÇİMİ (şüpheli) ================= */
  _toSelect(){
    this.phase='select'; this.selectVotes={};
    const m=this.muhtar(); const t=this.line(LN.SELECT_INTRO); if(m) this.say(m,t); else this.narr(t);
    if(this.human.alive) this.needs={ type:'select', cands:this.alive().filter(p=>!p.human).map(p=>p.id) };
    else { this.needs=null; this.selectHouse(null); }
  }
  selectHouse(targetId){
    if(this.phase!=='select') return;
    const h=this.human, r=this.rng, iq=this.iq;
    const votes={};
    if(h.alive){ if(!targetId || !this.P(targetId)?.alive || targetId===h.id) return; votes[h.id]=targetId; }
    const tally=()=>{ const t={}; for(const v of Object.values(votes)) t[v]=(t[v]||0)+1; return t; };
    for(const b of r.shuffle(this.aliveBots())){
      const others=this.alive().filter(p=>p!==b);
      const cands = b.role==='vampir' ? others.filter(p=>p.role!=='vampir') : others;
      const cur=tally(); let best=null,bs=-1e9;
      for(const c of cands){ let s=(b.sus[c.id]||0) + (cur[c.id]||0)*b.pers.herd*0.7 + (r()-.5)*(1.4-iq); if(b.role==='vampir') s+=(cur[c.id]||0)*0.8; if(s>bs){bs=s;best=c;} }
      votes[b.id]=best.id;
    }
    const t=tally(); let max=0; for(const c of Object.values(t)) max=Math.max(max,c);
    const top=Object.keys(t).filter(id=>t[id]===max).map(id=>this.P(id));
    let acc = top.length===1 ? top[0] : (this._crowdSuspect(top,null) || r.pick(top));
    this.selectVotes=votes; this.stats.votesReceived += t[h.id]||0;
    this.ev({t:'badges', counts:t});
    // birkaç seçmen konuşsun
    const voters=r.shuffle(Object.keys(votes).filter(id=>votes[id]===acc.id && id!==h.id).map(id=>this.P(id))).slice(0,2);
    for(const v of voters) this.say(v, r.chance(.5)?`Ben ${LN.suf(acc.name,'i')} seçtim!`:this.line(LN.ACCUSE_HERD,{t:acc.name}));
    this.narr(`En çok seçilen: ${acc.name} (${max} oy). Evinden alınıp meydana getiriliyor!`);
    const crowd=r.shuffle(this.alive().filter(p=>p!==acc)).slice(0,4).map(p=>p.id);
    this.ev({t:'drag', target:acc.id, crowd});
    if(crowd.length){ const c=this.P(crowd.find(id=>!this.P(id).human)||crowd[0]); this.say(c, this.pk(LN.DRAG.crowd)); }
    this.say(acc, this.pk(LN.DRAG.accused));
    this.ev({t:'badges', counts:{}});
    this.accused=acc.id;
    this._defense();
  }

  /* ================= SAVUNMA ================= */
  _defense(){
    const acc=this.P(this.accused);
    this.phase='defense';
    this.narr(`${acc.name}, söz senin. Kendini savun!`);
    if(acc.human){ this.needs={ type:'defense', options:LN.DEFENSE_HUMAN.map(o=>({key:o.key,label:o.label})), targets:this.alive().filter(p=>p!==acc).map(p=>p.id) }; return; }
    this._botDefense(acc);
    this._responses(acc);
    this._toFinal();
  }
  defend(key, targetId){
    if(this.phase!=='defense'||!this.needs) return;
    const h=this.human; const others=this.alive().filter(p=>p!==h); const r=this.rng;
    switch(key){
      case 'innocent': { const o=r.pick(others.filter(p=>!p.human)); this.say(h, `Ben köylüyüm la! Dün gece evdeydim, ${o.name} şahidim.`); for(const b of this._others(h)) b.sus[h.id]-=0.5*h.cred*(1-b.pers.logic*0.4); if(o.role!=='vampir' && (o.sus[h.id]||0)<0.5){ this.say(o,'Doğru diyo, yanımdaydı.'); for(const b of this._others(h)) b.sus[h.id]-=0.4; } break; }
      case 'blame': { const t=this.P(targetId); if(!t||!t.alive||t===h) return; this.say(h, `Beni bırakın, asıl vampir ${t.name}! Gözlerine bakın gözlerine!`); this._accuse(h,t); for(const b of this._others(h)) b.sus[h.id]-=0.2; break; }
      case 'role': {
        if(h.role==='kahin'){ const known=Object.entries(h.knows).filter(([id])=>this.P(id).alive); const vamp=known.find(([,v])=>v); const pickK=vamp||known[0];
          if(pickK){ const t=this.P(pickK[0]); this.say(h, pickK[1]?`Ben kâhinim la! ${t.name} VAMPİR, beni değil onu asın!`:`Ben kâhinim! ${t.name} temiz, ben de masumum.`); this._claimSeer(h,t,!!pickK[1]); }
          else { this.say(h,'Ben kâhinim la! Daha kimseye bakamadım, asmayın beni!'); h.claimed='kahin'; for(const b of this._others(h)) if(b.role!=='vampir') b.sus[h.id]-=0.8; } }
        else if(h.role==='doktor'){ this.say(h,'Ben doktorum! Beni asarsanız geceleri kimse korunmaz!'); this._claimDoctor(h); }
        else { this.say(h,'Ben düz köylüyüm la, bi suçum yok! Yapmayın!'); for(const b of this._others(h)) b.sus[h.id]-=0.3; }
        break; }
      default: { this.say(h,'…','quiet'); for(const b of this._others(h)) b.sus[h.id]+=0.2; }
    }
    this.needs=null;
    this._responses(h);
    this._toFinal();
  }
  _botDefense(acc){
    const r=this.rng, iq=this.iq; const others=this.alive().filter(p=>p!==acc);
    if(acc.role==='kahin'){ const found=Object.entries(acc.knows).find(([id,v])=>v===true && this.P(id).alive); if(found){ const t=this.P(found[0]); this.say(acc, `Ben kâhinim la! ${t.name} VAMPİR! Beni değil onu asın!`); this._claimSeer(acc,t,true); return; } }
    if(acc.role==='doktor' && r.chance(.7)){ this.say(acc,'Ben doktorum! Beni asarsanız geceleri kimse korunmaz!'); this._claimDoctor(acc); return; }
    if(acc.role==='vampir'){
      const realSeer=others.find(p=>p.claimed==='kahin');
      if(!realSeer && r.chance(iq*0.5)){ const t=r.pick(others.filter(p=>p.role!=='vampir')); this.say(acc, `Ben kâhinim! Dün gece ${LN.suf(t.name,'e')} baktım: VAMPİR o!`); this._claimSeer(acc,t,true); return; }
      const t=this._crowdSuspect(others.filter(p=>p.role!=='vampir'),acc)||r.pick(others.filter(p=>p.role!=='vampir'));
      this.say(acc, this.line(LN.DEFENSE_BOT,{o:t.name})); if(r.chance(.5)) this._accuse(acc,t);
      for(const b of this._others(acc)) b.sus[acc.id]-=0.25*(1-b.pers.logic*0.5);
      return;
    }
    const top=[...others].sort((x,y)=>(acc.sus[y.id]||0)-(acc.sus[x.id]||0))[0];
    this.say(acc, this.line(LN.DEFENSE_BOT,{o:top.name}));
    if((acc.sus[top.id]||0)>0.5) this._accuse(acc,top);
    for(const b of this._others(acc)) b.sus[acc.id]-=0.35*acc.cred*(1-b.pers.logic*0.4);
  }
  _responses(acc){
    const r=this.rng; const rs=r.shuffle(this.aliveBots().filter(p=>p!==acc)).slice(0,2);
    for(const b of rs){
      const s=b.sus[acc.id]||0;
      if(s<0.2){ this.say(b, this.line(LN.RESPONSE_BELIEVE,{t:acc.name})); for(const o of this._others(acc)) if(o!==b) o.sus[acc.id]-=0.15*b.cred*o.pers.herd; }
      else { this.say(b, this.line(LN.RESPONSE_DOUBT,{t:acc.name})); for(const o of this._others(acc)) if(o!==b) o.sus[acc.id]+=0.15*b.cred*o.pers.herd; }
    }
  }

  /* ================= SON MÜNAZARA + KİLİTLİ OY ================= */
  _toFinal(){
    this.phase='final'; this.finalVotes={};
    const acc=this.P(this.accused);
    this.narr(`Son karar: ${acc.name} asılsın mı? Herkes oyunu versin ve kitlesin!`);
    // kararlı botlar önce kitler
    for(const b of this.rng.shuffle(this.aliveBots().filter(p=>p!==acc))){
      const d=this._botFinalScore(b,acc);
      if(Math.abs(d)>1.4 && this.rng.chance(b.pers.aggr)) this._lockBot(b, d>0?'hang':'release');
    }
    if(this.human.alive && this.human!==acc) this.needs={ type:'final', accused:acc.id };
    else { this.needs=null; this._finishFinal(); }
  }
  _botFinalScore(b,acc){
    const r=this.rng, iq=this.iq;
    const hangs=Object.values(this.finalVotes).filter(v=>v==='hang').length;
    const sel=Object.values(this.selectVotes).filter(v=>v===acc.id).length/Math.max(1,this.alive().length);
    if(b.role==='vampir'){
      if(acc.role==='vampir'){ const n=this.alive().length-1; return (hangs>n/2 && r.chance(iq)) ? 1 : -2; }
      return 2;
    }
    if(b.knows[acc.id]!==undefined) return b.knows[acc.id]?5:-5;
    return (b.sus[acc.id]||0)*1.1 + sel*1.6*b.pers.herd + hangs*0.25*b.pers.herd + 0.35 + (r()-.5)*(1.2-iq*0.6);
  }
  _lockBot(b,v){ this.finalVotes[b.id]=v; this.say(b, `${v==='hang'?'AS':'BIRAK'}! ${this.pk(LN.LOCK)}`); this.ev({t:'lock', who:b.id, v}); }
  finalVote(v){
    if(this.phase!=='final'||!this.needs) return;
    if(v!=='hang' && v!=='release') return;
    const h=this.human; this.finalVotes[h.id]=v; this.ev({t:'lock', who:h.id, v});
    this.say(h, `${v==='hang'?'AS':'BIRAK'}! Oyumu kitledim!`);
    const acc=this.P(this.accused);
    if(v==='hang' && h.role!=='vampir' && acc.role!=='vampir') this.stats.wrongVotes++;
    this.needs=null;
    this._finishFinal();
  }
  _finishFinal(){
    const acc=this.P(this.accused);
    for(const b of this.rng.shuffle(this.aliveBots().filter(p=>p!==acc && !this.finalVotes[p.id]))){ const d=this._botFinalScore(b,acc); this._lockBot(b, d>0?'hang':'release'); }
    const hang=Object.values(this.finalVotes).filter(v=>v==='hang').length;
    const rel=Object.values(this.finalVotes).filter(v=>v==='release').length;
    this.narr(`Sonuç: ${hang} AS, ${rel} BIRAK.`);
    if(hang>rel) this._execute(acc, hang, rel);
    else {
      const m=this.muhtar(); this.ev({t:'release', who:acc.id}); this.say(m||acc, this.pk(LN.RELEASE));
      for(const b of this._others(acc)) b.sus[acc.id]*=0.6;
      this.lastVote={ hanged:null, name:acc.name, released:true, hang, rel, votes:{...this.finalVotes}, tally:{[acc.id]:hang}, skips:rel };
      this.phase='verdict'; this.needs=null;
    }
  }

  /* ================= İNFAZ ================= */
  _execute(acc, hang, rel){
    const r=this.rng;
    const hangVotes={}; for(const [k,v] of Object.entries(this.finalVotes)) if(v==='hang') hangVotes[k]=acc.id;
    this.sfx('drum');
    this.say(acc, this.pk(LN.PLEAD));
    const ex=this.speaker([acc].concat(this.aliveVamps())) || this.speaker([acc]);
    this.ev({t:'stool', who:acc.id});
    if(ex) this.say(ex, this.pk(LN.EXECUTIONER));
    this.sfx('thud'); this.sfx('creak');
    if(acc.role==='vampir'){
      this.ev({t:'hang', who:acc.id, vamp:true}); this.sfx('evil');
      const s1=this.speaker([acc]); this.say(s1||acc, this.pk(LN.HANG_VAMPIRE_SURPRISE));
      this.say(acc, this.pk(LN.VAMPIRE_HANGED_LINES));
      const kickers=r.shuffle(this.aliveBots().filter(p=>p!==acc && p.role!=='vampir')).slice(0,3);
      if(this.human.alive && this.human!==acc && this.human.role!=='vampir') kickers.unshift(this.human);
      for(const k of kickers.slice(0,3)){ this.ev({t:'kick', who:acc.id, by:k.id}); this.sfx('kick'); this.say(k, k.human?'Bu da benden, al!':this.pk(LN.KICK)); }
      const k=this.stakeCount++; acc.alive=false; acc.fate='impaled'; acc.stakeK=k%3;
      this.ev({t:'impale', who:acc.id, k:acc.stakeK});
      const holders=r.shuffle(this.aliveBots().filter(p=>p!==acc && p.role!=='vampir'));
      for(let i=0;i<3;i++){ const hld=holders[i%Math.max(1,holders.length)]; if(hld) this.say(hld, this.pk(LN.IMPALE)); this.sfx('scream'); this.say(acc, this.pk(LN.SCREAMS),'scream'); }
      this.sfx('impale'); this.sfx('cheer');
      const fin=this.speaker(); if(fin) this.say(fin, this.pk(LN.AFTER_IMPALE));
      if(this.stats.vampHangedDay===null) this.stats.vampHangedDay=this.day;
      if(acc.human) this.stats.humanDiedDay=this.day;
    } else {
      this.ev({t:'hang', who:acc.id, vamp:false});
      acc.alive=false; acc.fate='hanged'; acc.hangOrder=this.hangCount++;
      const s1=this.speaker([acc]); if(s1) this.say(s1, this.pk(LN.HANG_VILLAGER));
      this.narr(`${acc.name} ${ROLE_INFO[acc.role].name.toLowerCase()}${roleSuffix(acc.role)}.`);
      if(acc.human) this.stats.humanDiedDay=this.day;
    }
    this.lastVote={ hanged:acc.id, name:acc.name, role:acc.role, hang, rel, votes:hangVotes, tally:{[acc.id]:hang}, skips:rel };
    this._afterVerdict(acc, hangVotes);
    this.phase='verdict'; this.needs=null;
    if(this._checkWin()) return;
    if(!this.human.alive) this._autoplayRest();
  }
  _afterVerdict(hp, votes){
    if(!hp) return;
    const voters=Object.entries(votes).filter(([,v])=>v===hp.id).map(([k])=>this.P(k));
    const accusers=(this.accusedBy[hp.id]||[]).map(id=>this.P(id));
    const defenders=(this.defendedBy[hp.id]||[]).map(id=>this.P(id));
    const bots=this.aliveBots();
    if(hp.role==='vampir'){
      for(const v of voters) v.cred=Math.min(1.6,v.cred+0.2);
      for(const d of defenders){ d.cred=Math.max(.3,d.cred-0.4); for(const b of bots) if(b!==d) b.sus[d.id]+=1.6*b.pers.logic; }
      for(const p of this.alive()) if(p.claimed==='kahin' && p.claims.some(c=>c.target===hp.id&&c.isVamp)){ p.cred=1.6; for(const b of bots) if(b!==p) b.sus[p.id]-=3; }
      for(const p of this.alive()) if(p.claimed==='kahin' && p.claims.some(c=>c.target!==hp.id&&c.isVamp) && hp.claimed==='kahin'){ /* vampir sahte kâhindi */ }
    } else {
      for(const a of accusers){ a.cred=Math.max(.3,a.cred-0.3); for(const b of bots) if(b!==a) b.sus[a.id]+=1.0*b.pers.logic; }
      for(const v of voters) for(const b of bots) if(b!==v) b.sus[v.id]+=0.3*b.pers.logic;
      for(const d of defenders) d.cred=Math.min(1.6,d.cred+0.15);
      for(const p of this.alive()) if(p.claimed==='kahin' && p.claims.some(c=>c.target===hp.id&&c.isVamp)){ p.cred=.3; for(const b of bots) if(b!==p) b.sus[p.id]+=4; }
    }
    for(const b of bots) for(const k in b.sus) b.sus[k]*=0.85;
  }
  nextNight(){ if(this.phase!=='verdict') return; this.toNight(); }

  /* ================= BİTİŞ ================= */
  _checkWin(){
    const al=this.alive(); const v=al.filter(p=>p.role==='vampir').length; const o=al.length-v;
    if(v===0) this.winner='koylu'; else if(v>=o) this.winner='vampir';
    if(!this.winner) return false;
    this.phase='end'; this.needs=null;
    this.ev({t:'night', on:this.winner==='vampir'}); this.ev({t:'gather'});
    if(this.winner==='vampir'){
      const vamps=this.aliveVamps(); const vills=al.filter(p=>p.role!=='vampir');
      vamps.forEach(p=>this.ev({t:'fangs', who:p.id}));
      vills.forEach(p=>{ this.ev({t:'hang', who:p.id, vamp:false, final:true}); p.fate='hanged'; p.hangOrder=this.hangCount++; });
      this.sfx('evil');
      const sp=vamps[0];
      this.say(sp, this.pk(vamps.length>1 || this.players.filter(p=>p.role==='vampir').length>1 ? LN.END_VAMP_MULTI : LN.END_VAMP_SOLO));
      this.narr('Vampirler köyü ele geçirdi!');
    } else {
      this.sfx('festive');
      const sp=this.speaker(); if(sp) this.say(sp, this.pk(LN.END_VILLAGE)); else this.narr(this.pk(LN.END_VILLAGE));
      this.narr('Son vampir de kazığa oturtuldu. Köy kurtuldu!');
    }
    this.result=this._score();
    return true;
  }
  humanWon(){ const side=this.human.role==='vampir'?'vampir':'koylu'; return this.winner===side; }

  _autoplayRest(){
    let guard=0;
    while(!this.winner && guard++<60){
      if(this.phase==='dawn'){ this.startTalk(); }
      else if(this.phase==='talk'){ this.round++; if(this.round>this.roundsToday) this._toSelect(); else this._botsSpeak(); }
      else if(this.phase==='select'){ this.selectHouse(null); }
      else if(this.phase==='verdict'){ this.toNight(); }
      else if(this.phase==='night' && this.needs){ this.needs=null; this._resolveNight(); }
      else break;
    }
  }

  _score(){
    const L=this.level, s=this.stats, won=this.humanWon();
    let stars=won?1:0, objOk=false, perfect=false, objText='';
    const o=L.objective||{type:'win'};
    switch(o.type){
      case 'win': objOk=won && s.humanDiedDay===null; objText='Hayatta kal ve kazan'; break;
      case 'winByDay': objOk=won && s.days<=o.n; objText=`${o.n}. günden önce kazan`; break;
      case 'vampHangedByDay': objOk=won && s.vampHangedDay!==null && s.vampHangedDay<=o.n; objText=`Vampiri ${o.n}. günden önce kazığa oturt`; break;
      case 'saves': objOk=won && s.saves>=o.n; objText=`En az ${o.n} kişiyi kurtar`; break;
      case 'maxVotes': objOk=won && s.votesReceived<=o.n; objText=`En fazla ${o.n} oy al`; break;
      case 'noWrongVote': objOk=won && s.wrongVotes===0; objText='Hiç yanlış kişiye AS deme'; break;
      case 'survive': objOk=won && s.humanDiedDay===null; objText='Hayatta kal ve kazan'; break;
    }
    if(objOk){ stars=2; perfect = this.human.role==='vampir' ? s.votesReceived<=1 : (s.wrongVotes===0 && s.humanDiedDay===null); if(perfect) stars=3; }
    return { won, stars, objOk, objText, perfect, days:s.days, role:this.human.role };
  }
}
function roleSuffix(role){ return { koylu:'müş', doktor:'muş', kahin:'miş', vampir:'miş' }[role]||'miş'; }


/* ------------------------------ SEVİYELER ------------------------------ */
export const CHAPTERS = [
  { id:1, name:'Köy Meydanı', sub:'Öğretici', ic:'🏘️', color:'#d9a441' },
  { id:2, name:'Kan Ayı', sub:'Rol ustası', ic:'🌕', color:'#e23b4a' },
  { id:3, name:'Kale', sub:'Çifte tehdit', ic:'🏰', color:'#4f8de6' },
  { id:4, name:'Lanetli Orman', sub:'Usta', ic:'🌲', color:'#3fb37f' },
];
export const LEVELS = [
  // Bölüm 1
  { id:1, ch:1, name:'İlk Gece', players:5, vampires:1, role:'koylu', iq:.2, rounds:2, objective:{type:'win'}, desc:'Köylüsün. Botlar saf; tartışmayı izle, vampiri bul.' },
  { id:2, ch:1, name:'Acele Et', players:5, vampires:1, role:'koylu', iq:.25, rounds:2, objective:{type:'winByDay',n:3} },
  { id:3, ch:1, name:'Üçüncü Göz', players:5, vampires:1, role:'kahin', iq:.3, rounds:2, objective:{type:'vampHangedByDay',n:2}, desc:'Kâhinsin. Gece birine bak, gündüz bildiğini akıllıca kullan.' },
  { id:4, ch:1, name:'Temiz Vicdan', players:6, vampires:1, role:'kahin', iq:.35, rounds:2, objective:{type:'noWrongVote'} },
  { id:5, ch:1, name:'Kalabalık', players:6, vampires:1, role:'koylu', iq:.4, rounds:2, objective:{type:'win'} },
  { id:6, ch:1, name:'Meydan Okuma', players:6, vampires:1, role:'kahin', iq:.5, rounds:2, objective:{type:'winByDay',n:3}, boss:true },
  // Bölüm 2
  { id:7, ch:2, name:'Şifacı', players:8, vampires:1, role:'doktor', iq:.35, rounds:2, objective:{type:'saves',n:1}, desc:'Doktorsun. Vampir, kendisini en çok suçlayanı ve kâhin olduğunu söyleyeni hedef alır; onları koru.' },
  { id:8, ch:2, name:'Gece Nöbeti', players:7, vampires:1, role:'doktor', iq:.45, rounds:2, objective:{type:'winByDay',n:3} },
  { id:9, ch:2, name:'Karanlık Taraf', players:7, vampires:2, role:'vampir', iq:.4, rounds:2, objective:{type:'win'}, desc:'Vampirsin ve bir ortağın var. Gece kurban seç, gündüz masum rolü yap. Kâhini erken yok et.' },
  { id:10, ch:2, name:'Gölgede Kal', players:7, vampires:2, role:'vampir', iq:.45, rounds:2, objective:{type:'maxVotes',n:2}, desc:'Bir vampir ortağın var; gece hedefi sen seçersin. Dikkat çekme.' },
  { id:11, ch:2, name:'Kader', players:7, vampires:1, role:'random', iq:.5, rounds:2, objective:{type:'win'} },
  { id:12, ch:2, name:'Kan Ayı', players:8, vampires:2, role:'vampir', iq:.55, rounds:2, objective:{type:'winByDay',n:4}, boss:true },
  // Bölüm 3
  { id:13, ch:3, name:'İki Gölge', players:8, vampires:2, role:'koylu', iq:.4, rounds:3, objective:{type:'win'}, desc:'Artık iki vampir var ve botlar yalan söylemeye başladı.' },
  { id:14, ch:3, name:'Hızlı Kehanet', players:8, vampires:2, role:'kahin', iq:.55, rounds:3, objective:{type:'vampHangedByDay',n:2} },
  { id:15, ch:3, name:'Son Nefes', players:9, vampires:2, role:'doktor', iq:.6, rounds:3, objective:{type:'saves',n:1} },
  { id:16, ch:3, name:'Kan Kardeşi', players:8, vampires:2, role:'vampir', iq:.4, rounds:3, objective:{type:'win'}, desc:'Bir vampir ortağın var. Gece hedefi sen seçersin.' },
  { id:17, ch:3, name:'Zar', players:10, vampires:2, role:'random', iq:.7, rounds:3, objective:{type:'winByDay',n:4} },
  { id:18, ch:3, name:'Kale Düşmesin', players:10, vampires:2, role:'kahin', iq:.75, rounds:3, objective:{type:'noWrongVote'}, boss:true },
  // Bölüm 4
  { id:19, ch:4, name:'Sisli Yol', players:10, vampires:2, role:'koylu', iq:.75, rounds:2, objective:{type:'win'}, desc:'Botlar zeki, tartışma kısa. Her sözün önemli.' },
  { id:20, ch:4, name:'İki Can', players:10, vampires:2, role:'doktor', iq:.8, rounds:2, objective:{type:'saves',n:1} },
  { id:21, ch:4, name:'Görünmez', players:11, vampires:3, role:'vampir', iq:.75, rounds:2, objective:{type:'maxVotes',n:2} },
  { id:22, ch:4, name:'Üç Diş', players:12, vampires:3, role:'kahin', iq:.85, rounds:2, objective:{type:'vampHangedByDay',n:2} },
  { id:23, ch:4, name:'Şafak', players:12, vampires:3, role:'random', iq:.9, rounds:2, objective:{type:'winByDay',n:5} },
  { id:24, ch:4, name:'Lanetin Sonu', players:12, vampires:3, role:'random', iq:.95, rounds:2, objective:{type:'noWrongVote'}, boss:true, desc:'Son sınav. Her şeyi öğrendin; şimdi göster.' },
];
export function objectiveText(o){
  switch(o?.type){ case 'winByDay': return `${o.n}. günden önce kazan`; case 'vampHangedByDay': return `Vampiri ${o.n}. günden önce astır`; case 'saves': return `En az ${o.n} kişiyi kurtar ve kazan`; case 'maxVotes': return `En fazla ${o.n} oy alarak kazan`; case 'noWrongVote': return 'Hiç yanlış oy vermeden kazan'; case 'survive': return 'Hayatta kal ve kazan'; default: return 'Hayatta kal ve kazan'; }
}
export const RANKS = [
  { xp:0, name:'Çırak', ic:'🕯️' }, { xp:600, name:'Gözcü', ic:'👁️' }, { xp:1600, name:'Avcı', ic:'🏹' }, { xp:3200, name:'Vampir Avcısı', ic:'🗡️' }, { xp:5500, name:'Köy Reisi', ic:'👑' },
];
export function rankFor(xp){ let r=RANKS[0]; for(const k of RANKS) if(xp>=k.xp) r=k; const i=RANKS.indexOf(r); return { ...r, next: RANKS[i+1]||null }; }
export function xpFor(result, level){ if(!result.won) return 20; return 100 + result.stars*50 + (level.boss?100:0) + Math.round((level.iq||0)*100); }
