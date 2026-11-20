// Oyunda seslendirilebilecek tüm cümleleri topla → tools/voice-lines.json  {anahtar: metin}
import fs from 'fs';
import { SoloGame, LEVELS, makeRng } from '../src/solo-engine.js';
import * as LN from '../src/lines.js';
import { voiceKey, normVoice } from '../src/voice-key.js';
const out=new Map(); const add=(t)=>{ const s=normVoice(t); if(!s||/^[….\s]+$/.test(s)) return; out.set(voiceKey(s),s); };
// 1) Havuzlar (her iki mod)
const NEG=new Set(['ACCUSE','ACCUSE_HERD','SEER_VAMP','COUNTER_SEER','RESPONSE_DOUBT']);
for(const hard of [true,false]){ LN.setHardMode(hard);
  for(const [name,pool] of Object.entries(LN)){ if(typeof pool==='function'||name==='ARCHETYPES'||name==='NEG_POOLS') continue;
    const walk=(v)=>{ if(typeof v==='string'){ if(/\{\w+/.test(v)){ for(const role of (/\{role\}/.test(v)?['hocayım','kâhinim','köylüyüm','bekçiyim','ağayım']:[''])) add(LN.fillSpoken(v,NEG.has(name)||['BEKCI_SAW','FEUD'].includes(name),{role})); } else add(v); }
      else if(Array.isArray(v)) v.forEach(walk); else if(v&&typeof v==='object'){ if('h' in v&&'s' in v){ walk(hard?v.h:v.s); } else if('text' in v){ walk(v.text); } else for(const k of Object.keys(v)) walk(v[k]); } };
    walk(pool); }
  for(const l of LN.LOCK) for(const p of ['AS','BIRAK']) add(`${p}! ${typeof l==='string'?l:(hard?l.h:l.s)}`);
}
// 2) Oyunları oynat, gerçekten üretilen sesli metinleri topla
function play(g,r){
  let guard=0;
  while(g.phase!=='end' && guard++<600){
    const h=g.human, al=g.alive().filter(p=>p!==h);
    switch(g.phase){
      case 'roles': g.ackRole(); break;
      case 'night': { const n=g.needs, c=n.cands; g.nightAction(n.optional&&r()<.3?null:c[Math.floor(r()*c.length)]); break; }
      case 'dawn': { if(h.alive&&g.clues.length) g.inspect(g.clues[Math.floor(r()*g.clues.length)].id); if(!h.alive&&al.length){ if(r()<.4) g.ghostWhisper(al[Math.floor(r()*al.length)].id); if(r()<.5) g.ghostPrank('rattle',al[Math.floor(r()*al.length)].id); g.ghostBet(al[0].id); } g.startTalk(); break; }
      case 'talk': { if(g.needs?.type==='answer'){ const o=g.needs.options; g.answer(o[Math.floor(r()*o.length)].key); break; } const o=g.humanOptions(); const pick=o[Math.floor(r()*o.length)]; const t=al[Math.floor(r()*al.length)];
        if(pick.type==='claimBekci'){ const x=pick.results[Math.floor(r()*pick.results.length)]; g.talkAction({type:'claimBekci',target:x.target}); }
        else if(pick.type==='claimSeer'){ const x=pick.results[Math.floor(r()*pick.results.length)]; g.talkAction({type:'claimSeer',target:x.target,isVamp:x.isVamp}); }
        else if(pick.reasons) g.talkAction({type:pick.type,target:t.id,reason:pick.reasons[Math.floor(r()*pick.reasons.length)].key});
        else if(pick.targets) g.talkAction({type:pick.type,target:t.id}); else g.talkAction({type:pick.type}); break; }
      case 'select': { const c=g.needs.cands; g.selectHouse(c[Math.floor(r()*c.length)]); break; }
      case 'defense': { const keys=g.needs.options.map(o=>o.key); const k=keys[Math.floor(r()*keys.length)]; if((k==='blame'||k==='witness')&&g.needs.targets){ const t=g.needs.targets; g.defend(k,t[Math.floor(r()*t.length)]); } else g.defend(k); break; }
      case 'final': if(r()<.3) g.intervene(r()<.5?'support':'refute'); g.finalVote(r()<.6?'hang':'release'); break;
      case 'verdict': { if(!h.alive&&al.length){ if(r()<.6) g.ghostPrank('tomato',al[Math.floor(r()*al.length)].id); if(r()<.3) g.ghostWhisper(al[Math.floor(r()*al.length)].id); } g.nextNight(); break; }
      default: throw new Error('faz '+g.phase);
    }
  }
}
let games=0;
for(const hard of [true,false]){ LN.setHardMode(hard);
  for(const L of LEVELS) for(const role of ['koylu','kahin','doktor','vampir','bekci','deli','aga','dedikoducu']) for(let i=0;i<16;i++){
    const lvl={...L, role, extras:i%4?true:undefined, events:true}; const r=makeRng(L.id*7919+i*104729+(hard?1:2)*31+role.length);
    const g=new SoloGame(lvl,{ rng:r, humanName:'Ali', longIntro:i%5===0 }); play(g,r); games++;
    for(const e of g.events) if((e.t==='say'||e.t==='narr') && e.kind!=='quiet') add(e.voice||e.text);
  }
}
LN.setHardMode(true);
const obj=Object.fromEntries([...out.entries()].sort((a,b)=>a[1].localeCompare(b[1],'tr')));
fs.writeFileSync(new URL('./voice-lines.json',import.meta.url), JSON.stringify(obj,null,0));
const withNames=[...out.values()].filter(t=>/\b(Ali|Mehmet|Mustafa|Hasan|Kerem|Burak|Emre|Yusuf|Can|Oğuz|Tolga|Baran|Umut|Ahmet|İsmail|Hüseyin|Osman|Recep|Cemal|Halil|Rıfat|Şükrü|Veli|Yakup|Kadir|Nuri|Ramazan|Bekir|Fikri|Hamdi)\b/.test(t));
console.log('oyun:',games,'| benzersiz cümle:',out.size,'| isim içeren (olmamalı):',withNames.length);
withNames.slice(0,15).forEach(t=>console.log('  ⚠',t));

// 3) Odalı mod: host mantığını rastgele oyuncularla oynat
const MP=await import('../src/multi.js');
let mpGames=0;
for(const hard of [true,false]){ LN.setHardMode(hard);
  for(let gi=0; gi<320; gi++){
    let seed=gi*977+(hard?3:5); const R=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; }; const pk=(a)=>a[Math.floor(R()*a.length)];
    const _rnd=Math.random; Math.random=R;
    const n=4+(gi%13); const S={ code:'TEST', hostId:'p0', players:[...Array(n)].map((_,i)=>({ id:(i>=2&&gi%2?'bot':'p')+i, name:'Oyuncu'+i, alive:true, connected:true, gender:i%3===0?'f':'m', bot:i>=2&&gi%2===1, level:'orta' })), settings:{ discussionSec:120, voteSec:60, cast:gi%2?'mixed':'male' }, log:[] };
    MP.newGameFields(S); MP.hostStart(S);
    const Q=[]; const ctx={ instant:true, broadcast(){}, armTimer(){}, clearTimer(){}, later(ms,fn){ Q.push(fn); } };
    const grab=()=>{ for(const e of S.evs||[]) if((e.t==='say'||e.t==='narr') && e.kind!=='quiet') add(e.voice||e.text); };
    const H=(a)=>{ MP.hostHandle(S,a,ctx); grab(); };
    let guard=0;
    while(S.phase!=="end" && guard++<4000){
      const all=S.players.filter(p=>p.alive); const al=all.filter(p=>!p.bot); const dead=S.players.filter(p=>!p.alive&&!p.bot&&p.role);
      if(Q.length){ Q.shift()(); grab(); continue; }
      for(const g of dead) if(R()<.2) H({type:'ghost',from:g.id,kind:pk(['tomato','rattle','whisper','bet']),target:pk(all).id});
      for(const h of al) if(R()<.08) H({type:'react',from:h.id,k:pk(['yuh','hah','vallahi','hadi','helal'])});
      switch(S.phase){
        case 'roles': for(const p of S.players) H({type:'ackRole',from:p.id}); break;
        case 'discussion': { for(const h of al.slice(0,2)){ const o=all.filter(x=>x!==h); h._lastTalk=0; H({type:'talk',from:h.id,kind:pk(['accuse','defend','press','ally','calm','oath','claimBekci','gossip']),target:pk(o).id,out:R()<.6,reason:pk(['night','quiet','pushed','gut','lie','clue','alibi','seer','accuser','vouch'])}); } H({type:'next',from:'p0'}); break; }
        case 'opening': case 'verdict': case 'dawn': H({type:'next',from:'p0'}); break;
        case 'select': { for(const p of al){ const c=(S.duel?all.filter(x=>S.duel.includes(x.id)):all).filter(x=>x!==p); if(c.length) H({type:'select',from:p.id,target:pk(c).id}); if(S.phase!=='select') break; } if(S.phase==='select'&&!Q.length) H({type:'next',from:'p0'}); break; }
        case 'defense': { const acc=S.players.find(x=>x.id===S.accused); if(acc.bot){ H({type:'next',from:'p0'}); break; } const o=all.filter(x=>x.id!==S.accused);
          if(S.defStep===2) H({type:'defense',from:S.accused,i:Math.floor(R()*3)}); else if(S.defStep===3) H({type:'defense',from:S.accused,key:pk(['regret','warn','forgive'])});
          else H({type:'defense',from:S.accused,key:pk(['witness','blame','role','oath','beg','threat','silent']),target:pk(o).id,role:pk(['koylu','doktor','kahin','bekci','aga'])}); break; }
        case 'final': for(const p of al){ if(p.id===S.accused) continue; if(R()<.3) H({type:'intervene',from:p.id,kind:pk(['support','refute'])}); H({type:'final',from:p.id,v:R()<.6?'hang':'release'}); if(S.phase!=='final') break; } if(S.phase==='final'&&!Q.length) H({type:'next',from:'p0'}); break;
        case 'night': { for(const p of al){ let g=0,k; while(S.phase==='night'&&(k=MP.nightNeed(S,p))&&g++<4){ const c=all.filter(x=>x!==p && (p.role!=='vampir'||x.role!=='vampir')); H({type:'night',from:p.id,k,target:c.length?pk(c).id:'__none'}); } if(S.phase!=='night') break; } if(S.phase==='night'&&!Q.length) H({type:'next',from:'p0'}); break; }
        default: H({type:'next',from:'p0'});
      }
    }
    Math.random=_rnd; mpGames++;
  }
}
LN.setHardMode(true);
const obj2=Object.fromEntries([...out.entries()].sort((a,b)=>a[1].localeCompare(b[1],'tr')));
fs.writeFileSync(new URL('./voice-lines.json',import.meta.url), JSON.stringify(obj2,null,0));
const named2=[...out.values()].filter(t=>/Oyuncu\d/.test(t));
console.log('odalı oyun:',mpGames,'| toplam benzersiz cümle:',out.size,'| isim içeren:',named2.length); named2.slice(0,10).forEach(t=>console.log('  ⚠',t));
