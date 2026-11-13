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
    const walk=(v)=>{ if(typeof v==='string'){ if(/\{\w+/.test(v)){ for(const role of ['doktorum','kâhinim','köylüyüm']) add(LN.fillSpoken(v,NEG.has(name),{role})); } else add(v); }
      else if(Array.isArray(v)) v.forEach(walk); else if(v&&typeof v==='object'){ if('h' in v&&'s' in v){ walk(hard?v.h:v.s); } else if('text' in v){ walk(v.text); } else for(const k of Object.keys(v)) walk(v[k]); } };
    walk(pool); }
  for(const l of LN.LOCK) for(const p of ['AS','BIRAK']) add(`${p}! ${typeof l==='string'?l:(hard?l.h:l.s)}`);
}
// 2) Oyunları oynat, gerçekten üretilen sesli metinleri topla
function play(g,r){
  let guard=0;
  while(g.phase!=='end' && guard++<400){
    const h=g.human, al=g.alive().filter(p=>p!==h);
    switch(g.phase){
      case 'roles': g.ackRole(); break;
      case 'night': { const c=g.needs.cands; g.nightAction(c[Math.floor(r()*c.length)]); break; }
      case 'dawn': g.startTalk(); break;
      case 'talk': { const o=g.humanOptions(); const pick=o[Math.floor(r()*o.length)]; const t=al[Math.floor(r()*al.length)];
        if(pick.type==='claimSeer'){ const x=pick.results[Math.floor(r()*pick.results.length)]; g.talkAction({type:'claimSeer',target:x.target,isVamp:x.isVamp}); }
        else if(pick.type==='accuse'||pick.type==='defend') g.talkAction({type:pick.type,target:t.id}); else g.talkAction({type:pick.type}); break; }
      case 'select': { const c=g.needs.cands; g.selectHouse(c[Math.floor(r()*c.length)]); break; }
      case 'defense': { const keys=g.needs.options.map(o=>o.key); const k=keys[Math.floor(r()*keys.length)]; if(k==='blame'){ const t=g.needs.targets; g.defend('blame',t[Math.floor(r()*t.length)]); } else g.defend(k); break; }
      case 'final': g.finalVote(r()<.6?'hang':'release'); break;
      case 'verdict': g.nextNight(); break;
      default: throw new Error('faz '+g.phase);
    }
  }
}
let games=0;
for(const hard of [true,false]){ LN.setHardMode(hard);
  for(const L of LEVELS) for(const role of ['koylu','kahin','doktor','vampir']) for(let i=0;i<25;i++){
    const lvl={...L, role}; const r=makeRng(L.id*7919+i*104729+(hard?1:2)*31+role.length);
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
  for(let gi=0; gi<300; gi++){
    let seed=gi*977+(hard?3:5); const R=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; }; const pk=(a)=>a[Math.floor(R()*a.length)];
    const _rnd=Math.random; Math.random=R;
    const n=4+(gi%9); const S={ code:'TEST', hostId:'p0', players:[...Array(n)].map((_,i)=>({ id:'p'+i, name:'Oyuncu'+i, alive:true, connected:true, gender:i%3===0?'f':'m' })), settings:{ discussionSec:120, voteSec:60, cast:gi%2?'mixed':'male' }, log:[] };
    MP.newGameFields(S); MP.hostStart(S);
    const ctx={ broadcast(){}, armTimer(){}, clearTimer(){} };
    const grab=()=>{ for(const e of S.evs||[]) if((e.t==='say'||e.t==='narr') && e.kind!=='quiet') add(e.voice||e.text); };
    const H=(a)=>{ MP.hostHandle(S,a,ctx); grab(); };
    let guard=0;
    while(S.phase!=='end' && guard++<300){
      const al=S.players.filter(p=>p.alive);
      switch(S.phase){
        case 'roles': for(const p of S.players) H({type:'ackRole',from:p.id}); break;
        case 'opening': case 'discussion': case 'verdict': case 'dawn': H({type:'next',from:'p0'}); break;
        case 'select': for(const p of al){ const c=al.filter(x=>x!==p); H({type:'select',from:p.id,target:pk(c).id}); if(S.phase!=='select') break; } break;
        case 'defense': { const k=pk(['innocent','blame','role','silent']); const o=al.filter(x=>x.id!==S.accused); H({type:'defense',from:S.accused,key:k,target:pk(o).id,role:pk(['koylu','doktor','kahin'])}); break; }
        case 'final': for(const p of al){ if(p.id===S.accused) continue; H({type:'final',from:p.id,v:R()<.6?'hang':'release'}); if(S.phase!=='final') break; } if(S.phase==='final') H({type:'next',from:'p0'}); break;
        case 'night': { for(const p of al){ const c=al.filter(x=>x!==p && (p.role!=='vampir'||x.role!=='vampir')); if(['vampir','doktor','kahin'].includes(p.role) && c.length) H({type:'night',from:p.id,target:pk(c).id}); if(S.phase!=='night') break; } if(S.phase==='night') H({type:'next',from:'p0'}); break; }
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
