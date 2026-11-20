// Odalı oyun stres testi: 1-3 insan + botlar, rastgele eylemler; zamanlayıcılar sanal.
// node test/mp-sim.mjs [oyun sayısı]
const MP=await import('../src/multi.js'); const N=+(process.argv[2]||200);
const evc={}; const ends={}; let errs=0; const R=Math.random; const pk=(a)=>a[Math.floor(R()*a.length)];
for(let gi=0;gi<N;gi++){ const humans=1+(gi%3), botsN=3+(gi%13); const n=Math.min(16,humans+botsN); const instant=gi%2===0;
 const S={ code:'T', hostId:'p0', players:[...Array(n)].map((_,i)=>({ id:i<humans?'p'+i:'bot_'+i, name:(i<humans?'İnsan':'Bot')+i, alive:true, connected:true, gender:i%3===0?'f':'m', bot:i>=humans, level:['kolay','orta','zor'][i%3] })), settings:{ discussionSec:60, voteSec:30, cast:'mixed', extras:gi%5!==0, events:gi%7!==0 }, log:[] };
 const Q=[]; const ctx={ instant, broadcast(){}, armTimer(end,fn){ ctx._t=fn; }, clearTimer(){ ctx._t=null; }, later(ms,fn){ Q.push(fn); } };
 const H=(a)=>MP.hostHandle(S,a,ctx); const fire=()=>{ if(ctx._t){ const f=ctx._t; ctx._t=null; f(); return true; } return false; };
 MP.newGameFields(S); MP.hostStart(S); const seen=new Set(); let guard=0, lastAct=-1;
 const awayId=gi%4===3&&humans>1?'p1':null;
 try{ while(S.phase!=='end'&&guard++<30000){ const al=S.players.filter(p=>p.alive); const hs=al.filter(p=>!p.bot&&p.id!==awayId); const dead=S.players.filter(p=>!p.alive&&!p.bot&&p.role);
  if(S.evs) for(const e of S.evs) seen.add(e);
  if(awayId){ const p=S.players.find(x=>x.id===awayId); p.seen=Date.now()-60000; MP.hostTick(S,ctx); }
  if(S.gate){ // sahne izleniyor: bazıları hazır der, bazen süre dolar
    if(R()<.7){ for(const p of S.players.filter(x=>!x.bot&&x.id!==awayId)) H({type:'ready',from:p.id,act:S.gate?.act}); } else fire(); continue; }
  if(Q.length&&R()<.8){ Q.splice(Math.floor(R()*Q.length),1)[0](); continue; }
  // hayaletler ve tepkiler araya girer
  for(const g of dead) if(R()<.15) H({type:'ghost',from:g.id,kind:pk(['bet','tomato','rattle','whisper']),target:pk(al).id});
  for(const h of hs) if(R()<.1) H({type:'react',from:h.id,k:pk(['yuh','hah','vallahi','hadi','helal'])});
  switch(S.phase){ case 'roles': for(const p of S.players) if(p.id!==awayId) H({type:'ackRole',from:p.id}); break;
   case 'opening': MP.hostNext(S,ctx); break;
   case 'dawn': { for(const h of hs) if(S.clues.length&&R()<.7) H({type:'inspect',from:h.id,clue:pk(S.clues).id}); MP.hostNext(S,ctx); break; }
   case 'discussion': { for(const h of hs) if(R()<.6){ const t=al.filter(x=>x!==h); const k=pk(['accuse','defend','press','ally','calm','oath','claimBekci','gossip']); H({type:'talk',from:h.id,kind:k,target:pk(t).id,out:R()<.5,reason:pk(['night','quiet','pushed','gut','clue','lie','alibi','seer','vouch','accuser'])}); h._lastTalk=0; }
     if(Q.length){ Q.shift()(); break; } if(R()<.5) fire(); else MP.hostNext(S,ctx); break; }
   case 'verdict': MP.hostNext(S,ctx); break;
   case 'select': for(const p of hs){ const t=(S.duel?al.filter(x=>S.duel.includes(x.id)):al).filter(x=>x!==p); if(t.length) H({type:'select',from:p.id,target:pk(t).id}); if(S.phase!=='select') break; } if(S.phase==='select'){ if(Q.length) Q.shift()(); else if(R()<.5) fire(); else MP.hostNext(S,ctx); } break;
   case 'defense': { const acc=S.players.find(p=>p.id===S.accused); if(acc.bot||acc.id===awayId){ if(Q.length) Q.shift()(); else if(!fire()) MP.hostNext(S,ctx); break; }
     if(S.defStep===1) H({type:'defense',from:acc.id,key:pk(['witness','blame','role','oath','beg','threat','silent']),target:al.find(x=>x!==acc).id,role:pk(['koylu','doktor','kahin','bekci','aga','deli'])});
     else if(S.defStep===2) H({type:'defense',from:acc.id,i:Math.floor(R()*3)}); else if(S.defStep===3) H({type:'defense',from:acc.id,key:'warn'}); break; }
   case 'final': for(const p of hs) if(p.id!==S.accused){ if(R()<.3) H({type:'intervene',from:p.id,kind:R()<.5?'support':'refute'}); H({type:'final',from:p.id,v:R()<.7?'hang':'release'}); if(S.phase!=='final') break; } if(S.phase==='final'){ if(Q.length) Q.shift()(); else if(R()<.5) fire(); else MP.hostNext(S,ctx); } break;
   case 'night': { for(const p of hs){ let g=0,k; while(S.phase==='night'&&(k=MP.nightNeed(S,p))&&g++<4){ const t=al.filter(x=>x!==p&&!(p.role==='vampir'&&x.role==='vampir')); const opt=['bite2','plant','watch'].includes(k); const before=k; H({type:'night',from:p.id,k,target:(opt&&R()<.3)||!t.length?'__none':pk(t).id}); if(MP.nightNeed(S,p)===before&&g>2) break; } if(S.phase!=='night') break; }
     if(S.phase==='night'){ if(Q.length) Q.shift()(); else if(R()<.5) fire(); else MP.hostNext(S,ctx); } break; }
   default: throw new Error(S.phase); }
  }
  if(S.evs) for(const e of S.evs) seen.add(e);
  if(S.phase!=='end'){ errs++; console.log('bitmedi', gi, S.phase, S.defStep, 'gate', !!S.gate, 'Q', Q.length); }
  else { const A=(await import('../src/rules.js')).awards(S.tally,S.players); if(!Array.isArray(A)) throw new Error('ödül'); }
 }catch(e){ errs++; console.log('HATA', gi, S.phase, e.message, e.stack.split('\n').slice(1,4).join(' | ')); }
 ends[S.winner]=(ends[S.winner]||0)+1;
 for(const e of seen){ const k=e.t+(e.step?':'+e.step:'')+(e.t==='event'?':'+e.k:''); evc[k]=(evc[k]||0)+1; } }
console.log('hata/bitmeyen', errs, JSON.stringify(ends)); console.log(JSON.stringify(evc));
