/* =====================================================================
   SAHNE SENARYOLARI — tek kişilik ve odalı oyunun ortak olay dizileri
   io = { say(p,text,kind), narr(text), sfx(name), ev(e), rnd() }
   Olaylar 3B yönetmende (director.js) adım adım canlandırılır;
   repliklerin sırası hareketlerin sırasıyla birebir eşleşir.
   ===================================================================== */
import * as LN from './lines.js';

const pk=(io,arr)=>LN.pick(arr,io.rnd);
const shuf=(io,a)=>{ a=[...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(io.rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const byArch=(list,keys)=>{ for(const k of keys){ const p=list.find(x=>x.arch===k); if(p) return p; } return null; };

/* ---------------- 1) EVDEN ALMA: kapı baskını ---------------- */
export function dragScene(io,{ acc, others }){
  const crowd=shuf(io,others).slice(0,4);
  if(!crowd.length){ io.ev({ t:'drag', target:acc.id, crowd:[], variant:'one' }); io.ev({ t:'escort', who:acc.id, crowd:[] }); return; }
  // tekmeciler: zayıf olan delikanlı/deli, güçlü olan demirci/dayıoğlu
  const weak=byArch(crowd,['delikanli','deli','coban','kahveci'])||crowd[0];
  const strong=byArch(crowd.filter(p=>p!==weak),['demirci','dayioglu','kufurbaz','bekci','memis'])||crowd.find(p=>p!==weak)||null;
  const r=io.rnd(); const variant=(strong && r<0.5)?'fail':(r<0.78?'one':'open');
  const order=[weak,strong,...crowd.filter(p=>p!==weak&&p!==strong)].filter(Boolean);
  io.ev({ t:'drag', target:acc.id, crowd:order.map(p=>p.id), variant });
  const knocker=order[order.length>1?1:0];
  io.say(knocker,pk(io,LN.DOOR.knock)); io.ev({ t:'door', step:'knock' });
  io.say(acc,pk(io,LN.DOOR.inside),'inside');
  const teaser=order.find(p=>p!==weak&&p!==strong)||strong||weak;
  if(variant==='fail'){
    io.say(weak,pk(io,LN.DOOR.weak)); io.ev({ t:'door', step:'weak', by:weak.id });
    io.say(weak,pk(io,LN.DOOR.hurt));
    io.ev({ t:'door', step:'tease' }); io.say(teaser,pk(io,LN.DOOR.tease)); io.sfx('laugh');
    io.say(strong,pk(io,LN.DOOR.strong)); io.ev({ t:'door', step:'strong', by:strong.id });
    io.say(strong,pk(io,LN.DOOR.broken));
  } else if(variant==='one'){
    const k=strong||weak; io.say(k,pk(io,LN.DOOR.strong)); io.ev({ t:'door', step:'strong', by:k.id });
    io.say(k,pk(io,LN.DOOR.broken));
  } else {
    io.say(weak,pk(io,LN.DOOR.weak)); io.ev({ t:'door', step:'open', by:weak.id });
    io.say(weak,pk(io,LN.DOOR.fell)); io.say(teaser,pk(io,LN.DOOR.open)); io.sfx('laugh');
  }
  io.ev({ t:'door', step:'cling' });
  io.say(acc,pk(io,LN.DOOR.cling));
  io.say(order[0],pk(io,LN.DRAG.crowd));
  io.say(acc,pk(io,LN.DRAG.accused));
  io.ev({ t:'escort', who:acc.id, crowd:order.map(p=>p.id) });
}

/* ---------------- 2) DARAĞACI + (vampirse) arkadan tekme + kazık ---------------- */
export function executeScene(io,{ acc, alive, pleaded=false, preferKicker=null, onStakeK }){
  const others=alive.filter(p=>p!==acc);
  io.sfx('drum');
  if(!pleaded) io.say(acc,pk(io,LN.PLEAD));
  const ex=byArch(others,['demirci','bekci','muhtar'])||others[0]||null;
  io.ev({ t:'stool', who:acc.id, ex:ex?.id });
  if(ex){ io.say(ex,pk(io,LN.EXECUTIONER)); io.say(ex,pk(io,LN.GALLOWS.knot)); }
  io.say(acc,pk(io,LN.GALLOWS.last));
  const looker=shuf(io,others.filter(p=>p!==ex))[0]; if(looker) io.say(looker,pk(io,LN.GALLOWS.look));
  io.sfx('thud'); io.sfx('creak');
  if(acc.role!=='vampir'){ io.ev({ t:'hang', who:acc.id, vamp:false }); return { vamp:false }; }

  io.ev({ t:'hang', who:acc.id, vamp:true }); io.sfx('evil');
  const s1=shuf(io,others)[0]; io.say(s1||acc,pk(io,LN.HANG_VAMPIRE_SURPRISE));
  io.say(acc,pk(io,LN.VAMPIRE_HANGED_LINES));
  // arkadan kıça tekme: 2-3 kişi; biri ıskalar ya da geri dönen bedene çarpar
  const kick=shuf(io,others.filter(p=>p.role!=='vampir')); if(preferKicker && kick.includes(preferKicker)){ kick.splice(kick.indexOf(preferKicker),1); kick.unshift(preferKicker); }
  const kickers=kick.slice(0,Math.min(3,kick.length));
  const flop=kickers.length>1?1+Math.floor(io.rnd()*(kickers.length-1)):-1; const flopKind=io.rnd()<.5?'back':'miss';
  kickers.forEach((k,i)=>{
    const variant=i===flop?flopKind:'hit';
    if(i===0) io.say(k,pk(io,LN.KICK_BUTT.go));
    io.ev({ t:'kickButt', who:acc.id, by:k.id, variant, n:i });
    if(variant==='hit'){ io.say(k,pk(io,LN.KICK_BUTT.hit)); if(i===0) io.say(acc,pk(io,LN.KICK_BUTT.vamp)); }
    else { io.say(k,pk(io,variant==='back'?LN.KICK_BUTT.back:LN.KICK_BUTT.miss)); const t=shuf(io,others.filter(p=>p!==k))[0]; if(t) io.say(t,pk(io,LN.KICK_BUTT.tease)); io.sfx('laugh'); }
  });
  // kazık
  const k=onStakeK();
  const helpers=shuf(io,others.filter(p=>p.role!=='vampir'));
  const staker=byArch(helpers,['demirci','kufurbaz','dayioglu'])||helpers[0]||null;
  const holders=helpers.filter(p=>p!==staker);
  if(LN.isHardMode()){
    io.ev({ t:'stakeButt', who:acc.id, k, step:'down', by:staker?.id, holders:holders.slice(0,3).map(p=>p.id) });
    io.say(staker||holders[0]||acc,pk(io,LN.STAKE_BUTT.start));
    io.ev({ t:'stakeButt', who:acc.id, k, step:'hold' });
    if(holders[0]) io.say(holders[0],pk(io,LN.STAKE_BUTT.hold));
    io.say(acc,pk(io,LN.STAKE_BUTT.beg));
    if(holders[1]) io.say(holders[1],pk(io,LN.STAKE_BUTT.ask));
    if(staker) io.say(staker,pk(io,LN.STAKE_BUTT.answer));
    for(let i=0;i<3;i++){
      const who=i===1&&holders[0]?holders[0]:staker;
      if(who) io.say(who,pk(io,LN.STAKE_BUTT.push));
      io.ev({ t:'stakeButt', who:acc.id, k, step:'push', n:i });
      io.say(acc,pk(io,LN.STAKE_BUTT.roar),'roar');
    }
    io.ev({ t:'stakeButt', who:acc.id, k, step:'ash' }); io.sfx('cheer');
    const f=holders[1]||holders[0]||staker; if(f) io.say(f,pk(io,LN.STAKE_BUTT.after));
    return { vamp:true, ash:true, k };
  }
  io.ev({ t:'impale', who:acc.id, k });
  for(let i=0;i<3;i++){ const h=holders[i%Math.max(1,holders.length)]; if(h) io.say(h,pk(io,LN.IMPALE)); io.sfx('scream'); io.say(acc,pk(io,LN.SCREAMS),'scream'); }
  io.sfx('impale'); io.sfx('cheer');
  const f=holders[0]||staker; if(f) io.say(f,pk(io,LN.AFTER_IMPALE));
  return { vamp:true, ash:false, k };
}

/* ---------------- 3) OYUN SONU ---------------- */
/** vampir kazandı: son kalanlar kaçar, vampir yakalayıp gırtlağından emer */
export function vampWinScene(io,{ vamps, vills, multi }){
  io.ev({ t:'night', on:true, end:true });
  const v=vamps[0]; const order=shuf(io,vills); const last=order[order.length-1]||null;
  io.ev({ t:'chase', step:'start', vamps:vamps.map(p=>p.id), vills:order.map(p=>p.id) });
  io.sfx('evil');
  io.say(v,pk(io,LN.END_CHASE.vamp1));
  if(last){
    if(order.length>1) io.say(order[0],pk(io,LN.END_CHASE.others));
    io.say(last,pk(io,LN.END_CHASE.run));
    io.ev({ t:'chase', step:'run' });
    io.say(last,pk(io,LN.END_CHASE.help));
    io.ev({ t:'chase', step:'trip' });
    io.say(v,pk(io,LN.END_CHASE.vamp2));
    io.ev({ t:'chase', step:'grab' });
    io.say(last,pk(io,LN.END_CHASE.caught));
    io.ev({ t:'chase', step:'bite' });
    io.say(v,pk(io,LN.END_CHASE.after));
  }
  io.say(v,pk(io,multi?LN.END_VAMP_MULTI:LN.END_VAMP_SOLO));
  io.ev({ t:'chase', step:'end' });
  io.narr('Vampirler köyü ele geçirdi!');
}
/** köylüler kazandı: nüfus atışması, sonra oyun havası ve dans */
export function villageWinScene(io,{ alive }){
  io.ev({ t:'night', on:false, end:true }); io.ev({ t:'gather', end:true });
  const L=shuf(io,alive); const n=L.length;
  io.ev({ t:'party', step:'start', who:L.map(p=>p.id) });
  if(n===1){ io.say(L[0],pk(io,LN.END_PARTY.alone)); }
  else {
    const a=byArch(L,['muhtar','dede','demirci','emmi'])||L[0]; const b=L.find(p=>p!==a&&['delikanli','deli','coban','kahveci'].includes(p.arch))||L.find(p=>p!==a);
    io.say(a,pk(io,LN.END_PARTY.nufus));
    io.say(b,pk(io,LN.END_PARTY.artir));
    const c=L.find(p=>p!==a&&p!==b)||a;
    io.ev({ t:'party', step:'slap', by:c.id, to:b.id });
    io.say(c,pk(io,LN.END_PARTY.slap)); io.sfx('laugh');
    if(n>=5){ const d=L.find(p=>p!==a&&p!==b&&p!==c)||a; io.say(d,pk(io,LN.END_PARTY.big)); }
    else if(n>=3){ const d=L.find(p=>p!==a&&p!==b&&p!==c)||a; io.say(d,pk(io,LN.END_PARTY.small)); }
  }
  io.ev({ t:'party', step:'dance', halay:n>=5 });
  io.say(L[0],pk(io,LN.END_PARTY.dance));
  io.narr('Son vampir de gitti. Köy kurtuldu!');
}
