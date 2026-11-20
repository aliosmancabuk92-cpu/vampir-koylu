/* =====================================================================
   ORTAK KURALLAR — roller, gece çözümü, ipuçları, köy olayları, ödüller
   Tek kişilik motor ve odalı oyunun anlatıcısı aynı kuralları kullanır.
   Hiçbir yerde DOM yok; rnd = 0..1 üreten işlev.
   ===================================================================== */

export const ROLES = {
  vampir:     { name:'Vampir', ic:'🧛', reveal:'vampirmiş', desc:'Her gece bir köylünün kanını emersin; istersen başka birinin kapısına sahte iz bırakırsın. Gündüz masum rolü yap. Köylü sayısı vampirlere eşitlenince kazanırsın.' },
  doktor:     { name:'Hoca', ic:'📿', reveal:'hocaymış', claim:'hocayım', desc:'Her gece bir evi okuyup üflersin; vampir o eve giremez. Kendi evini de okuyabilirsin.' },
  kahin:      { name:'Kâhin', ic:'🔮', reveal:'kâhinmiş', claim:'kâhinim', desc:'Her gece birinin vampir olup olmadığını öğrenirsin. Açıklarsan vampir seni hedef alır.' },
  koylu:      { name:'Köylü', ic:'🧑‍🌾', reveal:'köylüymüş', claim:'köylüyüm', desc:'Özel gücün yok ama gözün var: gece pencereden bir evi gözetleyebilir, sabah ipuçlarını inceleyebilirsin. Oyun senin silahın.' },
  bekci:      { name:'Bekçi', ic:'🔦', reveal:'bekçiymiş', claim:'bekçiyim', desc:'Her gece bir evi gözetlersin: o kişi gece dışarı çıktı mı, kesin öğrenirsin. Dikkat: hoca da gece dışarı çıkar.' },
  deli:       { name:'Deli', ic:'🤪', reveal:'deliymiş', desc:'Tek başınasın. Köy seni asarsa oyunu SEN kazanırsın. Şüphe çek ama belli etme.' },
  aga:        { name:'Ağa', ic:'🎩', reveal:'ağaymış', claim:'ağayım', desc:'Köyün ağasısın: son karar oylamasında oyun iki sayılır.' },
  dedikoducu: { name:'Dedikoducu', ic:'🗣️', reveal:'dedikoducuymuş', desc:'Her sabah kulağına bir dedikodu gelir: iki kişiden biri gece dışarıdaydı. Hangisi olduğunu bilemezsin.' },
};
export const roleName=(r)=>(ROLES[r]||ROLES.koylu).name;
/** gece seçimi türü: vamp | doktor | kahin | bekci | watch */
export const nightKind=(role)=>({ vampir:'vamp', doktor:'doktor', kahin:'kahin', bekci:'bekci' })[role]||'watch';
export const voteWeight=(p)=>p&&p.role==='aga'?2:1;

