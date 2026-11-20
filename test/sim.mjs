// Her seviyeyi N kez makul bir "insan politikası" ile oynatır; kazanma oranı ve hata raporu.
import { SoloGame, LEVELS, makeRng } from '../src/solo-engine.js';

const N = +(process.argv[2]||300);

function policy(g, r){
  const h=g.human; let guard=0;
  const crowd=(cands)=>{ let best=null,bs=-1e9; for(const c of cands){ let s=0,n=0; for(const b of g.alive()) if(b!==c&&!b.human){ s+=(b.sus[c.id]||0); n++; } s=n?s/n:0; if(g.clues.some(x=>x.ids.includes(c.id))) s+=0.4; s+=r()*.3; if(s>bs){bs=s;best=c;} } return best; };
  while(g.phase!=='end'){
    if(guard++>600) throw new Error('döngü: '+g.phase+' '+JSON.stringify(g.needs));
    if(g.phase==='roles'){ g.ackRole(); continue; }
    if(g.phase==='night'){
      if(!g.needs){ throw new Error('night without needs'); }
      const n=g.needs; const cands=n.cands.map(id=>g.P(id)); let t;
      if(n.type==='vamp'){ t=cands.find(p=>p.claimed==='kahin')||cands.find(p=>p.claimed==='bekci')||cands.find(p=>p.claimed==='doktor')||r.pick(cands); }
      else if(n.type==='plant'){ t=r.chance(.6)?r.pick(cands):null; }
      else if(n.type==='doktor'){ t=cands.find(p=>p.claimed==='kahin'&&p!==h); if(!t){ let best=null,bs=0; for(const c of cands){ const acc=(c.accuseCount||0); if(acc>bs){bs=acc;best=c;} } t=best||(r.chance(.5)?h:r.pick(cands)); } }
      else if(n.type==='watch'){ t=r.chance(.8)?(crowd(cands)||r.pick(cands)):null; }
      else { t=crowd(cands)||r.pick(cands); }
      g.nightAction(t?t.id:null); continue;
    }
    if(g.phase==='dawn'){ if(h.alive && g.clues.length) g.inspect(r.pick(g.clues).id); if(!h.alive){ if(!g.ghost.bet) g.ghostBet(r.pick(g.alive()).id); if(r.chance(.3)) g.ghostWhisper(r.pick(g.aliveBots()).id); if(r.chance(.3)) g.ghostPrank('rattle',r.pick(g.alive()).id); } g.startTalk(); continue; }
    if(g.phase==='talk'){
      if(g.needs?.type==='answer'){ g.answer('home'); continue; }
      const al=g.alive().filter(p=>p!==h);
      const opt=(t)=>g.humanOptions().find(o=>o.type===t);
      if(h.role==='kahin'){ const known=Object.entries(h.knows).find(([id,v])=>v===true&&g.P(id).alive); if(known&&h.claimed!=='kahin'){ g.talkAction({type:'claimSeer',target:known[0],isVamp:true}); continue; } }
      if(h.role==='bekci'){ const o=opt('claimBekci'); const x=o&&o.results.find(x=>x.out&&!(h.told||(h.told=new Set())).has(x.target)); if(x){ h.told.add(x.target); g.talkAction({type:'claimBekci',target:x.target}); continue; } }
      if(opt('gossip')){ g.talkAction({type:'gossip'}); continue; }
      if(h.role==='deli'){ const t=r.pick(al); if(r.chance(.7)) g.talkAction({type:'accuse',target:t.id,reason:'gut'}); else g.talkAction({type:'quiet'}); continue; }
      if(h.role==='vampir'){ const cands=al.filter(p=>p.role!=='vampir'); const t=crowd(cands)||r.pick(cands); if(r.chance(.6)) g.talkAction({type:'accuse',target:t.id}); else g.talkAction({type:'quiet'}); continue; }
      const ev=Object.entries(g.evidence).find(([id,v])=>v==='out'&&g.P(id).alive);
      if(ev){ g.talkAction({type:'accuse',target:ev[0],reason:'night'}); continue; }
      const t=crowd(al); if(t && r.chance(.7)) g.talkAction({type:'accuse',target:t.id,reason:g.clues.some(c=>c.ids.includes(t.id))?'clue':undefined}); else g.talkAction({type:'quiet'});
      continue;
    }
    if(g.phase==='select'){
      const al=g.needs.cands.map(id=>g.P(id)); let t;
      if(h.role==='kahin'){ const known=Object.entries(h.knows).find(([id,v])=>v===true&&al.some(p=>p.id===id)); if(known) t=g.P(known[0]); }
      if(!t){ const ev=Object.entries(g.evidence).find(([id,v])=>v==='out'&&al.some(p=>p.id===id)); if(ev&&h.role!=='vampir') t=g.P(ev[0]); }
      if(h.role==='vampir'){ const cands=al.filter(p=>p.role!=='vampir'); t=crowd(cands)||r.pick(cands.length?cands:al); }
      if(!t) t=crowd(al)||r.pick(al);
      g.selectHouse(t.id); continue;
    }
    if(g.phase==='defense'){
      if(g.needs.step===2){ g.defend(h.role==='deli'?'2':'0'); continue; } if(g.needs.step===3){ g.defend('warn'); continue; }
      if(h.role==='deli') g.defend('threat');
      else if(h.role==='kahin' && Object.values(h.knows).some(v=>v)) g.defend('role');
      else if(['doktor','bekci','aga'].includes(h.role)) g.defend('role');
      else { const al=g.alive().filter(p=>p!==h && (h.role!=='vampir'||p.role!=='vampir')); const t=crowd(al); if(t&&r.chance(.5)) g.defend('blame',t.id); else g.defend('witness'); }
      continue;
    }
    if(g.phase==='final'){
      const acc=g.P(g.accused); let v;
      if(h.role==='vampir') v = acc.role==='vampir'?'release':'hang';
      else if(h.knows[acc.id]!==undefined) v = h.knows[acc.id]?'hang':'release';
      else if(g.evidence[acc.id]==='out') v='hang';
      else { let s=0,n=0; for(const b of g.aliveBots()) if(b!==acc){ s+=b.sus[acc.id]||0; n++; } v = (n?s/n:0)>0.2 || r.chance(.4) ? 'hang':'release'; }
      g.finalVote(v); continue;
    }
    if(g.phase==='verdict'){ if(!h.alive){ if(r.chance(.4)) g.ghostPrank('tomato',r.pick(g.alive()).id); if(r.chance(.2)) g.ghostWhisper(r.pick(g.aliveBots()).id); } g.nextNight(); continue; }
    throw new Error('unknown phase '+g.phase);
  }
}

