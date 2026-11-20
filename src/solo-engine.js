import * as SC from './scenes.js';
import * as LN from './lines.js';
import * as RL from './rules.js';
/* =====================================================================
   VAMPİR KÖYLÜ — Tek oyunculu motor (DOM'suz, Node'da test edilebilir)
   ===================================================================== */

export const ROLE_INFO = RL.ROLES;

const ACCUSE_REASONS=[{key:'night',label:'Gece dışarıdaydı'},{key:'quiet',label:'Hiç konuşmuyor'},{key:'pushed',label:'Dün masumu astırdı'},{key:'lie',label:'Lafı tutmuyor'},{key:'gut',label:'İçimden bir ses'}];
const DEFEND_REASONS=[{key:'alibi',label:'Gece benimleydi'},{key:'seer',label:'Kâhin temiz dedi'},{key:'accuser',label:'Suçlayan şüpheli'},{key:'vouch',label:'Ona kefilim'}];
const NEG_POOLS = new Set([LN.ACCUSE, LN.ACCUSE_HERD, LN.SEER_VAMP, LN.COUNTER_SEER, LN.RESPONSE_DOUBT]);
const BOT_NAMES = ['Mehmet','Mustafa','Hasan','Kerem','Burak','Emre','Yusuf','Can','Oğuz','Tolga','Baran','Umut','Ahmet','İsmail','Hüseyin','Osman','Recep','Cemal','Halil','Rıfat','Şükrü','Veli','Yakup','Kadir','Nuri','Ramazan','Bekir','Fikri','Hamdi'];
const AVATARS = ['👨','👴','🧔','👨‍🦱','👨‍🦳','🧑','👨‍🌾','👲','🧓','👱‍♂️','🧔‍♂️','👨‍🦰','🤵','👮‍♂️','🧑‍🌾','👷‍♂️','🕵️‍♂️','🧑‍🦲','👨‍🦲','🧑‍🦱','🧑‍🦳','💂‍♂️','🧙‍♂️','🤠'];

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
    const n=L.players; const extras=L.extras ?? (!!L.free || (L.ch||0)>=4);   // yeni roller: bekçi, deli, ağa, dedikoducu, âşıklar
    this.eventsOn=L.events ?? (!!L.free || (L.ch||0)>=3);                       // köy olayları: sis, fırtına, dolunay, pazar, düğün
    const roles=RL.rolesFor(n,{ vampires:L.vampires, extras });
    const humanRole = L.role==='random' ? r.pick(roles) : L.role;
    if(!roles.includes(humanRole)){ const i=roles.lastIndexOf('koylu'); roles[i>=0?i:roles.length-1]=humanRole; }
    roles.splice(roles.indexOf(humanRole),1);
    const botRoles=r.shuffle(roles);
    const names=r.shuffle(BOT_NAMES).slice(0,n-1), avs=r.shuffle(AVATARS);
    const pkeys=Object.keys(PERSONALITIES);
    const arch=[LN.ARCHETYPES[0], ...r.shuffle(LN.ARCHETYPES.slice(1))];
    this.players=[{ id:'me', name:this.humanName, avatar:'🙋', role:humanRole, alive:true, human:true, cred:1, claimed:null, claims:[], knows:{}, sus:{}, title:'', pitch:1, arch:'player' }];
    botRoles.forEach((role,i)=>{
      const pk = role==='vampir' && r.chance(.5) ? 'yalanci' : (role==='deli' ? 'agresif' : r.pick(pkeys));
      const a=arch[i%arch.length];
      this.players.push({ id:'b'+i, name:names[i], avatar:avs[i%avs.length], role, alive:true, human:false, pers:PERSONALITIES[pk], persKey:pk, cred:1, claimed:null, claims:[], knows:{}, sus:{}, title:a.title, pitch:a.pitch, arch:a.key, mem:{ acc:{} } });
    });
    for(const p of this.players) for(const q of this.players) if(p!==q) p.sus[q.id]=0;
    const vamps=this.players.filter(p=>p.role==='vampir');
    for(const p of vamps) for(const q of vamps) if(p!==q) p.knows[q.id]=true;
    // âşıklar: birbirinin masum olduğunu bilir
    this.lovers=RL.pickLovers(this.players,r,{ extras });
    if(this.lovers){ const [a,b]=this.lovers.map(id=>this.P(id)); a.knows[b.id]=false; b.knows[a.id]=false; a.sus[b.id]=-5; b.sus[a.id]=-5; }
    // botlar arası eski hesaplar: bir küslük, bir kirvelik
    { const bs=r.shuffle(this.players.filter(p=>!p.human&&!p.lover));
      if(bs.length>=4){ const [a,b]=bs; a.feud=b.id; b.feud=a.id; a.sus[b.id]+=0.4; b.sus[a.id]+=0.4; }
      if(bs.length>=6){ const a=bs[2], b=bs[3]; a.buddy=b.id; b.buddy=a.id; a.sus[b.id]-=0.6; b.sus[a.id]-=0.6; } }
    this.day=0; this.phase='roles'; this.feed=[]; this.events=[]; this.round=0;
    this.night=null; this.lastNight=null; this.lastVote=null; this.winner=null;
    this.accused=null; this.selectVotes={}; this.finalVotes={}; this.hangCount=0; this.stakeCount=0;
    this.stats={ wrongVotes:0, votesReceived:0, saves:0, vampHangedDay:null, days:0, humanDiedDay:null, quietRounds:0 };
    this.accusedBy={}; this.defendedBy={}; this.spokeToday=new Set();
    this.clues=[]; this.hist=[]; this.event=null; this.nightEvent=null; this.usedEvents=[]; this.tally=RL.newTally();
    this.dragCount=0; this.execCount=0; this.vampExec=0; this.inspected={}; this.evidence={}; this.gossip=null; this.duel=null; this.pendingClue=null;
    this.ghost={ bet:null, whispered:false, acts:0 };
    this.human=this.players[0];
  }

  /* ---------- yardımcılar ---------- */
  P(id){ return this.players.find(p=>p.id===id); }
  alive(){ return this.players.filter(p=>p.alive); }
  aliveVamps(){ return this.alive().filter(p=>p.role==='vampir'); }
  aliveBots(){ return this.alive().filter(p=>!p.human); }
  ev(e){ e.day=this.day; this.events.push(e); RL.tallyEvent(this.tally,e); }
  say(who, text, kind='talk'){
    const e={ t:'say', day:this.day, who: who?who.id:null, name: who?who.name:'Anlatıcı', title: who?.title||'', avatar: who?who.avatar:'🌙', pitch: who?.pitch||1, arch: who?.arch||null, text, voice:LN.spokenFor(text), kind };
    this.feed.push(e); this.events.push(e);
  }
  narr(text){ const e={ t:'narr', day:this.day, who:null, name:'Anlatıcı', avatar:'🌙', text, voice:LN.spokenFor(text), kind:'narr' }; this.feed.push(e); this.events.push(e); }
  sfx(name){ this.ev({t:'sfx', name}); }
  pk(arr){ return LN.pick(arr, this.rng); }
  _io(){ return { say:(p,t,k)=>this.say(p,t,k), narr:(t)=>this.narr(t), sfx:(n)=>this.sfx(n), ev:(e)=>this.ev(e), rnd:this.rng }; }
  line(arr, m){ return LN.fillT(this.pk(arr), m||{}, NEG_POOLS.has(arr)); }
  /** Köy görseli için kalıcı durum */
  villageState(){ const s={}; const hanged=this.players.filter(p=>p.fate==='hanged').sort((a,b)=>a.hangOrder-b.hangOrder); const lastHanged=hanged.slice(-3);
    for(const p of this.players){ if(p.fate==='impaled') s[p.id]={impaled:true, stakeK:p.stakeK, ash:!!p.ash}; else if(p.fate==='hanged' && lastHanged.includes(p)) s[p.id]={hanged:true, hangK:lastHanged.indexOf(p)}; else if(!p.alive) s[p.id]={dead:true}; }
    return s; }
  speaker(exclude=[]){ const c=this.aliveBots().filter(p=>!exclude.includes(p)); return c.length?this.rng.pick(c):null; }
  muhtar(){ return this.aliveBots().find(p=>p.title==='Muhtar') || this.speaker(); }

  /* ================= AÇILIŞ ================= */
  ackRole(){
    if(this.phase!=='roles') return;
    this.day=0;
    this.ev({t:'gather'}); this.sfx('bell');
    const bots=this.aliveBots();
    const script = this.longIntro ? LN.OPENING : LN.OPENING_SHORT;
    for(const s of script){ const who=bots[s.who % bots.length]; if(s.sfx) this.sfx(s.sfx); this.say(who, LN.fillT(LN.pick([s.text],this.rng),{})); }
    // önce ilk gece: kimse ölmez, sabaha ipuçları çıkar
    this.toNight(true);
  }

  /* ================= GECE ================= */
  toNight(first=false){
    this.phase='night'; this.firstNight=!!first;
    this.nightEvent=(!first && (this.event==='firtina'||this.event==='dolunay'))?this.event:null;
    this.night={ bite:[], plant:null, doctor:null, seer:null, guard:null, watch:{} };
    this.ghost.acts=0;
    this.ev({t:'home'}); this.ev({t:'night', on:true}); this.sfx('howl');
    this.narr(this.line(LN.NIGHT_INTRO));
    const h=this.human, al=this.alive(), steps=[];
    if(h.alive){
      const others=al.filter(p=>p!==h).map(p=>p.id);
      if(h.role==='vampir'){ const c=al.filter(p=>p.role!=='vampir').map(p=>p.id);
        if(!first){ steps.push({ type:'vamp', cands:c }); if(this.nightEvent==='dolunay' && RL.canDoubleBite(this.players)) steps.push({ type:'vamp', cands:c, second:true, optional:true }); }
        steps.push({ type:'plant', cands:c, optional:true }); }
      else if(h.role==='doktor'){ if(!first) steps.push({ type:'doktor', cands:al.map(p=>p.id) }); else steps.push({ type:'watch', cands:others, optional:true }); }
      else if(h.role==='kahin'){ const c=others.filter(id=>h.knows[id]===undefined); if(c.length) steps.push({ type:'kahin', cands:c }); }
      else if(h.role==='bekci') steps.push({ type:'bekci', cands:others });
      else steps.push({ type:'watch', cands:others, optional:true });
    }
    this.nightSteps=steps; this._nextNightStep();
  }
  _nextNightStep(){
    const s=this.nightSteps.shift(); if(!s){ this.needs=null; this._resolveNight(); return; }
    if(s.second||s.type==='plant') s.cands=s.cands.filter(id=>!this.night.bite.includes(id));
    if(!s.cands.length) return this._nextNightStep();
    this.needs=s;
  }
  /** gece seçimi; targetId=null → (isteğe bağlı adımı) geç */
  nightAction(targetId){
    if(this.phase!=='night'||!this.needs) return; const n=this.needs, h=this.human;
    if(targetId==null){ if(!n.optional) return; }
    else { if(!n.cands.includes(targetId)) return;
      switch(n.type){
        case 'vamp': this.night.bite.push(targetId); break;
        case 'plant': this.night.plant=targetId; break;
        case 'doktor': this.night.doctor=targetId; break;
        case 'kahin': { const t=this.P(targetId); this.night.seer=targetId; h.knows[targetId]=t.role==='vampir'; break; }
        case 'bekci': this.night.guard=targetId; break;
        case 'watch': this.night.watch[h.id]=targetId; break;
      } }
    this._nextNightStep();
  }
  _botNight(){
    const r=this.rng, iq=this.iq, al=this.alive(), N=this.night, h=this.human;
    const vamps=this.aliveVamps().filter(p=>!p.human); const humanVamp=h.alive&&h.role==='vampir';
    const inno=al.filter(p=>p.role!=='vampir');
    const pickBite=(ex)=>{ let cands=inno.filter(p=>!ex.includes(p.id)); if(this.day===1 && cands.length>1) cands=cands.filter(p=>!p.human); // ilk ölümlü gece insan hedef alınmaz
      if(!cands.length) return null;
      const seerClaim=cands.find(p=>p.claimed==='kahin'), bekClaim=cands.find(p=>p.claimed==='bekci'), docClaim=cands.find(p=>p.claimed==='doktor');
      if(seerClaim && r.chance(.6+iq*.35)) return seerClaim; if(bekClaim && r.chance(.4+iq*.4)) return bekClaim; if(docClaim && r.chance(.3+iq*.4)) return docClaim;
      let best=null,bs=-1e9; for(const c of cands){ let s=(c.accusedVampCount||0)*2+(c.accuseCount||0)*1.2; for(const v of vamps) s+=(c.human?this._humanThreat():(c.sus[v.id]||0))*0.5; s+=r()*(0.6+(1-iq)*1.5); if(s>bs){bs=s;best=c;} }
      return best; };
    if(vamps.length && !humanVamp){
      if(!this.firstNight){ const t=pickBite([]); if(t){ N.bite.push(t.id); if(this.nightEvent==='dolunay' && RL.canDoubleBite(this.players)){ const t2=pickBite([t.id]); if(t2) N.bite.push(t2.id); } } }
      // sahte iz: kendilerini suçlayana ya da rastgele bir masumun kapısına
      if(r.chance(0.3+iq*0.45)){ const c=inno.filter(p=>!N.bite.includes(p.id)); if(c.length){ const t=[...c].sort((a,b)=>(b.accusedVampCount||0)-(a.accusedVampCount||0))[0]; N.plant=(t.accusedVampCount&&r.chance(.6))?t.id:r.pick(c).id; } }
    }
    const doc=al.find(p=>p.role==='doktor'&&!p.human);
    if(doc && !this.firstNight){
      const seerClaim=al.find(p=>p.claimed==='kahin' && p!==doc); let t;
      if(seerClaim && r.chance(.4+iq*.5)) t=seerClaim;
      else if(r.chance(.35)) t=doc;
      else { const others=al.filter(p=>p!==doc); let best=others[0],bs=-1e9; for(const c of others){ const s=-(doc.sus[c.id]||0)+(c.accuseCount||0)*0.6*iq+r()*2; if(s>bs){bs=s;best=c;} } t=best; }
      N.doctor=t.id;
    }
    const seer=al.find(p=>p.role==='kahin'&&!p.human);
    if(seer){
      const unknown=al.filter(p=>p!==seer && seer.knows[p.id]===undefined);
      if(unknown.length){
        let t; if(r.chance(iq)){ let best=unknown[0],bs=-1e9; for(const c of unknown){ const s=(seer.sus[c.id]||0)+r(); if(s>bs){bs=s;best=c;} } t=best; } else t=r.pick(unknown);
        seer.knows[t.id]=(t.role==='vampir'); N.seer=N.seer||t.id;
        if(t.role==='vampir') seer.sus[t.id]+=100; else seer.sus[t.id]-=100;
      }
    }
    const bek=al.find(p=>p.role==='bekci'&&!p.human);
    if(bek){ const c=al.filter(p=>p!==bek && (bek.guardKnows||{})[p.id]===undefined); if(c.length){ let best=c[0],bs=-1e9; for(const x of c){ const s=(bek.sus[x.id]||0)+r()*(1.6-iq); if(s>bs){bs=s;best=x;} } N.guard=best.id; } }
    // gece işi olmayanların yarısı pencereden en şüphelendiği evi gözetler
    for(const b of al){ if(b.human||['vampir','kahin','bekci'].includes(b.role)) continue; if(b.role==='doktor'&&!this.firstNight) continue; if(!r.chance(0.3)) continue;
      const c=al.filter(p=>p!==b); if(!c.length) continue; let best=c[0],bs=-1e9; for(const x of c){ const s=(b.sus[x.id]||0)+r()*1.5; if(s>bs){bs=s;best=x;} } N.watch[b.id]=best.id; }
  }
  _humanThreat(){ const h=this.human; let s=0; if(h.claimed==='kahin') s+=3; if(h.claimed==='bekci') s+=2.5; if(h.claimed==='doktor') s+=2; return s; }
  _resolveNight(){
    this._botNight();
    const N=this.night, h=this.human, r=this.rng;
    const res=RL.resolveNight({ players:this.players, bite:N.bite, plant:N.plant, protect:N.doctor, seer:N.seer, guard:N.guard, watch:N.watch, first:this.firstNight, event:this.nightEvent, rnd:r });
    const dead=[];
    for(const id of res.killed){ const v=this.P(id); v.alive=false; v.fate='killed'; dead.push(v); }
    for(const id of res.grief){ const v=this.P(id); v.alive=false; v.fate='grief'; dead.push(v); }
    for(const v of dead) if(v.human) this.stats.humanDiedDay=this.day;
    const saved=res.saved.length>0;
    if(saved && h.role==='doktor' && h.alive) this.stats.saves+=res.saved.length;
    if(saved){ const d=this.alive().find(p=>p.role==='doktor'); if(d&&!d.human) d.savedSomeone=res.saved[0]; }
    // botların gece öğrendikleri
    const bek=this.alive().find(p=>p.role==='bekci'&&!p.human);
    if(bek && res.guardRes && res.guardRes.out!==null){ const g=res.guardRes; (bek.guardKnows ||= {})[g.target]=g.out; bek.sus[g.target]+=g.out?3:-1.5; bek.guardNews={ target:g.target, out:g.out }; }
    for(const [pid,w] of Object.entries(res.watchRes)){ const b=this.P(pid); if(!b||b.human||!b.alive) continue; if(w.saw==='out'){ b.sus[w.target]+=2.5; b.sawOut=w.target; } else b.sus[w.target]-=0.3; }
    const k0=res.killed[0]?this.P(res.killed[0]):null;
    this.lastNight={ killed:k0?k0.id:null, killedName:k0?k0.name:null, killedRole:k0?k0.role:null, dead:dead.map(v=>v.id), saved, first:this.firstNight,
      seer: h.role==='kahin' && h.alive && N.seer && h.knows[N.seer]!==undefined ? { target:N.seer, isVamp:h.knows[N.seer] } : null,
      guard: h.role==='bekci' && h.alive ? res.guardRes : null,
      watch: h.alive ? (res.watchRes[h.id]||null) : null, gossip:null, wentOut: h.role==='vampir' && h.alive ? res.vOut.includes(h.id) : null };
    if(h.alive){ const g=this.lastNight.guard; if(g && g.out!==null){ this.evidence[g.target]=g.out?'out':'home'; (h.guardLog ||= []).push({ target:g.target, out:g.out }); }
      const w=this.lastNight.watch; if(w && w.saw==='out') this.evidence[w.target]='out'; }
    for(const v of dead) if(v.claimed==='kahin'){ for(const c of v.claims) this._applyClaim(v, this.P(c.target), c.isVamp, 1.5, true); }
    // sabah
    const carry=this.clues.filter(c=>c.kind==='dugun');
    this.day++; this.stats.days=this.day;
    this.ev({t:'night', on:false}); this.sfx('bell');
    const m=this.muhtar(); const tell=(txt)=>{ if(m) this.say(m,txt); else this.narr(txt); };
    if(this.firstNight){ this.ev({t:'chicken'}); tell(this.line(LN.DAWN_CHICKEN)); }
    else if(res.killed.length){ for(const id of res.killed){ const v=this.P(id); this.ev({t:'dead', who:v.id}); tell(this.line(LN.DAWN_DEAD,{v:v.name})); this.narr(LN.revealLine(v.name,RL.ROLES[v.role].reveal)); } }
    else tell(this.line(saved?LN.DAWN_SAVED:LN.DAWN_NONE));
    for(const id of res.grief){ const v=this.P(id); this.ev({t:'dead', who:v.id}); this.narr(this.line(LN.LOVER_DEATH,{v:v.name})); this.narr(LN.revealLine(v.name,RL.ROLES[v.role].reveal)); }
    this.phase='dawn'; this.needs=null;
    const H={ day:this.day, event:null, clues:[], killed:res.killed.slice(), grief:res.grief.slice(), saved, first:this.firstNight };
    this.hist.push(H);
    this.clues=[]; this.event=null; this.gossip=null; this.inspected={};
    if(this._checkWin()) return;
    // köy olayı
    this.event=RL.rollEvent({ day:this.day, used:this.usedEvents, aliveN:this.alive().length, nightEvent:this.nightEvent, rnd:r, enabled:this.eventsOn });
    if(this.event){ this.usedEvents.push(this.event); H.event=this.event; this.ev({ t:'event', k:this.event }); tell(this.pk(LN.EVENT[this.event])); }
    // ipuçları
    const watchers=Object.keys(N.watch).filter(id=>N.watch[id]);
    this.clues=RL.makeClues({ players:this.players, vOut:res.vOut, plant:res.plant, watchers, dayEvent:this.event, nightEvent:this.nightEvent, first:this.firstNight, day:this.day, rnd:r });
    if(this.pendingClue){ this.clues.push(this.pendingClue); this.pendingClue=null; }
    this._announceClues(this.clues, tell);
    if(!this.clues.length && this.event!=='sis') tell(this.pk(LN.CLUE_NONE));
    for(const c of carry) if(c.ids.filter(id=>this.P(id).alive).length>=2) this.clues.push(c);
    H.clues=this.clues.map(c=>({ ...c }));
    // dedikodu
    const ded=this.alive().find(p=>p.role==='dedikoducu');
    if(ded){ const g=RL.gossipFor({ players:this.players, outs:res.outs, self:ded.id, rnd:r }); if(g){ this.gossip={ for:ded.id, ids:g.ids, said:false }; if(ded.human) this.lastNight.gossip=g.ids; } }
  }
  _announceClues(list, tell){ for(const c of list){ const txt=LN.clueLine(c.kind, c.ids.map(id=>this.P(id).name)); const who=c.to&&this.P(c.to)?.alive?this.P(c.to):null;
    this.ev({ t:'clue', id:c.id, kind:c.kind, ids:c.ids }); if(who) this.say(who,txt); else tell(txt); } }
  /** ipucunu incele (günde 1, pazar günü 2) → 'fresh' | 'fake' */
  inspect(clueId){ const h=this.human; if(!h.alive||!['dawn','talk'].includes(this.phase)) return null; const c=this.clues.find(x=>x.id===clueId); if(!c||this.inspected[clueId]||!this.inspectLeft()) return null;
    return (this.inspected[clueId]=RL.inspectClue(c,this.rng,h.role==='kahin'?0.85:0.75)); }
  inspectLeft(){ return Math.max(0,(this.event==='pazar'?2:1)-Object.keys(this.inspected).length); }
  /** botlar ipuçlarına bakar: birini inceler, şüphelerini ona göre kaydırır */
  _botsClues(){ const r=this.rng; if(!this.clues.length) return;
    for(const b of this.aliveBots()){ if(b.role==='vampir') continue;
      const ins=r.pick(this.clues); const res=RL.inspectClue(ins,r,0.6+this.iq*0.25);
      for(const c of this.clues){ const w=c.sure?1.6:(c===ins?(res==='fresh'?0.85:0.12):0.4); for(const id of c.ids){ if(id===b.id||b.knows[id]!==undefined) continue; b.sus[id]+=w*0.32*(0.5+b.pers.logic*0.6); } } }
    if(r.chance(.5)){ const b=this.speaker(); if(b) this.say(b,this.pk(LN.CLUE_TALK),'flavor'); } }

  /* ================= GÜNDÜZ: TARTIŞMA ================= */
  startTalk(){
    if(this.phase!=='dawn') return;
    this.phase='talk'; this.round=1; this.roundsToday=(this.alive().length<=4?1:this.maxRounds)+(this.event==='pazar'?1:0);
    this.accusedBy={}; this.defendedBy={}; this.spokeToday=new Set(); this.ghost.acts=0;
    this.ev({t:'gather'}); this.sfx('murmur');
    this._botsClues();
    if(this.lastNight.killed && this.rng.chance(.6)){ const b=this.speaker(); if(b) this.say(b, this.line(LN.AFTER_KILL,{v:this.lastNight.killedName}), 'flavor'); }
    this._botsSpeak();
    if(this.human.alive){ this.needs={ type:'talk' }; return; }
    // hayalet: gün kendi kendine akar, hükümde durur
    this.needs=null; let g=0; while(this.phase==='talk' && g++<12){ this.round++; if(this.round>this.roundsToday) this._toSelect(); else this._botsSpeak(); }
  }
  humanOptions(){
    const h=this.human, al=this.alive().filter(p=>p!==h);
    const opts=[];
    const accR=this.clues.length?[ACCUSE_REASONS[0],{key:'clue',label:'İpucu onu gösteriyor'},...ACCUSE_REASONS.slice(1)]:ACCUSE_REASONS;
    opts.push({ type:'accuse', label:'Suçla', targets:al.map(p=>p.id), reasons:accR });
    opts.push({ type:'defend', label:'Savun', targets:al.map(p=>p.id), reasons:DEFEND_REASONS });
    opts.push({ type:'press', label:'Sıkıştır', targets:al.map(p=>p.id) });
    if(!this.allyOf) opts.push({ type:'ally', label:'İttifak öner', targets:al.map(p=>p.id) });
    opts.push({ type:'calm', label:'Ortamı yatıştır' });
    opts.push({ type:'oath', label:'Yemin et' });
    if(h.role==='kahin'){ const known=Object.entries(h.knows).filter(([id])=>this.P(id).alive).map(([id,isVamp])=>({target:id,isVamp})); if(known.length) opts.push({ type:'claimSeer', label:'Kâhin olduğunu açıkla', results:known }); }
    else if(h.claimed!=='kahin') opts.push({ type:'claimSeer', label:'Kâhinim de (yalan)', results: al.map(p=>({target:p.id,isVamp:true})).concat(al.map(p=>({target:p.id,isVamp:false}))) });
    if(h.claimed!=='doktor') opts.push({ type:'claimDoctor', label: h.role==='doktor'?'Hoca olduğunu açıkla':'Hocayım de (yalan)' });
    if(h.role==='bekci'){ const res=(h.guardLog||[]).filter(x=>this.P(x.target).alive); if(res.length) opts.push({ type:'claimBekci', label:'Bekçi olduğunu açıkla', results:res }); }
    if(h.role==='dedikoducu' && this.gossip && this.gossip.for===h.id && !this.gossip.said) opts.push({ type:'gossip', label:'Dedikoduyu yay' });
    opts.push({ type:'quiet', label:'Sessiz kal' });
    return opts;
  }
  talkAction(a){
    if(this.phase!=='talk'||this.needs?.type==='answer') return;
    const h=this.human;
    switch(a.type){
      case 'accuse': { const t=this.P(a.target); if(!t||!t.alive||t===h) return;
        if(!a.reason){ this.say(h, LN.regSpoken(`${t.name} vampir olabilir la. Ona oy vereceğim.`,'Bu herif vampir olabilir la. Ona oy vereceğim.')); this._accuse(h,t); this._stance(t,1); break; }
        const rs=LN.ACCUSE_WHY[a.reason]?a.reason:'gut'; const {pow,truth}=this._reasonPower('accuse',rs,h,t);
        this.say(h, LN.fillT(this.pk(LN.ACCUSE_WHY[rs]),{t:t.name})); this._accuse(h,t,pow); this._reactions(h,t,1,truth); this._stance(t,1); if(this._askBack(h,t)) return; break; }
      case 'defend': { const t=this.P(a.target); if(!t||!t.alive||t===h) return;
        if(!a.reason){ this.say(h, LN.regSpoken(`${t.name} masum, ona kefilim.`,'Bu adam masum, ona kefilim.')); this._defend(h,t); this._stance(t,-1); break; }
        const rs=LN.DEFEND_WHY[a.reason]?a.reason:'vouch'; const {pow,truth}=this._reasonPower('defend',rs,h,t);
        this.say(h, LN.fillT(this.pk(LN.DEFEND_WHY[rs]),{t:t.name})); this._defend(h,t,pow);
        if(rs==='accuser'){ for(const id of (this.accusedBy[t.id]||[])){ const x=this.P(id); if(x&&x.alive&&x!==h) for(const b of this._others(h)) if(b!==x) b.sus[x.id]+=0.4*h.cred*b.pers.logic; } }
        if(rs==='vouch') (this.vouches||=[]).push(t.id);
        this._reactions(h,t,-1,truth); this._stance(t,-1); break; }
      case 'press': { const t=this.P(a.target); if(!t||!t.alive||t===h) return; this.say(h, LN.fillT(this.pk(LN.PRESS.ask),{y:t.name})); this._press(h,t); this._stance(t,1); break; }
      case 'ally': { const t=this.P(a.target); if(!t||!t.alive||t===h) return; this.say(h, LN.fillT(this.pk(LN.ALLY.ask),{y:t.name}));
        const ok=(t.sus[h.id]||0)<0.6 && (t.role==='vampir' ? (h.role==='vampir' || this.rng.chance(0.7)) : this.rng.chance(0.75-(t.sus[h.id]||0)*0.4));
        if(ok){ this.say(t,this.pk(LN.ALLY.yes)); this.allyOf=t.id; t.ally=h.id; t.sus[h.id]-=1.2; } else { this.say(t,this.pk(LN.ALLY.no)); for(const b of this._others(h)) if(b!==t) b.sus[h.id]+=0.15*b.pers.logic; }
        break; }
      case 'calm': { this.say(h, this.pk(LN.CALM)); this.calmUntil=this.round+1; h.cred=Math.min(1.6,h.cred+0.05); for(const b of this._others(h)) b.sus[h.id]-=0.12; break; }
      case 'oath': { this.say(h, this.pk(LN.OATH)); this.oaths=(this.oaths||0)+1; const w=0.35/this.oaths; for(const b of this._others(h)) b.sus[h.id]-=w*(1-b.pers.logic*0.5); break; }
      case 'claimSeer': { const t=this.P(a.target); if(!t||!t.alive) return; const isVamp=!!a.isVamp;
        if(h.role==='kahin' && h.knows[a.target]!==isVamp) return;
        this.say(h, isVamp?LN.regSpoken(`Ben kâhinim la! Dün gece ${LN.suf(t.name,'e')} baktım: VAMPİR!`,'Ben kâhinim la! Dün gece bu herife baktım: VAMPİR!'):LN.regSpoken(`Ben kâhinim. ${t.name} temiz, ona oy vermeyin.`,'Ben kâhinim. Bu adam temiz, ona oy vermeyin.'));
        this._claimSeer(h,t,isVamp); break; }
      case 'claimDoctor': { this.say(h, this.pk(this.lastNight?.saved?LN.HOCA_SAVED:LN.HOCA_PLAIN)); this._claimDoctor(h); break; }
      case 'claimBekci': { const t=this.P(a.target); const x=(h.guardLog||[]).find(g=>g.target===a.target); if(!t||!t.alive||!x||h.role!=='bekci') return;
        this.say(h, LN.fillT(this.pk(x.out?LN.BEKCI_SAW:LN.BEKCI_HOME),{t:t.name},x.out)); this._claimBekci(h,t,x.out); break; }
      case 'gossip': { const g=this.gossip; if(!g||g.for!==h.id||g.said) return; this._gossip(h); break; }
      default: { this.stats.quietRounds++; this.say(h,'…','quiet'); }
    }
    this.spokeToday.add(h.id);
    this._endHumanTurn();
  }
  _endHumanTurn(){
    this.round++;
    if(this.round>this.roundsToday){ this._toSelect(); return; }
    this._botsSpeak();
  }
  /** gerekçenin gücü: doğrulanabilir mi, doğru mu */
  _reasonPower(kind,rs,h,t){
    let truth=null, pow=1;
    if(kind==='accuse'){
      if(rs==='quiet'){ truth=!this.spokeToday.has(t.id); pow=truth?1.3:0.35; }
      else if(rs==='pushed'){ const lv=this.lastVote; truth=!!(lv&&lv.hanged&&lv.role!=='vampir'&&((this.prevAccusers||[]).includes(t.id)||lv.votes?.[t.id])); pow=truth?1.5:0.4; }
      else if(rs==='lie'){ const seers=this.alive().filter(p=>p.claimed==='kahin'); truth=!!(t.claimed && (t.claimed==='kahin'?seers.length>1:this.alive().filter(p=>p.claimed===t.claimed).length>1)); pow=truth?1.5:0.45; }
      else if(rs==='night'){ if(this.evidence[t.id]==='out'){ truth=true; pow=1.5; } else pow=0.9*h.cred; }
      else if(rs==='clue'){ truth=this.clues.some(c=>c.ids.includes(t.id)); pow=truth?1.3:0.4; }
      else pow=0.6;
    } else {
      if(rs==='seer'){ truth=this.alive().some(p=>p.claimed==='kahin'&&p.claims.some(c=>c.target===t.id&&!c.isVamp)); pow=truth?1.5:0.4; }
      else if(rs==='alibi') pow=1.0*h.cred; else if(rs==='accuser') pow=0.7; else pow=0.85;
    }
    return { pow, truth };
  }
  /** kalabalığın tepkisi: katılan / itiraz eden */
  _reactions(h,t,sign,truth){
    const r=this.rng; const bots=r.shuffle(this.aliveBots().filter(b=>b!==t)).slice(0,r.chance(.5)?2:1);
    for(const b of bots){ const s=(b.sus[t.id]||0)*sign; const agree=truth===false?false:(truth===true?s>-0.6:s>0.2);
      this.say(b, this.pk(agree?LN.AGREE:LN.OBJECT));
      for(const o of this._others(b)) if(o!==t&&o!==h) o.sus[t.id]+=(agree?0.12:-0.12)*sign*b.cred*o.pers.herd; }
  }
  /** suçlananın gözündeki şüphe: biri sana soru sorar (cevap beklenir) */
  _askBack(h,t){
    const r=this.rng; if(!h.alive||!r.chance(0.35)) return false;
    const asker=(t.human?null:t)||this.speaker([h]); if(!asker) return false;
    this.say(asker, this.pk(LN.ASK_YOU)); this.needs={ type:'answer', who:asker.id, options:LN.YOU_ANSWER.map(o=>({ key:o.key, label:o.label })) }; this.spokeToday.add(h.id); return true;
  }
  answer(key){ if(this.phase!=='talk'||this.needs?.type!=='answer') return; const h=this.human; const o=LN.YOU_ANSWER.find(x=>x.key===key)||LN.YOU_ANSWER[0];
    this.say(h,o.text); for(const b of this._others(h)) b.sus[h.id]+=(o.v>0?-0.3:o.v<0?0.35:0)*(0.6+b.pers.logic*0.5); this.needs={ type:'talk' }; this._endHumanTurn(); }
  /** sıkıştırma: vampir çelişkiye düşebilir */
  _press(h,t){ const r=this.rng; let kind;
    if(t.human) kind='good'; else if(t.role==='vampir') kind=r.chance(0.35+this.iq*0.45)?'good':(r.chance(.6)?'bad':'angry'); else kind=r.chance(.8)?'good':'angry';
    this.say(t, this.pk(LN.PRESS[kind]));
    for(const b of this._others(t)) if(b!==h){ const d=kind==='bad'?0.9:kind==='angry'?0.25:-0.3; b.sus[t.id]+=d*(0.5+b.pers.logic*0.6); }
    if(kind==='bad'){ const w=this.speaker([t,h]); if(w) this.say(w, LN.fillT(this.pk(LN.ACCUSE_WHY.lie),{t:t.name})); } }
  /** başlar üstünde ikna göstergesi: 👍 katılıyor 🤔 kararsız 👎 karşı */
  _stance(t,sign){ const marks={}; for(const b of this.aliveBots()){ if(b===t) continue; const s=(b.sus[t.id]||0)*sign; marks[b.id]=s>0.7?'👍':s<-0.25?'👎':'🤔'; } this.ev({ t:'stance', marks }); }

  /* ---------- şüphe modeli ---------- */
  _others(x){ return this.alive().filter(p=>p!==x && !p.human); }
  _knowsTruth(b,t){ return b.knows[t.id]!==undefined || b.role==='vampir'; }
  _accuse(s,t,pow=1){
    (this.accusedBy[t.id] ||= []).push(s.id);
    RL.tallyAccuse(this.tally,s.id,t.id);
    if(t.mem){ const d=(t.mem.acc[s.id] ||= []); if(!d.includes(this.day)) d.push(this.day); }
    s.accuseCount=(s.accuseCount||0)+1;
    if(t.role==='vampir') s.accusedVampCount=(s.accusedVampCount||0)+1;
    for(const b of this._others(s)){
      if(b===t){ b.sus[s.id]+=1.2; continue; }
      if(this._knowsTruth(b,t)){ if(b.role!=='vampir' && b.knows[t.id]===false) b.sus[s.id]+=0.8*b.pers.logic; continue; }
      b.sus[t.id]+= 1.0*pow*s.cred*(0.5+b.pers.herd*0.8)*(this.calmUntil===this.round?0.6:1);
      b.sus[s.id]+= 0.12*b.pers.logic*(pow<0.6?2.2:1);
    }
  }
  _defend(s,t,pow=1){
    (this.defendedBy[t.id] ||= []).push(s.id); RL.tallyDefend(this.tally,s.id,t.id);
    for(const b of this._others(s)){
      if(b===t){ b.sus[s.id]-=0.6; continue; }
      if(this._knowsTruth(b,t)){ if(b.knows[t.id]===true && b.role!=='vampir') b.sus[s.id]+=1.5*b.pers.logic; continue; }
      b.sus[t.id]-= 0.6*pow*s.cred;
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
  /** bekçi açıklaması: "gece çıktı" şüphe doğurur, "evdeydi" aklar */
  _claimBekci(s,t,out){ s.claimed='bekci'; for(const b of this._others(s)){ if(b===t){ b.sus[s.id]+=out?1.5:-0.6; continue; } if(b.role==='bekci'){ b.sus[s.id]+=3; continue; } if(b.role==='vampir') continue; const w=1.8*s.cred; b.sus[t.id]+=out?w:-w*0.6; } }
  /** dedikoducu: iki kişiden biri gece dışarıdaydı */
  _gossip(s){ const g=this.gossip; g.said=true; const [t,o]=g.ids.map(id=>this.P(id)); this.say(s, LN.fillT(this.pk(LN.GOSSIP),{t:t.name,o:o.name}));
    for(const b of this._others(s)){ if(b.role==='vampir') continue; for(const x of [t,o]) if(x!==b && x.alive && b.knows[x.id]===undefined) b.sus[x.id]+=0.45*s.cred; } }
  _claimDoctor(s){ s.claimed='doktor'; for(const b of this._others(s)){ if(b.role==='doktor'){ b.sus[s.id]+=3; continue; } if(b.role==='vampir') continue; b.sus[s.id]-=(this.lastNight?.saved?1.5:0.6)*s.cred; } }
  _botAccuseLine(b,t){ const r=this.rng; let rs=null;
    if(b.feud===t.id && r.chance(.6)) return LN.fillT(this.pk(LN.FEUD),{t:t.name},true);
    if(this.clues.some(c=>c.ids.includes(t.id)) && r.chance(.5)) rs='clue'; else if(!this.spokeToday.has(t.id) && r.chance(.45)) rs='quiet'; else if((this.prevAccusers||[]).includes(t.id) && r.chance(.6)) rs='pushed'; else if(r.chance(.3)) rs=r.chance(.5)?'night':'gut';
    return rs ? LN.fillT(this.pk(LN.ACCUSE_WHY[rs]),{t:t.name}) : this.line(LN.ACCUSE,{t:t.name}); }
  _botsSpeak(){
    const r=this.rng, iq=this.iq;
    const bots=r.shuffle(this.aliveBots());
    let spoken=0;
    for(const b of bots){
      if(spoken>=4) break;
      if(!r.chance(b.pers.talk*0.75+0.2)) continue;
      spoken++; this.spokeToday.add(b.id);
      if(b.arch==='kufurbaz' && r.chance(.45)) this.say(b,this.pk(LN.KUFURBAZ));
      const others=this.alive().filter(p=>p!==b);
      // hafıza: günlerdir kendisini suçlayana çıkış
      { const again=Object.entries(b.mem?.acc||{}).find(([id,days])=>days.length>=2 && days.includes(this.day) && this.P(id).alive && b.mem.said!==id+':'+this.day);
        if(again && r.chance(.7)){ const x=this.P(again[0]); b.mem.said=again[0]+':'+this.day; this.say(b, LN.fillT(this.pk(LN.MEMORY.again),{y:x.name})); this._accuse(b,x,0.8); continue; } }
      if(b.role==='deli' && r.chance(.3)){ this.say(b,this.pk(LN.DELI_TALK)); for(const o of this._others(b)) o.sus[b.id]+=0.18*(1-o.pers.logic*0.6); continue; }
      if(b.role==='dedikoducu' && this.gossip && this.gossip.for===b.id && !this.gossip.said){ this._gossip(b); continue; }
      if(b.role==='bekci' && b.guardNews){ const g=b.guardNews; const t=this.P(g.target);
        if(t.alive && (g.out ? r.chance(.75) : ((this.accusedBy[t.id]||[]).length>0 && r.chance(.7)))){ b.guardNews=null; this.say(b, LN.fillT(this.pk(g.out?LN.BEKCI_SAW:LN.BEKCI_HOME),{t:t.name},g.out)); this._claimBekci(b,t,g.out); continue; } }
      if(b.sawOut){ const t=this.P(b.sawOut); b.sawOut=null; if(t.alive && b.role!=='vampir'){ this.say(b, LN.fillT(this.pk(LN.ACCUSE_WHY.night),{t:t.name})); this._accuse(b,t,1.2); continue; } }
      if(b.lover){ const l=this.P(b.lover); if(l.alive && (this.accusedBy[l.id]||[]).length && b.loverSaid!==this.day && r.chance(.8)){ b.loverSaid=this.day; this.say(b, LN.fillT(this.pk(LN.LOVER_DEFEND),{t:l.name})); this._defend(b,l,1.1); continue; } }
      if(b.buddy && b.role!=='vampir'){ const l=this.P(b.buddy); if(l.alive && (this.accusedBy[l.id]||[]).length && b.buddySaid!==this.day && r.chance(.5)){ b.buddySaid=this.day; this.say(b, LN.fillT(this.pk(LN.BUDDY),{t:l.name})); this._defend(b,l,0.9); continue; } }
      if(b.role!=='vampir' && this.vampFriends?.length && r.chance(.4)){ const d=this.P(this.vampFriends.shift()); if(d && d.alive && d!==b){ this.say(b, LN.fillT(this.pk(LN.MEMORY.friend),{t:d.name},true)); this._accuse(b,d,1.2); continue; } }
      if(b.role==='vampir'){
        const seerClaim=others.find(p=>p.claimed==='kahin' && p.claims.some(c=>this.P(c.target).role==='vampir' && this.P(c.target).alive));
        const vampClaimed=this.players.some(p=>p.role==='vampir'&&p.claimed==='kahin');
        if(seerClaim && !vampClaimed && r.chance(iq*0.8)){ this.say(b, this.line(LN.COUNTER_SEER,{t:seerClaim.name})); this._claimSeer(b,seerClaim,true); continue; }
        // sahte izi köye yedirmeye çalışır
        { const fc=this.clues.find(c=>!c.real); const fl=fc?fc.ids.map(id=>this.P(id)).filter(p=>p.alive&&p.role!=='vampir'&&p!==b):[];
          if(fl.length && r.chance(0.35+iq*0.4)){ const fk=r.pick(fl); this.say(b, LN.fillT(this.pk(LN.ACCUSE_WHY.clue),{t:fk.name})); this._accuse(b,fk,1.2); continue; } }
        const cands=others.filter(p=>p.role!=='vampir'); const t=this._crowdSuspect(cands,b)||r.pick(cands);
        if(r.chance(0.35+iq*0.4)){ this.say(b, this._botAccuseLine(b,t)); this._accuse(b,t); } else this.say(b, this.line(LN.QUIET),'quiet');
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
      if(topS>0.6 && r.chance(b.pers.aggr*0.8+0.1)){ this.say(b, this._botAccuseLine(b,top)); this._accuse(b,top); continue; }
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
    if(this.event==='dugun') return this._wedding();
    this.phase='select'; this.selectVotes={}; this.duel=null;
    const m=this.muhtar(); const t=this.line(LN.SELECT_INTRO); if(m) this.say(m,t); else this.narr(t);
    this.ev({t:'disperse'});
    if(this.human.alive) this.needs={ type:'select', cands:this.alive().filter(p=>!p.human).map(p=>p.id) };
    else { this.needs=null; this.selectHouse(null); }
  }
  /** düğün günü: kimse asılmaz, halay çekilir; halaydan kaybolan için ek ipucu */
  _wedding(){
    SC.weddingScene(this._io(),{ alive:this.alive() });
    const c=RL.groupClue({ players:this.players, kind:'dugun', id:`w${this.day}`, rnd:this.rng });
    if(c){ this.clues.push(c); const m=this.muhtar(); this._announceClues([c],(t)=>{ if(m) this.say(m,t); else this.narr(t); });
      const H=this.hist[this.hist.length-1]; if(H) H.clues.push({ ...c });
      for(const b of this.aliveBots()) if(b.role!=='vampir') for(const id of c.ids) if(id!==b.id && b.knows[id]===undefined) b.sus[id]+=0.6; }
    const H=this.hist[this.hist.length-1]; if(H) H.wedding=true;
    this.lastVote={ wedding:true }; this.phase='verdict'; this.needs=null;
  }
  _crowdScore(c){ let s=0,n=0; for(const b of this.aliveBots()) if(b!==c){ s+=(b.sus[c.id]||0); n++; } return n?s/n:0; }
  selectHouse(targetId){
    if(this.phase!=='select') return;
    const h=this.human, r=this.rng, iq=this.iq; const duel=this.duel;
    const allowed=(voter)=>{ let c=this.alive().filter(p=>p!==voter); if(duel){ const d=c.filter(p=>duel.includes(p.id)); if(d.length) c=d; } return c; };
    const votes={};
    if(h.alive){ const c=allowed(h); if(duel && duel.includes(h.id)) votes[h.id]=c[0].id; else { if(!targetId || !c.some(p=>p.id===targetId)) return; votes[h.id]=targetId; } }
    const tally=()=>{ const t={}; for(const v of Object.values(votes)) t[v]=(t[v]||0)+1; return t; };
    for(const b of r.shuffle(this.aliveBots())){
      let cands=allowed(b); if(b.role==='vampir'){ const f=cands.filter(p=>p.role!=='vampir'); if(f.length) cands=f; }
      if(b.ally===h.id && cands.length>1) cands=cands.filter(p=>p!==h); if(b.lover && cands.length>1) cands=cands.filter(p=>p.id!==b.lover);
      const cur=tally(); let best=null,bs=-1e9;
      for(const c of cands){ let s=(b.sus[c.id]||0) + (cur[c.id]||0)*b.pers.herd*0.7 + (r()-.5)*(1.4-iq); if(b.role==='vampir') s+=(cur[c.id]||0)*0.8; if(c.role==='deli'&&!c.human) s-=0.9; if(s>bs){bs=s;best=c;} }
      votes[b.id]=best.id;
    }
    const t=tally(); let max=0; for(const c of Object.values(t)) max=Math.max(max,c);
    const top=Object.keys(t).filter(id=>t[id]===max).map(id=>this.P(id));
    // beraberlik: iki şüpheli söz düellosu yapar, köy ikisi arasında yeniden seçer
    if(top.length>1 && !duel && this.alive().length>3){
      const pair=[...top].sort((x,y)=>this._crowdScore(y)-this._crowdScore(x)).slice(0,2);
      this.duel=pair.map(p=>p.id); this.ev({t:'badges', counts:t});
      SC.duelScene(this._io(),{ a:pair[0], b:pair[1] });
      this.ev({t:'badges', counts:{}});
      if(h.alive && !this.duel.includes(h.id)){ this.needs={ type:'select', cands:this.duel.slice(), duel:true }; return; }
      this.needs=null; return this.selectHouse(null);
    }
    this.duel=null;
    let acc = top.length===1 ? top[0] : (this._crowdSuspect(top,null) || r.pick(top));
    this.selectVotes=votes; this.stats.votesReceived += t[h.id]||0;
    this.ev({t:'badges', counts:t});
    // birkaç seçmen konuşsun
    const voters=r.shuffle(Object.keys(votes).filter(id=>votes[id]===acc.id && id!==h.id).map(id=>this.P(id))).slice(0,this.dragCount?1:2);
    for(const v of voters) this.say(v, r.chance(.5)?LN.regSpoken(`Ben ${LN.suf(acc.name,'i')} seçtim!`,'Ben bu herifi seçtim!'):this.line(LN.ACCUSE_HERD,{t:acc.name}));
    this.narr(LN.regSpoken(`En çok seçilen: ${acc.name} (${max} oy). Evinden alınıp meydana getiriliyor!`,'Köy kararını verdi! Evinden alınıp meydana getiriliyor!'));
    SC.dragScene(this._io(), { acc, others:this.alive().filter(p=>p!==acc), short:this.dragCount++>0 });
    this.ev({t:'badges', counts:{}});
    this.accused=acc.id;
    this._defense();
  }

  /* ================= SAVUNMA ================= */
  _defense(){
    const acc=this.P(this.accused);
    this.phase='defense';
    this.narr(LN.regSpoken(`${acc.name}, söz senin. Kendini savun!`,'Söz sende. Kendini savun!'));
    if(acc.human){ this.needs={ type:'defense', step:1, options:LN.DEFENSE_OPEN.map(o=>({key:o.key,label:o.label})), targets:this.alive().filter(p=>p!==acc).map(p=>p.id) }; return; }
    this._botDefense(acc);
    // kalabalıktan zor soru, sanık bot cevaplar
    { const r=this.rng; const Q=r.pick(LN.DEFENSE_Q); const asker=this.speaker([acc]); if(asker && r.chance(.75)){ this.say(asker,Q.q); const i=acc.role==='vampir'&&r.chance(0.55-this.iq*0.35)?2:(r.chance(.6)?0:1); const x=Q.a[i]; this.say(acc,x.text);
      for(const b of this._others(acc)) b.sus[acc.id]+=(x.v>0?-0.3:x.v<0?0.45:0)*(0.6+b.pers.logic*0.5); } }
    this._responses(acc);
    this._toFinal();
  }
  defend(key, targetId){
    if(this.phase!=='defense'||!this.needs) return;
    const n=this.needs; if(n.step===2) return this.defenseAnswer(key); if(n.step===3) return this.lastWord(key);
    const h=this.human; const others=this.alive().filter(p=>p!==h); const r=this.rng;
    if(key==='innocent') key='witness';
    const txt=(k)=>LN.DEFENSE_OPEN.find(x=>x.key===k).text;
    switch(key){
      case 'witness': { let o=this.P(targetId); if(!o||!o.alive||o===h) o=r.pick(others.filter(p=>!p.human)); if(!o) break;
        this.say(h, LN.fillT(txt('witness'),{o:o.name})); for(const b of this._others(h)) b.sus[h.id]-=0.3*h.cred*(1-b.pers.logic*0.4);
        const yes=o.role==='vampir' ? (h.role==='vampir'||r.chance(0.5)) : ((o.sus[h.id]||0)<0.5 && r.chance(0.8));
        if(yes){ this.say(o,this.pk(LN.WITNESS_YES)); for(const b of this._others(h)) if(b!==o) b.sus[h.id]-=0.5*o.cred; }
        else { this.say(o,this.pk(LN.WITNESS_NO)); for(const b of this._others(h)) if(b!==o) b.sus[h.id]+=0.6*o.cred; }
        break; }
      case 'blame': { const t=this.P(targetId); if(!t||!t.alive||t===h) return; this.say(h, LN.regSpoken(`Beni bırakın, asıl vampir ${t.name}! Gözlerine bakın gözlerine!`,'Beni bırakın, asıl vampir bu herif! Gözlerine bakın gözlerine!')); this._accuse(h,t); for(const b of this._others(h)) b.sus[h.id]-=0.2; break; }
      case 'role': {
        if(h.role==='kahin'){ const known=Object.entries(h.knows).filter(([id])=>this.P(id).alive); const vamp=known.find(([,v])=>v); const pickK=vamp||known[0];
          if(pickK){ const t=this.P(pickK[0]); this.say(h, pickK[1]?LN.regSpoken(`Ben kâhinim la! ${t.name} VAMPİR, beni değil onu asın!`,'Ben kâhinim la! Bu herif VAMPİR, beni değil onu asın!'):LN.regSpoken(`Ben kâhinim! ${t.name} temiz, ben de masumum.`,'Ben kâhinim! Bu adam temiz, ben de masumum.')); this._claimSeer(h,t,!!pickK[1]); }
          else { this.say(h,'Ben kâhinim la! Daha kimseye bakamadım, asmayın beni!'); h.claimed='kahin'; for(const b of this._others(h)) if(b.role!=='vampir') b.sus[h.id]-=0.8; } }
        else if(h.role==='doktor'){ this.say(h,this.pk(LN.HOCA_CLAIM)); this._claimDoctor(h); }
        else if(h.role==='bekci'){ const x=(h.guardLog||[]).filter(g=>this.P(g.target).alive).sort((a,b)=>(b.out?1:0)-(a.out?1:0))[0];
          if(x){ const t=this.P(x.target); this.say(h, LN.fillT(this.pk(x.out?LN.BEKCI_SAW:LN.BEKCI_HOME),{t:t.name},x.out)); this._claimBekci(h,t,x.out); }
          else { this.say(h, LN.fillT(LN.ROLE_CLAIM,{role:'bekçiyim'})); h.claimed='bekci'; for(const b of this._others(h)) if(b.role!=='vampir') b.sus[h.id]-=0.5; } }
        else if(h.role==='aga'){ this.say(h,this.pk(LN.AGA_CLAIM)); h.claimed='aga'; for(const b of this._others(h)) if(b.role!=='vampir') b.sus[h.id]-=0.6*h.cred; }
        else { this.say(h,'Ben düz köylüyüm la, bi suçum yok! Yapmayın!'); for(const b of this._others(h)) b.sus[h.id]-=0.3; }
        break; }
      case 'oath': { this.say(h, txt('oath')); for(const b of this._others(h)) b.sus[h.id]-=0.25*(1-b.pers.logic*0.5); break; }
      case 'beg': { this.say(h, txt('beg')); for(const b of this._others(h)) b.sus[h.id]+=(b.pers.logic>0.6?0.15:-0.35); break; }
      case 'threat': { this.say(h, txt('threat')); for(const b of this._others(h)) b.sus[h.id]+=(r.chance(0.5)?-0.3:0.4); break; }
      default: { this.say(h,'…','quiet'); for(const b of this._others(h)) b.sus[h.id]+=0.2; this.needs=null; this._responses(h); this._toFinal(); return; }
    }
    // 2) kalabalıktan zor soru
    const qi=Math.floor(r()*LN.DEFENSE_Q.length); const Q=LN.DEFENSE_Q[qi]; const asker=this.speaker([h]); if(asker) this.say(asker,Q.q); else this.narr(Q.q);
    this.needs={ type:'defense', step:2, q:Q.q, qi, options:Q.a.map((x,i)=>({ key:String(i), label:x.label })) };
  }
  defenseAnswer(key){ const n=this.needs; if(this.phase!=='defense'||n?.step!==2) return; const h=this.human; const Q=LN.DEFENSE_Q[n.qi]; const a=Q.a[+key]||Q.a[0];
    this.say(h,a.text); for(const b of this._others(h)) b.sus[h.id]+=(a.v>0?-0.4:a.v<0?0.5:0)*(0.6+b.pers.logic*0.5);
    this.needs={ type:'defense', step:3, options:LN.LAST_WORD.map(o=>({ key:o.key, label:o.label })) }; }
  lastWord(key){ if(this.phase!=='defense'||this.needs?.step!==3) return; const h=this.human; const o=LN.LAST_WORD.find(x=>x.key===key)||LN.LAST_WORD[0]; this.say(h,o.text);
    if(key==='warn'){ for(const b of this._others(h)) b.sus[h.id]-=0.15; }
    else if(key==='forgive'){ for(const b of this._others(h)) b.sus[h.id]-=0.2*(1-b.pers.logic*0.5); }
    else { for(const b of this._others(h)) b.sus[h.id]+=(b.pers.aggr>0.6?0.15:-0.1); }
    const al=this.alive().find(p=>p.ally===h.id); if(al){ this.say(al, LN.fillT(this.pk(LN.DEFEND_WHY.vouch),{t:h.name})); for(const b of this._others(h)) if(b!==al) b.sus[h.id]-=0.4*al.cred; }
    this.needs=null; this._responses(h); this._toFinal(); }
  /** başkası yargılanırken araya gir: destekle / çürüt (bir kez) */
  intervene(kind){ if(this.phase!=='final'||this.needs?.type!=='final'||this.intervened) return; const h=this.human, acc=this.P(this.accused); if(!h.alive||h===acc) return;
    this.intervened=true; const pool=LN.INTERVENE[kind==='support'?'support':'refute']; this.say(h, LN.fillT(this.pk(pool),{t:acc.name}));
    const sign=kind==='support'?-1:1; for(const b of this._others(h)) if(b!==acc && !this.finalVotes[b.id]) b.sus[acc.id]+=sign*0.6*h.cred*(0.5+b.pers.herd*0.6);
    this._stance(acc,1); }
  _botDefense(acc){
    const r=this.rng, iq=this.iq; const others=this.alive().filter(p=>p!==acc);
    if(acc.role==='kahin'){ const found=Object.entries(acc.knows).find(([id,v])=>v===true && this.P(id).alive); if(found){ const t=this.P(found[0]); this.say(acc, LN.regSpoken(`Ben kâhinim la! ${t.name} VAMPİR! Beni değil onu asın!`,'Ben kâhinim la! Bu herif VAMPİR! Beni değil onu asın!')); this._claimSeer(acc,t,true); return; } }
    if(acc.role==='doktor' && r.chance(.7)){ this.say(acc,this.pk(LN.HOCA_CLAIM)); this._claimDoctor(acc); return; }
    if(acc.role==='deli'){ this.say(acc,this.pk(LN.DELI_TALK)); for(const b of this._others(acc)) b.sus[acc.id]+=(b.pers.logic>0.55?-0.5:0.25); return; }
    if(acc.role==='bekci'){ const f=Object.entries(acc.guardKnows||{}).find(([id,o])=>o===true && this.P(id).alive); if(f){ const t=this.P(f[0]); this.say(acc, LN.fillT(this.pk(LN.BEKCI_SAW),{t:t.name},true)); this._claimBekci(acc,t,true); return; } }
    if(acc.role==='aga' && r.chance(.6)){ this.say(acc,this.pk(LN.AGA_CLAIM)); acc.claimed='aga'; for(const b of this._others(acc)) if(b.role!=='vampir') b.sus[acc.id]-=0.6*acc.cred; return; }
    if(acc.role==='vampir'){
      const realSeer=others.find(p=>p.claimed==='kahin');
      if(!realSeer && r.chance(iq*0.5)){ const t=r.pick(others.filter(p=>p.role!=='vampir')); this.say(acc, LN.regSpoken(`Ben kâhinim! Dün gece ${LN.suf(t.name,'e')} baktım: VAMPİR o!`,'Ben kâhinim! Dün gece bu herife baktım: VAMPİR o!')); this._claimSeer(acc,t,true); return; }
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
    this.phase='final'; this.finalVotes={}; this.intervened=false;
    const acc=this.P(this.accused);
    this.narr(LN.regSpoken(`Son karar: ${acc.name} asılsın mı? Herkes oyunu versin ve kitlesin!`,'Son karar! Asılsın mı, bırakılsın mı? Herkes oyunu versin ve kitlesin!'));
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
    // deli botu köy çoğu zaman sezer: "bu zararsız bi deli" (insan deliyse sezilmez)
    if(acc.role==='deli'&&!acc.human&&(b.role==='vampir'?r.chance(.45+iq*.4):b.pers.logic>=0.5)) return -3;
    if(b.role==='vampir'){
      if(acc.role==='vampir'){ const n=this.alive().length-1; return (hangs>n/2 && r.chance(iq)) ? 1 : -2; }
      return 2;
    }
    if(b.knows[acc.id]!==undefined) return b.knows[acc.id]?5:-5;
    if(b.ally===acc.id) return -2;
    return (b.buddy===acc.id?-0.6:0) + (b.sus[acc.id]||0)*1.1 + sel*1.6*b.pers.herd + hangs*0.25*b.pers.herd + 0.35 + (r()-.5)*(1.2-iq*0.6);
  }
  _lockBot(b,v){ this.finalVotes[b.id]=v; RL.tallyFinal(this.tally,b.id,this.accused,v); this.say(b, `${v==='hang'?'AS':'BIRAK'}! ${this.pk(LN.LOCK)}`); this.ev({t:'lock', who:b.id, v}); }
  finalVote(v){
    if(this.phase!=='final'||!this.needs) return;
    if(v!=='hang' && v!=='release') return;
    const h=this.human; this.finalVotes[h.id]=v; RL.tallyFinal(this.tally,h.id,this.accused,v); this.ev({t:'lock', who:h.id, v});
    this.say(h, `${v==='hang'?'AS':'BIRAK'}! Oyumu kitledim!`);
    const acc=this.P(this.accused);
    if(v==='hang' && h.role!=='vampir' && acc.role!=='vampir') this.stats.wrongVotes++;
    this.needs=null;
    this._finishFinal();
  }
  _finishFinal(){
    const acc=this.P(this.accused);
    for(const b of this.rng.shuffle(this.aliveBots().filter(p=>p!==acc && !this.finalVotes[p.id]))){ const d=this._botFinalScore(b,acc); this._lockBot(b, d>0?'hang':'release'); }
    // ağanın oyu iki sayılır
    const W=(v)=>Object.entries(this.finalVotes).filter(([,x])=>x===v).reduce((a,[id])=>a+RL.voteWeight(this.P(id)),0);
    const hang=W('hang'), rel=W('release');
    const H=this.hist[this.hist.length-1]; if(H) Object.assign(H,{ accused:acc.id, role:acc.role, hang, rel, hanged:hang>rel, votes:{ ...this.finalVotes } });
    this.narr(LN.regSpoken(`Sonuç: ${hang} AS, ${rel} BIRAK.`, hang>rel?'Oylar sayıldı. Köy AS dedi!':'Oylar sayıldı. Köy BIRAK dedi!'));
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
    const hk=this.human.alive && this.human!==acc && this.human.role!=='vampir' ? this.human : null;
    const res=SC.executeScene(this._io(), { acc, alive:this.alive(), preferKicker:hk, short:this.execCount++>0, shortVamp:acc.role==='vampir'&&this.vampExec++>0, onStakeK:()=>{ const k=this.stakeCount++; acc.stakeK=k%3; return acc.stakeK; } });
    if(acc.role==='vampir'){
      acc.alive=false; acc.fate='impaled'; acc.ash=!!res.ash;
      if(this.stats.vampHangedDay===null) this.stats.vampHangedDay=this.day;
      if(acc.human) this.stats.humanDiedDay=this.day;
    } else {
      acc.alive=false; acc.fate='hanged'; acc.hangOrder=this.hangCount++;
      const s1=this.speaker([acc]);
      if(acc.role==='deli'){ if(s1) this.say(s1, this.pk(LN.DELI_WIN)); this.narr(LN.DELI_NARR); this.sfx('laugh'); this.deliWon=acc.id; }
      else { if(s1) this.say(s1, this.pk(LN.HANG_VILLAGER)); this.narr(LN.revealLine(acc.name,RL.ROLES[acc.role].reveal)); }
      if(acc.human) this.stats.humanDiedDay=this.day;
    }
    // âşığı da dayanamaz
    if(acc.lover){ const l=this.P(acc.lover); if(l.alive && !this.deliWon){ l.alive=false; l.fate='grief'; this.narr(this.line(LN.LOVER_DEATH,{v:l.name})); this.narr(LN.revealLine(l.name,RL.ROLES[l.role].reveal)); if(l.human) this.stats.humanDiedDay=this.day; const H=this.hist[this.hist.length-1]; if(H) H.griefDay=[l.id]; } }
    this.lastVote={ hanged:acc.id, name:acc.name, role:acc.role, hang, rel, votes:hangVotes, tally:{[acc.id]:hang}, skips:rel };
    this._afterVerdict(acc, hangVotes);
    this.phase='verdict'; this.needs=null;
    this._checkWin();
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
      this.vampFriends=[...new Set(defenders.filter(d=>d.alive&&d.role!=='vampir').map(d=>d.id))];
      for(const p of this.alive()) if(p.claimed==='kahin' && p.claims.some(c=>c.target===hp.id&&c.isVamp)){ p.cred=1.6; for(const b of bots) if(b!==p) b.sus[p.id]-=3; }
      for(const p of this.alive()) if(p.claimed==='kahin' && p.claims.some(c=>c.target!==hp.id&&c.isVamp) && hp.claimed==='kahin'){ /* vampir sahte kâhindi */ }
    } else {
      this.prevAccusers=accusers.map(a=>a.id);
      for(const a of accusers){ a.cred=Math.max(.3,a.cred-0.3); for(const b of bots) if(b!==a) b.sus[a.id]+=1.0*b.pers.logic; }
      for(const v of voters) for(const b of bots) if(b!==v) b.sus[v.id]+=0.3*b.pers.logic;
      for(const d of defenders) d.cred=Math.min(1.6,d.cred+0.15);
      for(const p of this.alive()) if(p.claimed==='kahin' && p.claims.some(c=>c.target===hp.id&&c.isVamp)){ p.cred=.3; for(const b of bots) if(b!==p) b.sus[p.id]+=4; }
    }
    for(const b of bots) for(const k in b.sus) b.sus[k]*=0.85;
  }
  nextNight(){ if(this.phase!=='verdict') return; this.toNight(); }

  /* ================= HAYALET (insan öldükten sonra) ================= */
  /** bahis: vampir kim? (oyun sonunda tutarsa ödül) */
  ghostBet(id){ const h=this.human; if(h.alive||this.phase==='end') return; const t=this.P(id); if(!t||t===h) return; this.ghost.bet=id; this.tally.bets[h.id]=id; }
  /** fısıltı: oyun başına bir kez, yaşayan birine içinde vampir olan bir grup fısıldanır */
  ghostWhisper(id){ const h=this.human; if(h.alive||this.ghost.whispered||!['dawn','verdict'].includes(this.phase)) return false; const t=this.P(id); if(!t||!t.alive||t.human) return false;
    const c=RL.groupClue({ players:this.players, kind:'hayalet', id:`g${this.day}`, rnd:this.rng }); if(!c) return false; this.ghost.whispered=true; c.to=id;
    for(const b of this.aliveBots()) if(b.role!=='vampir') for(const x of c.ids) if(x!==b.id && b.knows[x]===undefined) b.sus[x]+=(b===t?1.2:0.5);
    if(this.phase==='dawn'){ this.clues.push(c); this._announceClues([c],()=>{}); const H=this.hist[this.hist.length-1]; if(H) H.clues.push({ ...c }); }
    else this.pendingClue=c;
    return true; }
  /** domates at (hükümde, meydandakilere) / kapı tıkırdat (sabah, evdekilere) */
  ghostPrank(kind,id){ const h=this.human; if(h.alive||this.ghost.acts>=3) return false; const t=this.P(id); if(!t||!t.alive) return false;
    if(kind==='tomato'){ if(this.phase!=='verdict') return false; this.ghost.acts++; this.ev({ t:'tomato', who:id }); if(this.rng.chance(.6)) this.say(t,this.pk(LN.TOMATO_HIT)); return true; }
    if(kind==='rattle'){ if(this.phase!=='dawn') return false; this.ghost.acts++; this.ev({ t:'rattle', who:id }); if(this.rng.chance(.7)) this.say(t,this.pk(LN.RATTLE),'inside'); return true; }
    return false; }

  /* ================= BİTİŞ ================= */
  _checkWin(){
    const al=this.alive(); const v=al.filter(p=>p.role==='vampir').length; const o=al.length-v;
    if(this.deliWon){ this.winner='deli'; this.phase='end'; this.needs=null; this.result=this._score(); return true; }
    if(v===0) this.winner='koylu'; else if(v>=o) this.winner='vampir';
    if(!this.winner) return false;
    this.phase='end'; this.needs=null;
    if(this.winner==='vampir'){
      const vamps=this.aliveVamps(); const vills=al.filter(p=>p.role!=='vampir');
      SC.vampWinScene(this._io(), { vamps, vills, multi: this.players.filter(p=>p.role==='vampir').length>1 });
      vills.forEach(p=>{ p.fate='bitten'; });
    } else {
      SC.villageWinScene(this._io(), { alive:al });
    }
    this.result=this._score();
    return true;
  }
  humanWon(){ if(this.winner==='deli') return this.human.role==='deli'; if(this.human.role==='deli') return false; const side=this.human.role==='vampir'?'vampir':'koylu'; return this.winner===side; }

  _score(){
    const L=this.level, s=this.stats, won=this.humanWon();
    let stars=won?1:0, objOk=false, perfect=false, objText='';
    const o=L.objective||{type:'win'};
    switch(o.type){
      case 'win': objOk=won && s.humanDiedDay===null; objText='Hayatta kal ve kazan'; break;
      case 'winByDay': objOk=won && s.days<=o.n; objText=`${o.n}. günden önce kazan`; break;
      case 'vampHangedByDay': objOk=won && s.vampHangedDay!==null && s.vampHangedDay<=o.n; objText=`Vampire ${o.n}. günden önce kazık çak`; break;
      case 'saves': objOk=won && s.saves>=o.n; objText=`En az ${o.n} kişiyi kurtar`; break;
      case 'maxVotes': objOk=won && s.votesReceived<=o.n; objText=`En fazla ${o.n} oy al`; break;
      case 'noWrongVote': objOk=won && s.wrongVotes===0; objText='Hiç yanlış kişiye AS deme'; break;
      case 'survive': objOk=won && s.humanDiedDay===null; objText='Hayatta kal ve kazan'; break;
    }
    if(this.human.role==='deli'){ objOk=won; objText='Kendini köye astır'; }
    if(objOk){ stars=2; perfect = this.human.role==='deli' ? s.days<=2 : this.human.role==='vampir' ? s.votesReceived<=1 : (s.wrongVotes===0 && s.humanDiedDay===null); if(perfect) stars=3; }
    return { won, stars, objOk, objText, perfect, days:s.days, role:this.human.role, winner:this.winner, awards:RL.awards(this.tally,this.players), hist:this.hist };
  }
}


/* ------------------------------ SEVİYELER ------------------------------ */
export const CHAPTERS = [
  { id:1, name:'Köy Meydanı', sub:'Öğretici', ic:'🏘️', color:'#d9a441' },
  { id:2, name:'Kan Ayı', sub:'Rol ustası', ic:'🌕', color:'#e23b4a' },
  { id:3, name:'Kale', sub:'Çifte tehdit', ic:'🏰', color:'#4f8de6' },
  { id:4, name:'Lanetli Orman', sub:'Usta', ic:'🌲', color:'#3fb37f' },
  { id:5, name:'Yeni Yüzler', sub:'Bekçi, deli, ağa, dedikoducu', ic:'🎭', color:'#b07ae6' },
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
  { id:17, ch:3, name:'Zar', players:10, vampires:2, role:'random', iq:.7, rounds:3, extras:true, objective:{type:'winByDay',n:5}, desc:'Köye yeni yüzler geldi: bekçi ve deli. Deliyi asarsanız oyunu o kazanır!' },
  { id:18, ch:3, name:'Kale Düşmesin', players:10, vampires:2, role:'kahin', iq:.75, rounds:3, extras:true, objective:{type:'noWrongVote'}, boss:true },
  // Bölüm 4
  { id:19, ch:4, name:'Sisli Yol', players:10, vampires:2, role:'koylu', iq:.75, rounds:2, objective:{type:'win'}, desc:'Botlar zeki, tartışma kısa. Her sözün önemli.' },
  { id:20, ch:4, name:'İki Can', players:10, vampires:2, role:'doktor', iq:.8, rounds:2, objective:{type:'saves',n:1} },
  { id:21, ch:4, name:'Görünmez', players:11, vampires:3, role:'vampir', iq:.75, rounds:2, objective:{type:'maxVotes',n:2} },
  { id:22, ch:4, name:'Üç Diş', players:12, vampires:3, role:'kahin', iq:.85, rounds:2, objective:{type:'vampHangedByDay',n:2} },
  { id:23, ch:4, name:'Şafak', players:12, vampires:3, role:'random', iq:.9, rounds:2, objective:{type:'winByDay',n:5} },
  { id:24, ch:4, name:'Lanetin Sonu', players:12, vampires:3, role:'random', iq:.95, rounds:2, objective:{type:'noWrongVote'}, boss:true, desc:'Son sınav. Her şeyi öğrendin; şimdi göster.' },
  // Bölüm 5 — yeni roller (Bölüm 2 bitince açılır)
  { id:25, ch:5, unlockAfter:12, name:'Fener', players:8, vampires:2, role:'bekci', iq:.45, rounds:2, objective:{type:'win'}, desc:'Bekçisin. Her gece bir evi gözetle: dışarı çıkan ya vampirdir ya hoca. Gördüğünü akıllıca açıkla.' },
  { id:26, ch:5, name:'Delinin Günü', players:8, vampires:2, role:'deli', iq:.5, rounds:2, objective:{type:'deli'}, desc:'Delisin! Köy seni asarsa oyunu sen kazanırsın. Şüphe çek ama abartma; vampir seni gece yemesin.' },
  { id:27, ch:5, name:'İz Sürücü', players:9, vampires:2, role:'koylu', iq:.55, rounds:2, objective:{type:'vampHangedByDay',n:2}, desc:'Düz köylüsün ama gözün keskin: sabah ipuçlarını incele, gece pencereden gözetle.' },
  { id:28, ch:5, name:'Ağanın Sözü', players:11, vampires:3, role:'aga', iq:.6, rounds:2, objective:{type:'noWrongVote'}, desc:'Köyün ağasısın: son kararda oyun iki sayılır. Yanlış adama AS dersen bedeli ağır olur.' },
  { id:29, ch:5, name:'Dedikodu Kazanı', players:11, vampires:3, role:'dedikoducu', iq:.65, rounds:2, objective:{type:'win'}, desc:'Her sabah kulağına bir dedikodu gelir: iki kişiden biri gece dışarıdaydı. Yay ya da sakla.' },
  { id:30, ch:5, name:'Düğün Gecesi', players:12, vampires:3, role:'random', iq:.8, rounds:2, objective:{type:'winByDay',n:6}, boss:true, desc:'Bütün roller, bütün olaylar. Köyde ne ararsan var.' },
];
export function objectiveText(o){
  switch(o?.type){ case 'deli': return 'Kendini köye astır'; case 'winByDay': return `${o.n}. günden önce kazan`; case 'vampHangedByDay': return `Vampiri ${o.n}. günden önce astır`; case 'saves': return `En az ${o.n} kişiyi kurtar ve kazan`; case 'maxVotes': return `En fazla ${o.n} oy alarak kazan`; case 'noWrongVote': return 'Hiç yanlış oy vermeden kazan'; case 'survive': return 'Hayatta kal ve kazan'; default: return 'Hayatta kal ve kazan'; }
}
export const RANKS = [
  { xp:0, name:'Çırak', ic:'🕯️' }, { xp:600, name:'Gözcü', ic:'👁️' }, { xp:1600, name:'Avcı', ic:'🏹' }, { xp:3200, name:'Vampir Avcısı', ic:'🗡️' }, { xp:5500, name:'Köy Reisi', ic:'👑' },
];
export function rankFor(xp){ let r=RANKS[0]; for(const k of RANKS) if(xp>=k.xp) r=k; const i=RANKS.indexOf(r); return { ...r, next: RANKS[i+1]||null }; }
export function xpFor(result, level){ if(!result.won) return 20; return 100 + result.stars*50 + (level.boss?100:0) + Math.round((level.iq||0)*100); }
