// Her seviyeyi N kez makul bir "insan politikası" ile oynatır; kazanma oranı ve hata raporu.
import { SoloGame, LEVELS, makeRng } from '../src/solo-engine.js';

const N = +(process.argv[2]||300);

function policy(g, r){
  const h=g.human;
  const crowd=(cands)=>{ let best=null,bs=-1e9; for(const c of cands){ let s=0,n=0; for(const b of g.alive()) if(b!==c&&!b.human){ s+=(b.sus[c.id]||0); n++; } s=n?s/n:0; s+=r()*.3; if(s>bs){bs=s;best=c;} } return best; };
  while(g.phase!=='end'){
    if(g.phase==='roles'){ g.ackRole(); continue; }
    if(g.phase==='night'){
      if(!g.needs){ throw new Error('night without needs'); }
      const cands=g.needs.cands.map(id=>g.P(id));
      let t;
      if(g.needs.type==='vamp'){ t=cands.find(p=>p.claimed==='kahin')||cands.find(p=>p.claimed==='doktor')||r.pick(cands); }
      else if(g.needs.type==='doktor'){ t=cands.find(p=>p.claimed==='kahin'&&p!==h); if(!t){ let best=null,bs=0; for(const c of cands){ const acc=(c.accuseCount||0); if(acc>bs){bs=acc;best=c;} } t=best||(r.chance(.5)?h:r.pick(cands)); } }
      else { t=crowd(cands)||r.pick(cands); }
      g.nightAction(t.id); continue;
    }
    if(g.phase==='dawn'){ g.startTalk(); continue; }
    if(g.phase==='talk'){
      const opts=g.humanOptions();
      const al=g.alive().filter(p=>p!==h);
      if(h.role==='kahin'){ const known=Object.entries(h.knows).find(([id,v])=>v===true&&g.P(id).alive); if(known&&h.claimed!=='kahin'){ g.talkAction({type:'claimSeer',target:known[0],isVamp:true}); continue; } }
      if(h.role==='vampir'){ const cands=al.filter(p=>p.role!=='vampir'); const t=crowd(cands)||r.pick(cands); if(r.chance(.6)) g.talkAction({type:'accuse',target:t.id}); else g.talkAction({type:'quiet'}); continue; }
      const t=crowd(al); if(t && r.chance(.7)) g.talkAction({type:'accuse',target:t.id}); else g.talkAction({type:'quiet'});
      continue;
    }
    if(g.phase==='vote'){
      const al=g.alive().filter(p=>p!==h);
      let t;
      if(h.role==='kahin'){ const known=Object.entries(h.knows).find(([id,v])=>v===true&&g.P(id).alive); if(known) t=g.P(known[0]); }
      if(h.role==='vampir'){ const cands=al.filter(p=>p.role!=='vampir'); t=crowd(cands)||r.pick(cands); }
      if(!t) t=crowd(al);
      g.vote(t?t.id:'skip'); continue;
    }
    if(g.phase==='verdict'){ g.nextNight(); continue; }
    throw new Error('unknown phase '+g.phase);
  }
}

let totalErr=0;
console.log('lvl  role     n  iq   win%  obj%  3★%  avgDays');
for(const L of LEVELS){
  let wins=0,obj=0,three=0,days=0,err=0;
  for(let i=0;i<N;i++){
    const r=makeRng(L.id*100003+i*7919+1);
    const g=new SoloGame(L,{rng:r});
    try{ policy(g,r); }catch(e){ err++; if(err<3) console.error('L'+L.id, e.stack.split('\n').slice(0,3).join(' | ')); continue; }
    const res=g.result; if(res.won) wins++; if(res.objOk) obj++; if(res.stars===3) three++; days+=res.days;
  }
  totalErr+=err;
  console.log(String(L.id).padStart(3), L.role.padEnd(7), String(L.players).padStart(3), L.iq.toFixed(2), (100*wins/N).toFixed(0).padStart(5), (100*obj/N).toFixed(0).padStart(5), (100*three/N).toFixed(0).padStart(4), (days/N).toFixed(1).padStart(8), err?('  ERR='+err):'');
}
console.log(totalErr?`HATA: ${totalErr}`:'Hata yok');