/** oyuncu sayısına göre rol dağılımı */
export function rolesFor(n,{ vampires, extras=true }={}){
  const v=vampires ?? (n>=11?3:n>=8?2:1);
  const r=[]; for(let i=0;i<v;i++) r.push('vampir'); r.push('kahin','doktor');
  if(extras){ if(n>=8) r.push('bekci','deli'); if(n>=11) r.push('aga','dedikoducu'); }
  while(r.length>n) r.pop(); while(r.length<n) r.push('koylu');
  return r;
}
const shuf=(a,rnd)=>{ a=[...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const pick=(a,rnd)=>a[Math.floor(rnd()*a.length)];

/** âşıklar: kalabalık oyunda vampir olmayan iki kişi (biri ölürse diğeri de gider) */
export function pickLovers(players,rnd,{ extras=true }={}){
  if(!extras||players.length<11) return null;
  const c=shuf(players.filter(p=>p.role!=='vampir'&&p.role!=='deli'),rnd); if(c.length<2) return null;
  c[0].lover=c[1].id; c[1].lover=c[0].id; return [c[0].id,c[1].id];
}

/* ---------------------------- KÖY OLAYLARI ---------------------------- */
export const EVENTS = {
  sis:     { ic:'🌫️', name:'Sis', desc:'Köyü sis bastı: bu sabah ipucu yok.' },
  firtina: { ic:'⛈️', name:'Fırtına', desc:'Bu gece fırtına var: bekçi göremez, pencereden bakmak zorlaşır.' },
  dolunay: { ic:'🌕', name:'Dolunay', desc:'Bu gece vampir iki kişi ısırabilir; ama sabah izi kesin olur.' },
  pazar:   { ic:'🧺', name:'Pazar günü', desc:'Herkes meydanda: tartışma uzun, iki ipucunu da inceleyebilirsin.' },
  dugun:   { ic:'🥁', name:'Düğün', desc:'Düğün günü kimse asılmaz. Halay sırasında biri kaybolur: ek ipucu çıkar.' },
};
export function rollEvent({ day, used=[], aliveN, nightEvent, rnd, enabled=true }){
  if(!enabled||day<2||nightEvent==='dolunay') return null;
  if(rnd()>0.55) return null;
  const c=Object.keys(EVENTS).filter(k=>!used.includes(k) && (k!=='dolunay'||aliveN>=7) && (k!=='dugun'||aliveN>=6));
  return c.length?pick(c,rnd):null;
}
/** dolunayda çift ısırık: oyunu tek gecede bitirmeyecekse */
export function canDoubleBite(players){ const al=players.filter(p=>p.alive); const v=al.filter(p=>p.role==='vampir').length; return al.length-v-2>v; }

/* ------------------------------ GECE ------------------------------ */
/**
 * bite:[id…] vampirin hedef(ler)i · plant: sahte iz bırakılan · protect: hocanın okuduğu ev
 * seer: kâhinin baktığı · guard: bekçinin gözetlediği · watch:{kim:hangiEv} pencereden bakanlar
 * first: ilk gece (kimse ölmez, tavuk gider) · event: 'firtina' | 'dolunay' | null
 */
export function resolveNight({ players, bite=[], plant=null, protect=null, seer=null, guard=null, watch={}, first=false, event=null, rnd }){
  const P=(id)=>players.find(p=>p.id===id);
  const alive=players.filter(p=>p.alive);
  const vamps=alive.filter(p=>p.role==='vampir');
  const hoca=alive.find(p=>p.role==='doktor');
  const targets=[...new Set(bite.filter(id=>id&&P(id)&&P(id).alive&&P(id).role!=='vampir'))].slice(0,event==='dolunay'?2:1);
  // gece yalnızca ısıran vampir(ler) dışarı çıkar; ötekiler evinde alibi sağlar
  const vOut=(first||targets.length||plant)?shuf(vamps,rnd).slice(0,Math.max(1,targets.length)).map(p=>p.id):[];
  const outs=new Set(vOut); if(hoca&&protect&&protect!==hoca.id&&P(protect)) outs.add(hoca.id);
  const killed=[], saved=[];
  if(!first) for(const t of targets){ if(protect===t) saved.push(t); else killed.push(t); }
  const grief=[]; for(const id of killed){ const l=P(id).lover; if(l&&P(l)&&P(l).alive&&!killed.includes(l)&&!grief.includes(l)) grief.push(l); }
  const storm=event==='firtina';
  const seerRes=seer&&P(seer)?{ target:seer, isVamp:P(seer).role==='vampir' }:null;
  const guardRes=guard&&P(guard)?{ target:guard, out:storm?null:outs.has(guard) }:null;
  const watchRes={};
  for(const [pid,tid] of Object.entries(watch)){ if(!tid||!P(tid)) continue; watchRes[pid]={ target:tid, saw:(outs.has(tid)&&rnd()<(storm?0.25:0.5))?'out':'none' }; }
  return { killed, grief, saved, outs:[...outs], vOut, seerRes, guardRes, watchRes, plant:(plant&&P(plant)&&P(plant).role!=='vampir')?plant:null };
}
/** dedikoducunun sabah duyduğu: iki kişiden biri gece dışarıdaydı */
export function gossipFor({ players, outs, self, rnd }){
  const al=players.filter(p=>p.alive&&p.id!==self);
  const o=al.filter(p=>outs.includes(p.id)), h=al.filter(p=>!outs.includes(p.id));
  if(!o.length||!h.length) return null;
  return { ids:shuf([pick(o,rnd).id,pick(h,rnd).id],rnd) };
}

/* ----------------------------- İPUÇLARI ----------------------------- */
export const CLUE_KINDS = {
  iz:{ ic:'👣', name:'Ayak izi' }, kopek:{ ic:'🐕', name:'Köpek havlaması' }, tuy:{ ic:'🪶', name:'Tavuk tüyü' }, kan:{ ic:'🩸', name:'Kan damlası' },
  baca:{ ic:'🏚️', name:'Tütmeyen baca' }, ay:{ ic:'🌕', name:'Ay ışığında iz' }, dugun:{ ic:'🥁', name:'Halaydan kaybolan' }, hayalet:{ ic:'👻', name:'Hayalet fısıltısı' },
};
/** içinde bir vampir olan rastgele grup (ek ipucu, hayalet fısıltısı…) */
export function groupClue({ players, kind, id, rnd, k }){
  const al=players.filter(p=>p.alive); const vamps=al.filter(p=>p.role==='vampir'); if(!vamps.length) return null;
  k=k||(al.length>=5?3:2); const v=pick(vamps,rnd); const f=shuf(al.filter(p=>p.role!=='vampir'),rnd).slice(0,k-1);
  return { id, kind, ids:shuf([v.id,...f.map(p=>p.id)],rnd), real:true, planted:false, sure:false };
}
/**
 * Sabah ipuçları. Gerçek ipucu: içinde gece dışarı çıkan bir vampir olan grup.
 * Her iz gerçek olmayabilir: boş iz ya da vampirin bıraktığı sahte iz de çıkar; incelemek bunun için var.
 * Pencereden gözetleyenlerin (watchers) ışığı yandığı için dolgu olarak öncelikle onlar seçilir.
 */
export function makeClues({ players, vOut=[], plant=null, watchers=[], dayEvent=null, nightEvent=null, first=false, day=0, rnd }){
  if(dayEvent==='sis') return [];
  const alive=players.filter(p=>p.alive); const vamps=alive.filter(p=>vOut.includes(p.id)&&p.role==='vampir'); const inno=alive.filter(p=>p.role!=='vampir');
  const k=alive.length>=5?3:2;
  const fill=(n,ex)=>{ const c=inno.filter(p=>!ex.includes(p.id)); const w=shuf(c.filter(p=>watchers.includes(p.id)),rnd), o=shuf(c.filter(p=>!watchers.includes(p.id)),rnd); const out=[];
    while(out.length<n&&(w.length||o.length)){ const src=(w.length&&(!o.length||rnd()<0.75))?w:o; out.push(src.shift().id); } return out; };
  const kinds=shuf(first?['tuy','iz','kopek']:['iz','kopek','tuy','kan','baca'],rnd); const out=[];
  const mk=(ids,o={})=>{ if(ids.length<2) return; out.push({ id:`c${day}_${out.length}`, kind:o.sure?'ay':kinds[out.length%kinds.length], ids:shuf(ids,rnd), real:!!o.real, planted:!!o.planted, sure:!!o.sure }); };
  if(nightEvent==='dolunay'&&vamps.length){ const v=pick(vamps,rnd); mk([v.id,...fill(1,[v.id])],{ real:true, sure:true }); return out; }
  // 1. iz: çoğunlukla gerçek (içinde vampir var), yoksa boş iz
  let used=[];
  if(vamps.length&&rnd()<0.62){ const v=pick(vamps,rnd); used=fill(k-1,[v.id]); mk([v.id,...used],{ real:true }); }
  else { used=fill(k,[]); mk(used); }
  // 2. iz: vampirin bıraktığı sahte iz; yoksa çoğunlukla boş, bazen ikinci bir gerçek iz
  const pl=plant&&alive.find(p=>p.id===plant&&p.role!=='vampir');
  if(pl){ let f=fill(k-1,[pl.id,...used]); if(f.length<k-1) f=fill(k-1,[pl.id]); mk([pl.id,...f],{ planted:true }); }
  else if(alive.length>=5){
    if(!vamps.length||rnd()<0.65){ let f=fill(k,used); if(f.length<k) f=fill(k,[]); mk(f); }
    else { const v=pick(vamps,rnd); let f=fill(k-1,[v.id,...used]); if(f.length<k-1) f=fill(k-1,[v.id]); mk([v.id,...f],{ real:true }); }
  }
  return out;
}
/** ipucunu incele → 'fresh' (taze, gerçek gibi) | 'fake' (sonradan konmuş gibi); %75 isabet */
export function inspectClue(clue,rnd,acc=0.75){ if(clue.sure) return 'fresh'; const right=rnd()<acc; return (right?clue.real:!clue.real)?'fresh':'fake'; }

/* --------------------------- SAYAÇ + ÖDÜLLER --------------------------- */
const inc=(o,k,n=1)=>{ if(k!=null) o[k]=(o[k]||0)+n; };
export function newTally(){ return { accs:[], defs:[], finals:[], kicked:{}, flop:{}, weak:{}, strong:{}, tomato:{}, bets:{} }; }
/** sahne olaylarından sayaç */
export function tallyEvent(T,e){ if(!T||!e) return;
  if(e.t==='kickButt'){ inc(T.kicked,e.who); if(e.variant&&e.variant!=='hit') inc(T.flop,e.by); }
  else if(e.t==='door'){ if(e.step==='weak'||e.step==='open') inc(T.weak,e.by); else if(e.step==='strong') inc(T.strong,e.by); }
  else if(e.t==='tomato') inc(T.tomato,e.who);
}
export const tallyAccuse=(T,from,to)=>{ if(T) T.accs.push([from,to]); };
export const tallyDefend=(T,from,to)=>{ if(T) T.defs.push([from,to]); };
export const tallyFinal=(T,from,acc,v)=>{ if(T) T.finals.push([from,acc,v]); };
/** oyun sonu komik ödüller → [{ ic, title, who, note }] (en fazla 5) */
export function awards(T,players){
  if(!T) return []; const P=(id)=>players.find(p=>p.id===id); const isV=(id)=>P(id)?.role==='vampir'; const out=[];
  const best=(m,min=1)=>{ let b=null,bn=min-1; for(const [k,n] of Object.entries(m)){ if(P(k)&&n>bn){ bn=n; b=k; } } return b?[b,bn]:null; };
  const mud={}, sharp={}, pal={};
  for(const [f,t] of T.accs){ if(isV(f)) continue; if(isV(t)) inc(sharp,f); else inc(mud,f); }
  for(const [f,a,v] of T.finals){ if(isV(f)) continue; if(isV(a)){ if(v==='hang') inc(sharp,f); else inc(pal,f); } }
  for(const [f,t] of T.defs){ if(!isV(f)&&isV(t)) inc(pal,f,2); }
  let r;
  if((r=best(T.kicked))) out.push({ ic:'🍑', title:'Kıçı Kızaran', who:r[0], note:`${r[1]} tekme yedi` });
  if((r=best(sharp,2))) out.push({ ic:'🎯', title:'Keskin Göz', who:r[0], note:`${r[1]} kez vampirin üstüne gitti` });
  if((r=best(mud,2))) out.push({ ic:'🗯️', title:'Çamur Ustası', who:r[0], note:`${r[1]} kez masumu suçladı` });
  if((r=best(pal))) out.push({ ic:'🤝', title:'Vampirle Kol Kola', who:r[0], note:'vampire arka çıktı' });
  const feet={}; for(const [k,n] of Object.entries(T.weak)) inc(feet,k,n); for(const [k,n] of Object.entries(T.flop)) inc(feet,k,n);
  if((r=best(feet))) out.push({ ic:'🦶', title:'Ayağı Kırılan', who:r[0], note:`${r[1]} tekmesi boşa gitti` });
  if((r=best(T.strong))) out.push({ ic:'🚪', title:'Kapı Düşmanı', who:r[0], note:`${r[1]} kapı kırdı` });
  if((r=best(T.tomato,2))) out.push({ ic:'🍅', title:'Domates Hedefi', who:r[0], note:`${r[1]} domates yedi` });
  for(const [g,t] of Object.entries(T.bets)){ if(P(g)&&isV(t)){ out.push({ ic:'👻', title:'Hayalet Kâhin', who:g, note:'mezardan vampiri bildi' }); break; } }
  return out.slice(0,5);
}