let totalErr=0; const W={};
console.log('lvl  role     n  iq   win%  obj%  3★%  avgDays');
for(const L of LEVELS){
  let wins=0,obj=0,three=0,days=0,err=0,dw=0,vw=0;
  for(let i=0;i<N;i++){
    const r=makeRng(L.id*100003+i*7919+1);
    const g=new SoloGame(L,{rng:r});
    try{ policy(g,r); }catch(e){ err++; if(err<3) console.error('L'+L.id, e.stack.split('\n').slice(0,3).join(' | ')); continue; }
    const res=g.result; W[g.winner]=(W[g.winner]||0)+1; if(g.winner==='deli') dw++; if(g.winner==='vampir') vw++; if(res.won) wins++; if(res.objOk) obj++; if(res.stars===3) three++; days+=res.days;
  }
  totalErr+=err;
  console.log(String(L.id).padStart(3), L.role.padEnd(7), String(L.players).padStart(3), L.iq.toFixed(2), (100*wins/N).toFixed(0).padStart(5), (100*obj/N).toFixed(0).padStart(5), (100*three/N).toFixed(0).padStart(4), (days/N).toFixed(1).padStart(8), ' deli%',(100*dw/N).toFixed(0).padStart(3),' vamp%',(100*vw/N).toFixed(0).padStart(3), err?('  ERR='+err):'');
}
console.log('kazananlar:',W); console.log(totalErr?`HATA: ${totalErr}`:'Hata yok');
