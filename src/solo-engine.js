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
   * opts: {rng, humanName}
   */
  constructor(level, opts={}){
    this.rng = opts.rng || makeRng(Date.now()&0xffffffff);
    this.level = level;
    this.humanName = opts.humanName || 'Sen';
    this.iq = level.iq ?? .5;
    this.maxRounds = level.rounds ?? 2;
    this._build();
  }

  _build(){
    const r=this.rng, L=this.level;
    const n=L.players, v=L.vampires ?? (n>=12?3:n>=8?2:1);
    const roles=[]; for(let i=0;i<v;i++) roles.push('vampir'); roles.push('doktor','kahin'); while(roles.length<n) roles.push('koylu');
    let humanRole = L.role==='random' ? r.pick(['koylu','koylu','kahin','doktor','vampir']) : L.role;
    // insan rolünü havuzdan çıkar
    const idx=roles.indexOf(humanRole); roles.splice(idx,1);
    const botRoles=r.shuffle(roles);
    const names=r.shuffle(BOT_NAMES).slice(0,n-1), avs=r.shuffle(AVATARS);
    const pkeys=Object.keys(PERSONALITIES);
    this.players=[{ id:'me', name:this.humanName, avatar:'🙋', role:humanRole, alive:true, human:true, cred:1, claimed:null, claims:[], knows:{}, sus:{} }];
    botRoles.forEach((role,i)=>{
      const pk = role==='vampir' && r.chance(.5) ? 'yalanci' : r.pick(pkeys);
      this.players.push({ id:'b'+i, name:names[i], avatar:avs[i], role, alive:true, human:false, pers:PERSONALITIES[pk], persKey:pk, cred:1, claimed:null, claims:[], knows:{}, sus:{} });
    });
    for(const p of this.players){ for(const q of this.players){ if(p!==q) p.sus[q.id]=0; } }
    // vampirler birbirini bilir
    const vamps=this.players.filter(p=>p.role==='vampir');
    for(const p of vamps) for(const q of vamps) if(p!==q) p.knows[q.id]=true;
    this.day=0; this.phase='roles'; this.feed=[]; this.round=0;
    this.night=null; this.lastNight=null; this.lastVote=null; this.winner=null;
    this.stats={ wrongVotes:0, votesReceived:0, saves:0, vampHangedDay:null, days:0, humanDiedDay:null, quietRounds:0 };
    this.accusedBy={}; // targetId -> [speakerId] (bugün)
    this.defendedBy={};
    this.spokeToday=new Set();
    this.human=this.players[0];
  }

  /* ---------- yardımcılar ---------- */
  P(id){ return this.players.find(p=>p.id===id); }
  alive(){ return this.players.filter(p=>p.alive); }
  aliveVamps(){ return this.alive().filter(p=>p.role==='vampir'); }
  say(who, text, kind='talk'){ this.feed.push({ day:this.day, who: who?who.id:null, name: who?who.name:'Anlatıcı', avatar: who?who.avatar:'🌙', text, kind }); }
  narr(text){ this.say(null, text, 'narr'); }
  publicInfo(){ // UI için
    return { phase:this.phase, day:this.day, round:this.round, maxRounds:this.maxRounds, winner:this.winner,
      players:this.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,alive:p.alive,human:p.human,role:(p.human||!p.alive||this.phase==='end'||(this.human.role==='vampir'&&p.role==='vampir'))?p.role:null, claimed:p.claimed})),
      feed:this.feed, lastNight:this.lastNight, lastVote:this.lastVote, human:{...this.human}, stats:this.stats, needs:this.needs||null };
  }

  /* ---------- akış ---------- */
  ackRole(){ if(this.phase!=='roles') return; this.toNight(); }

  toNight(){
    this.day++; this.stats.days=this.day; this.phase='night'; this.round=0;
    this.night={ vampTarget:null, doctor:null, seer:null, seerResult:null };
    this.accusedBy={}; this.defendedBy={}; this.spokeToday=new Set();
    this.narr(this.day===1?'Gece oluyor. Köy uykuya dalıyor…':`Gece ${this.day}. Köy yeniden uykuya dalıyor…`);
    const h=this.human;
    this.needs=null;
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
    else if(this.needs.type==='kahin'){ this.night.seer=targetId; const t=this.P(targetId); this.night.seerResult=(t.role==='vampir'); h.knows[targetId]=t.role==='vampir'; this.lastSeer={target:targetId,isVamp:t.role==='vampir'}; }
    this.needs=null;
    this._resolveNight();
  }

  _botNight(){
    const r=this.rng, iq=this.iq, al=this.alive();
    // vampir botlar
    if(this.night.vampTarget===null){
      const vamps=this.aliveVamps().filter(p=>!p.human);
      if(vamps.length){
        let cands=al.filter(p=>p.role!=='vampir');
        if(this.day===1 && cands.length>1) cands=cands.filter(p=>!p.human); // ilk gece insan hedef alınmaz
        let target=null;
        // öncelik: kâhin iddia eden, doktor iddia eden, vampirleri en çok suçlayan (doktor bunu öngörebilir)
        const seerClaim=cands.find(p=>p.claimed==='kahin'); const docClaim=cands.find(p=>p.claimed==='doktor');
        if(seerClaim && r.chance(.6+iq*.35)) target=seerClaim;
        else if(docClaim && r.chance(.3+iq*.4)) target=docClaim;
        else {
          let best=null,bs=-1e9;
          for(const c of cands){ let s=(c.accusedVampCount||0)*2+(c.accuseCount||0)*1.2; for(const v of vamps) s+= (c.human?this._humanThreat():(c.sus[v.id]||0))*0.5; s+=r()*(0.6+(1-iq)*1.5); if(s>bs){bs=s;best=c;} }
          target=best;
        }
        this.night.vampTarget=target.id;
      }
    }
    // doktor bot
    const doc=al.find(p=>p.role==='doktor'&&!p.human);
    if(doc){
      const seerClaim=al.find(p=>p.claimed==='kahin' && p!==doc);
      let t;
      if(seerClaim && r.chance(.4+iq*.5)) t=seerClaim;
      else if(r.chance(.35)) t=doc;
      else { const others=al.filter(p=>p!==doc); let best=others[0],bs=-1e9; for(const c of others){ const s=-(doc.sus[c.id]||0)+r()*2; if(s>bs){bs=s;best=c;} } t=best; }
      this.night.doctor=t.id;
    }
    // kâhin bot
    const seer=al.find(p=>p.role==='kahin'&&!p.human);
    if(seer){
      const unknown=al.filter(p=>p!==seer && seer.knows[p.id]===undefined);
      if(unknown.length){
        let t; if(r.chance(iq)){ let best=unknown[0],bs=-1e9; for(const c of unknown){ const s=(seer.sus[c.id]||0)+r(); if(s>bs){bs=s;best=c;} } t=best; } else t=r.pick(unknown);
        seer.knows[t.id]=(t.role==='vampir'); this.night.seer=t.id;
        if(t.role==='vampir') seer.sus[t.id]+=100; else seer.sus[t.id]-=100;
      }
    }
  }
  _humanThreat(){ // vampirlerin insana duyduğu tehdit: iddiaları ve suçlamaları
    const h=this.human; let s=0; if(h.claimed==='kahin') s+=3; if(h.claimed==='doktor') s+=2; return s;
  }

  _resolveNight(){
    this._botNight();
    const victimId=this.night.vampTarget; const saved = victimId && this.night.doctor===victimId;
    let killed=null;
    if(victimId && !saved){ const v=this.P(victimId); v.alive=false; killed=v; if(v.human) this.stats.humanDiedDay=this.day; }
    if(saved && this.human.role==='doktor' && this.night.doctor===victimId) this.stats.saves++;
    if(saved){ const d=this.alive().find(p=>p.role==='doktor'); if(d&&!d.human) d.savedSomeone=victimId; }
    this.lastNight={ killed:killed?killed.id:null, killedName:killed?killed.name:null, killedRole:killed?killed.role:null, saved:!!saved,
      seer: this.human.role==='kahin'&&this.night.seer?{target:this.night.seer,isVamp:this.night.seerResult}:null };
    // ölen kişi kâhin iddiasındaysa iddiaları güçlenir
    if(killed && killed.claimed==='kahin'){ for(const c of killed.claims){ this._applyClaim(killed, c.target, c.isVamp, 1.5, true); } }
    // ölen kişiyi suçlayanlar hafif şüphe çeker (ölen masum)
    this.phase='dawn';
    this.narr(killed ? `Sabah oldu. ${killed.name} bu gece öldürüldü. (${ROLE_INFO[killed.role].name})` : (saved?'Sabah oldu. Vampirler saldırdı ama doktor kurtardı! Kimse ölmedi.':'Sabah oldu. Kimse ölmedi.'));
    if(this._checkWin()) return;
    if(!this.human.alive){ this._autoplayRest(); }
  }

  /* ---------- gündüz: tartışma ---------- */
  startTalk(){
    if(this.phase!=='dawn') return;
    this.phase='talk'; this.round=1;
    if(this.lastNight.killed && this.rng.chance(.6)){ const b=this.rng.pick(this.alive().filter(p=>!p.human)); if(b) this.say(b, fill(this.rng.pick(T.afterKill),{v:this.lastNight.killedName}), 'flavor'); }
    this._botsSpeak();
    this.needs={ type:'talk' };
  }

  humanOptions(){
    const h=this.human, al=this.alive().filter(p=>p!==h);
    const opts=[];
    opts.push({ type:'accuse', label:'Suçla', targets:al.map(p=>p.id) });
    opts.push({ type:'defend', label:'Savun', targets:al.map(p=>p.id) });
    if(h.claimed!=='kahin' || h.role==='kahin'){
      // kâhin iddiası: gerçek kâhinse bildiği sonuçlar; değilse serbest (yalan)
      const known = h.role==='kahin' ? Object.entries(h.knows).filter(([id])=>this.P(id).alive).map(([id,isVamp])=>({target:id,isVamp})) : null;
      if(h.role==='kahin'){ if(known.length) opts.push({ type:'claimSeer', label:'Kâhin olduğunu açıkla', results:known }); }
      else opts.push({ type:'claimSeer', label:'Kâhinim de (yalan)', results: al.map(p=>({target:p.id,isVamp:true})).concat(al.map(p=>({target:p.id,isVamp:false}))) });
    }
    if(h.claimed!=='doktor') opts.push({ type:'claimDoctor', label: h.role==='doktor'?'Doktor olduğunu açıkla':'Doktorum de (yalan)' });
    opts.push({ type:'quiet', label:'Sessiz kal' });
    return opts;
  }

  talkAction(a){
    if(this.phase!=='talk') return;
    const h=this.human;
    switch(a.type){
      case 'accuse': { const t=this.P(a.target); if(!t||!t.alive||t===h) return; this.say(h, `${t.name} vampir olabilir. Ona oy vereceğim.`); this._accuse(h,t); break; }
      case 'defend': { const t=this.P(a.target); if(!t||!t.alive||t===h) return; this.say(h, `${t.name} masum, ona kefilim.`); this._defend(h,t); break; }
      case 'claimSeer': { const t=this.P(a.target); if(!t||!t.alive) return; const isVamp=!!a.isVamp;
        if(h.role==='kahin' && h.knows[a.target]!==isVamp) return;
        this.say(h, isVamp?`Ben kâhinim! Dün gece ${suf(t.name,'e')} baktım: VAMPİR.`:`Ben kâhinim. ${t.name} temiz, ona oy vermeyin.`);
        this._claimSeer(h,t,isVamp); break; }
      case 'claimDoctor': { this.say(h, this.lastNight?.saved?'Doktor benim, dün gece kurtaran bendim.':'Ben doktorum, bana oy vermeyin.'); this._claimDoctor(h); break; }
      case 'quiet': default: { this.stats.quietRounds++; this.say(h,'…','quiet'); break; }
    }
    this.spokeToday.add(h.id);
    this.round++;
    if(this.round>this.maxRounds){ this._toVote(); return; }
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
  _claimSeer(s,t,isVamp){
    const prior=this.alive().find(p=>p!==s && p.claimed==='kahin');
    s.claimed='kahin'; s.claims.push({target:t.id,isVamp});
    this._applyClaim(s,t,isVamp,1,false,prior);
  }
  _applyClaim(s,t,isVamp,mult,dead,prior){
    for(const b of this._others(s)){
      if(b===t){ b.sus[s.id]+= isVamp?2.5:-1; continue; }
      if(b.role==='vampir') continue; // vampirler gerçeği bilir
      if(b.role==='kahin' && !dead){ b.sus[s.id]+=4; continue; } // gerçek kâhin yalancıyı bilir
      let w = 2.5*s.cred*mult;
      if(prior && !dead){ w*=0.5; b.sus[s.id]+=0.8*b.pers.logic; b.sus[prior.id]+=0.8*b.pers.logic; }
      b.sus[t.id]+= isVamp? w : -w*0.6;
    }
  }
  _claimDoctor(s){
    s.claimed='doktor';
    for(const b of this._others(s)){
      if(b.role==='doktor'){ b.sus[s.id]+=3; continue; }
      if(b.role==='vampir') continue;
      b.sus[s.id]-= (this.lastNight?.saved?1.5:0.6)*s.cred;
    }
  }

  _botsSpeak(){
    const r=this.rng, iq=this.iq;
    const bots=r.shuffle(this.alive().filter(p=>!p.human));
    for(const b of bots){
      if(!r.chance(b.pers.talk*0.75+0.2)) { continue; }
      this.spokeToday.add(b.id);
      const others=this.alive().filter(p=>p!==b);
      const h=this.human;
      // 1) vampir bot: karşı kâhin iddiası
      if(b.role==='vampir'){
        const seerClaim=others.find(p=>p.claimed==='kahin' && p.claims.some(c=>this.P(c.target).role==='vampir' && this.P(c.target).alive));
        const vampClaimed=this.players.some(p=>p.role==='vampir'&&p.claimed==='kahin');
        if(seerClaim && !vampClaimed && r.chance(iq*0.8)){ this.say(b, fill(r.pick(T.counterSeer),{t:seerClaim.name})); this._claimSeer(b,seerClaim,true); continue; }
        // köylülerin en çok şüphelendiği masuma yüklen
        const cands=others.filter(p=>p.role!=='vampir');
        let t=this._crowdSuspect(cands, b) || r.pick(cands);
        if(r.chance(0.35+iq*0.4)){ this.say(b, fill(r.pick(T.accuse),{t:t.name})); this._accuse(b,t); }
        else this.say(b, r.pick(T.quiet),'quiet');
        continue;
      }
      // 2) gerçek kâhin bot: vampir bulduysa açıkla (zekâya göre zamanlama)
      if(b.role==='kahin'){
        const found=Object.entries(b.knows).find(([id,v])=>v===true && this.P(id).alive && !b.claims.some(c=>c.target===id));
        if(found && r.chance(0.5+iq*0.5)){ const t=this.P(found[0]); this.say(b, fill(r.pick(T.seerVamp),{t:t.name})); this._claimSeer(b,t,true); continue; }
        const clean=Object.entries(b.knows).find(([id,v])=>v===false && this.P(id).alive && (this.accusedBy[id]||[]).length && !b.claims.some(c=>c.target===id));
        if(clean && b.claimed==='kahin' && r.chance(.6)){ const t=this.P(clean[0]); this.say(b, fill(r.pick(T.seerClean),{t:t.name})); this._claimSeer(b,t,false); continue; }
      }
      // 3) doktor bot: kurtardıysa bazen açıklar
      if(b.role==='doktor' && b.savedSomeone && !b.claimed && r.chance(.4)){ const t=this.P(b.savedSomeone); this.say(b, fill(r.pick(T.doctorSaved),{t:t.name})); this._claimDoctor(b); b.savedSomeone=null; continue; }
      // 4) sıradan: en şüphelendiğini suçla / savun / sus
      const ranked=[...others].sort((x,y)=>(b.sus[y.id]||0)-(b.sus[x.id]||0));
      const top=ranked[0]; const topS=b.sus[top.id]||0;
      const herdTarget = b.pers.herd>0.6 ? this._crowdSuspect(others,b) : null;
      if(herdTarget && r.chance(b.pers.herd*0.6) && (b.sus[herdTarget.id]||0)>-1){ this.say(b, fill(r.pick(T.accuseHerd),{t:herdTarget.name})); this._accuse(b,herdTarget); continue; }
      if(topS>0.6 && r.chance(b.pers.aggr*0.8+0.1)){ this.say(b, fill(r.pick(T.accuse),{t:top.name})); this._accuse(b,top); continue; }
      const accusedInnocent = others.find(p=>(this.accusedBy[p.id]||[]).length && (b.sus[p.id]||0)<-0.5);
      if(accusedInnocent && r.chance(.5)){ this.say(b, fill(r.pick(T.defend),{t:accusedInnocent.name})); this._defend(b,accusedInnocent); continue; }
      this.say(b, r.pick(T.quiet),'quiet');
    }
    // sessiz kalanlara mantıklı botlardan hafif şüphe
    for(const b of this.alive().filter(p=>!p.human)) for(const p of this.alive()) if(p!==b && !this.spokeToday.has(p.id)) b.sus[p.id]+=0.08*b.pers.logic;
  }
  _crowdSuspect(cands, except){
    let best=null,bs=0.4;
    for(const c of cands){ let s=0,n=0; for(const b of this.alive()) if(b!==c&&b!==except&&!b.human){ s+=(b.sus[c.id]||0); n++; } s=n?s/n:0; if(s>bs){bs=s;best=c;} }
    return best;
  }

  /* ---------- oylama ---------- */
  _toVote(){ this.phase='vote'; this.needs={ type:'vote', cands:this.alive().filter(p=>p!==this.human).map(p=>p.id) }; this.narr('Oylama zamanı. Kim asılsın?'); }

  vote(targetId){
    if(this.phase!=='vote') return;
    const h=this.human; const votes={};
    if(h.alive){ votes[h.id]= (targetId && targetId!=='skip' && this.P(targetId)?.alive) ? targetId : 'skip'; }
    const r=this.rng, iq=this.iq;
    const bots=r.shuffle(this.alive().filter(p=>!p.human));
    const tally=()=>{ const t={}; for(const v of Object.values(votes)) if(v!=='skip') t[v]=(t[v]||0)+1; return t; };
    for(const b of bots){
      const others=this.alive().filter(p=>p!==b);
      let cands = b.role==='vampir' ? others.filter(p=>p.role!=='vampir') : others;
      let best=null,bs=-1e9;
      const cur=tally();
      for(const c of cands){ let s=(b.sus[c.id]||0) + (cur[c.id]||0)*b.pers.herd*0.9 + (r()-.5)*(1.2-iq); if(b.role==='vampir'){ s+= (cur[c.id]||0)*0.8; } if(s>bs){bs=s;best=c;} }
      if(bs<0.25 && b.role!=='vampir' && r.chance(.6)) votes[b.id]='skip'; else votes[b.id]=best.id;
    }
    const t=tally(); let hanged=null,max=0,tie=false;
    for(const [id,c] of Object.entries(t)){ if(c>max){max=c;hanged=id;tie=false;} else if(c===max) tie=true; }
    const skips=Object.values(votes).filter(v=>v==='skip').length;
    if(tie||max===0||skips>=max) hanged=null;
    const hp=hanged?this.P(hanged):null;
    if(hp){ hp.alive=false; if(hp.human) this.stats.humanDiedDay=this.day; }
    // istatistik
    if(h.alive||hp===h){ const hv=votes[h.id]; if(hv&&hv!=='skip'&&h.role!=='vampir'&&this.P(hv).role!=='vampir') this.stats.wrongVotes++; }
    this.stats.votesReceived += t[h.id]||0;
    if(hp && hp.role==='vampir' && this.stats.vampHangedDay===null) this.stats.vampHangedDay=this.day;
    this.lastVote={ hanged, name:hp?hp.name:null, role:hp?hp.role:null, tally:t, votes, skips, tie };
    this.narr(hp?`${hp.name} asıldı. Rolü: ${ROLE_INFO[hp.role].name}.`:(tie?'Oylar eşit, kimse asılmadı.':'Kimse asılmadı.'));
    this._afterVerdict(hp, votes);
    this.phase='verdict'; this.needs=null;
    if(this._checkWin()) return;
    if(!this.human.alive) this._autoplayRest();
  }

  _afterVerdict(hp, votes){
    if(!hp) return;
    const voters=Object.entries(votes).filter(([,v])=>v===hp.id).map(([k])=>this.P(k));
    const accusers=(this.accusedBy[hp.id]||[]).map(id=>this.P(id));
    const defenders=(this.defendedBy[hp.id]||[]).map(id=>this.P(id));
    const bots=this.alive().filter(p=>!p.human);
    if(hp.role==='vampir'){
      for(const v of voters) v.cred=Math.min(1.6,v.cred+0.2);
      for(const d of defenders){ d.cred=Math.max(.3,d.cred-0.4); for(const b of bots) if(b!==d) b.sus[d.id]+=1.6*b.pers.logic; }
      // vampir diyen kâhin iddiası doğrulandı
      for(const p of this.alive()) if(p.claimed==='kahin' && p.claims.some(c=>c.target===hp.id&&c.isVamp)){ p.cred=1.6; for(const b of bots) if(b!==p) b.sus[p.id]-=3; }
    } else {
      for(const a of accusers){ a.cred=Math.max(.3,a.cred-0.3); for(const b of bots) if(b!==a) b.sus[a.id]+=1.0*b.pers.logic; }
      for(const v of voters) for(const b of bots) if(b!==v) b.sus[v.id]+=0.3*b.pers.logic;
      for(const d of defenders) d.cred=Math.min(1.6,d.cred+0.15);
      for(const p of this.alive()) if(p.claimed==='kahin' && p.claims.some(c=>c.target===hp.id&&c.isVamp)){ p.cred=.3; for(const b of bots) if(b!==p) b.sus[p.id]+=4; }
    }
    // ölenin şüphe kayıtları temizlenmez; oylama sonrası genel yumuşama
    for(const b of bots) for(const k in b.sus) b.sus[k]*=0.85;
  }

  nextNight(){ if(this.phase!=='verdict') return; this.toNight(); }

  /* ---------- kazanma ---------- */
  _checkWin(){
    const al=this.alive(); const v=al.filter(p=>p.role==='vampir').length; const o=al.length-v;
    if(v===0) this.winner='koylu'; else if(v>=o) this.winner='vampir';
    if(this.winner){ this.phase='end'; this.needs=null; this.narr(this.winner==='vampir'?'Vampirler köyü ele geçirdi!':'Son vampir de yok edildi. Köy kurtuldu!'); this.result=this._score(); return true; }
    return false;
  }
  humanWon(){ const side=this.human.role==='vampir'?'vampir':'koylu'; return this.winner===side; }

  _autoplayRest(){
    // insan öldü: kalan oyunu hızlıca botlarla oynat
    let guard=0;
    while(!this.winner && guard++<40){
      if(this.phase==='dawn'){ this.startTalk(); while(this.phase==='talk'){ this.round++; if(this.round>this.maxRounds){ this._toVote(); } else this._botsSpeak(); } }
      if(this.phase==='vote'){ this.vote('skip'); }
      if(this.phase==='verdict'){ this.toNight(); }
      if(this.phase==='night' && this.needs){ this.needs=null; this._resolveNight(); }
    }
  }

  _score(){
    const L=this.level, s=this.stats, won=this.humanWon();
    let stars=0, objOk=false, perfect=false, objText='';
    if(won) stars=1;
    const o=L.objective||{type:'win'};
    switch(o.type){
      case 'win': objOk=won && s.humanDiedDay===null; objText='Hayatta kal ve kazan'; break;
      case 'winByDay': objOk=won && s.days<=o.n; objText=`${o.n}. günden önce kazan`; break;
      case 'vampHangedByDay': objOk=won && s.vampHangedDay!==null && s.vampHangedDay<=o.n; objText=`Vampiri ${o.n}. günden önce astır`; break;
      case 'saves': objOk=won && s.saves>=o.n; objText=`En az ${o.n} kişiyi kurtar`; break;
      case 'maxVotes': objOk=won && s.votesReceived<=o.n; objText=`En fazla ${o.n} oy al`; break;
      case 'noWrongVote': objOk=won && s.wrongVotes===0; objText='Hiç yanlış oy verme'; break;
      case 'survive': objOk=won && s.humanDiedDay===null; objText='Hayatta kal ve kazan'; break;
    }
    if(objOk) stars=2;
    if(objOk){ perfect = this.human.role==='vampir' ? s.votesReceived<=1 : (s.wrongVotes===0 && s.humanDiedDay===null); if(perfect) stars=3; }
    return { won, stars, objOk, objText, perfect, days:s.days, role:this.human.role };
  }
}

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
  { id:9, ch:2, name:'Karanlık Taraf', players:5, vampires:1, role:'vampir', iq:.35, rounds:2, objective:{type:'win'}, desc:'Vampirsin. Gece kurban seç, gündüz masum rolü yap. Kâhini erken yok et.' },
  { id:10, ch:2, name:'Gölgede Kal', players:7, vampires:2, role:'vampir', iq:.45, rounds:2, objective:{type:'maxVotes',n:2}, desc:'Bir vampir ortağın var; gece hedefi sen seçersin. Dikkat çekme.' },
  { id:11, ch:2, name:'Kader', players:7, vampires:1, role:'random', iq:.5, rounds:2, objective:{type:'win'} },
  { id:12, ch:2, name:'Kan Ayı', players:8, vampires:2, role:'vampir', iq:.55, rounds:2, objective:{type:'winByDay',n:4}, boss:true },
  // Bölüm 3
  { id:13, ch:3, name:'İki Gölge', players:8, vampires:2, role:'koylu', iq:.5, rounds:3, objective:{type:'win'}, desc:'Artık iki vampir var ve botlar yalan söylemeye başladı.' },
  { id:14, ch:3, name:'Hızlı Kehanet', players:8, vampires:2, role:'kahin', iq:.55, rounds:3, objective:{type:'vampHangedByDay',n:2} },
  { id:15, ch:3, name:'Son Nefes', players:9, vampires:2, role:'doktor', iq:.6, rounds:3, objective:{type:'saves',n:1} },
  { id:16, ch:3, name:'Kan Kardeşi', players:9, vampires:2, role:'vampir', iq:.6, rounds:3, objective:{type:'win'}, desc:'Bir vampir ortağın var. Gece hedefi sen seçersin.' },
  { id:17, ch:3, name:'Zar', players:10, vampires:2, role:'random', iq:.7, rounds:3, objective:{type:'winByDay',n:4} },
  { id:18, ch:3, name:'Kale Düşmesin', players:10, vampires:2, role:'kahin', iq:.75, rounds:3, objective:{type:'noWrongVote'}, boss:true },
  // Bölüm 4
  { id:19, ch:4, name:'Sisli Yol', players:10, vampires:2, role:'koylu', iq:.75, rounds:2, objective:{type:'win'}, desc:'Botlar zeki, tartışma kısa. Her sözün önemli.' },
  { id:20, ch:4, name:'İki Can', players:10, vampires:2, role:'doktor', iq:.8, rounds:2, objective:{type:'saves',n:1} },
  { id:21, ch:4, name:'Görünmez', players:11, vampires:2, role:'vampir', iq:.8, rounds:2, objective:{type:'maxVotes',n:2} },
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
