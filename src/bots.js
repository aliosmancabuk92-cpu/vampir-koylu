/* =====================================================================
   ODALI OYUN BOTLARI — anlatıcının (host) cihazında çalışan akıl
   Her bot herkese bir şüphe puanı tutar; konuşmaları, iddiaları, oyları ve
   infaz sonuçlarını izleyerek günceller. Zorluk: kolay · orta · zor.
   ===================================================================== */
import * as LN from './lines.js';

export const BOT_LEVELS={ kolay:{ iq:.25, label:'Kolay' }, orta:{ iq:.5, label:'Orta' }, zor:{ iq:.82, label:'Zor' } };
const PERS=[ { talk:.75, aggr:.6, herd:.5, logic:.5 }, { talk:.45, aggr:.3, herd:.75, logic:.4 }, { talk:.85, aggr:.85, herd:.3, logic:.55 }, { talk:.55, aggr:.45, herd:.4, logic:.85 }, { talk:.6, aggr:.5, herd:.6, logic:.65 } ];
export const BOT_NAMES=['Mehmet','Mustafa','Hasan','Kerem','Burak','Emre','Yusuf','Oğuz','Tolga','Baran','Umut','Ahmet','İsmail','Hüseyin','Osman','Recep','Cemal','Halil','Rıfat','Şükrü','Veli','Yakup','Kadir','Nuri','Ramazan','Bekir','Fikri','Hamdi'];
export const BOT_NAMES_F=['Ayşe','Fatma','Emine','Hatice','Zeynep','Elif','Gülsüm','Hacer','Şerife','Döndü','Nazlı','Sevim'];

const R=Math.random; const pickR=(a)=>a[Math.floor(R()*a.length)]; const chance=(p)=>R()<p;
const shuffle=(a)=>{ a=[...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(R()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const B=new Map();
const alive=(S)=>S.players.filter(p=>p.alive);
const P=(S,id)=>S.players.find(p=>p.id===id);
export const isBot=(p)=>!!(p&&p.bot);
export function brain(p){ let b=B.get(p.id); if(!b){ const lv=BOT_LEVELS[p.level]||BOT_LEVELS.orta; b={ iq:lv.iq, pers:pickR(PERS), sus:{}, knows:{}, cred:{}, spoke:0, claimedSeer:false }; B.set(p.id,b); } return b; }
const sus=(b,id)=>b.sus[id]||0;
const add=(b,id,v)=>{ b.sus[id]=(b.sus[id]||0)+v; };
const bots=(S)=>alive(S).filter(isBot);

/** yeni oyun: beyinleri sıfırla, vampir botlar takım arkadaşını bilir */
export function botsReset(S){ B.clear();
  for(const p of S.players) if(isBot(p)){ const b=brain(p); for(const q of S.players) if(q!==p) b.sus[q.id]=0;
    if(p.role==='vampir') for(const q of S.players) if(q!==p&&q.role==='vampir') b.knows[q.id]=true; } }

/** gözlemler: konuşma, iddia, sonuç */
export function botsObserve(S,o){
  for(const p of bots(S)){ const b=brain(p); if(p.id===o.from) continue;
    switch(o.t){
      case 'accuse': { if(p.id===o.to){ add(b,o.from,1.1); break; }
        if(b.knows[o.to]===true){ if(p.role!=='vampir') add(b,o.from,-0.5); else add(b,o.from,0.8); break; }
        if(b.knows[o.to]===false){ add(b,o.from,0.7*b.pers.logic); break; }
        add(b,o.to,(o.pow??1)*(0.5+b.pers.herd*0.8)*(1-Math.max(-0.5,Math.min(0.8,sus(b,o.from)*0.25)))); add(b,o.from,0.1*b.pers.logic); break; }
      case 'defend': { if(p.id===o.to){ add(b,o.from,-0.6); break; } if(b.knows[o.to]===true&&p.role!=='vampir'){ add(b,o.from,1.3*b.pers.logic); break; } add(b,o.to,-0.6*(o.pow??1)); break; }
      case 'claimSeer': { if(p.role==='vampir') break; if(p.role==='kahin'){ add(b,o.from,4); break; }
        const trust=1-Math.max(-0.5,Math.min(0.9,sus(b,o.from)*0.3)); if(p.id===o.to){ add(b,o.from,o.isVamp?2:-0.5); break; } add(b,o.to,(o.isVamp?2.4:-1.4)*trust); if(o.counter) add(b,o.from,0.6*b.pers.logic); break; }
      case 'claimDoctor': { if(p.role==='doktor'){ add(b,o.from,3); break; } if(p.role!=='vampir') add(b,o.from,-0.6); break; }
      case 'self': { add(b,o.who,o.v*(0.6+b.pers.logic*0.5)); break; }
      case 'hanged': { if(o.role==='vampir'){ for(const id of o.accusers||[]) add(b,id,-0.6); for(const id of o.defenders||[]) add(b,id,1.4*b.pers.logic); }
        else { for(const id of o.accusers||[]) add(b,id,1.0*b.pers.logic); for(const id of o.voters||[]) add(b,id,0.25*b.pers.logic); for(const id of o.defenders||[]) add(b,id,-0.3); }
        for(const k in b.sus) b.sus[k]*=0.85; break; }
      case 'killed': { for(const id of o.accusersOfVictim||[]) add(b,id,-0.2); break; }
    } } }

/** kâhin bot gece sonucunu öğrenir */
export function botSeerResult(p,target,isVamp){ brain(p).knows[target]=isVamp; add(brain(p),target,isVamp?5:-4); }

const accuseLine=(S,b,t,today)=>{ let rs=null; if(today&&!today.has(t.id)&&chance(.45)) rs='quiet'; else if((S.prevAccusers||[]).includes(t.id)&&chance(.6)) rs='pushed'; else if(chance(.3)) rs=chance(.5)?'night':'gut';
  return rs?LN.fillT(LN.pick(LN.ACCUSE_WHY[rs]),{t:t.name}):LN.fillT(LN.pick(LN.ACCUSE),{t:t.name},true); };

/** tartışmada bir botun konuşması → { say:[ [player,text,kind] ], obs:[...] } */
export function botTalk(S,p,today){
  const b=brain(p); const others=alive(S).filter(x=>x!==p); const out={ say:[], obs:[] }; if(!others.length) return out;
  if(p.arch==='kufurbaz' && chance(.4)) out.say.push([p,LN.pick(LN.KUFURBAZ)]);
  // kâhin: vampir bulduysa açıklar
  if(p.role==='kahin'){ const f=Object.entries(b.knows).find(([id,v])=>v===true&&P(S,id)?.alive); if(f && (!b.claimedSeer||chance(.4))){ const t=P(S,f[0]); b.claimedSeer=true; p.claimed='kahin';
      out.say.push([p,LN.fillT(LN.pick(LN.SEER_VAMP),{t:t.name},true)]); out.obs.push({ t:'claimSeer', from:p.id, to:t.id, isVamp:true }); return out; } }
  if(p.role==='vampir'){
    const claim=alive(S).find(x=>x.claimed==='kahin'&&x!==p&&(x.lastSeerTarget&&P(S,x.lastSeerTarget)?.role==='vampir'));
    if(claim && chance(.35+b.iq*0.4)){ const t=pickR(others.filter(x=>x.role!=='vampir'&&x!==claim))||claim; out.say.push([p,LN.fillT(LN.pick(LN.COUNTER_SEER),{t:claim.name},true)]); out.obs.push({ t:'accuse', from:p.id, to:claim.id, pow:1.2 }); return out; }
    const inno=others.filter(x=>x.role!=='vampir'); const herd=inno.map(x=>[x,bots(S).reduce((a,o)=>a+(o!==p?sus(brain(o),x.id):0),0)]).sort((a,c)=>c[1]-a[1])[0];
    if(herd && chance(.55+b.iq*0.2)){ const t=herd[0]; out.say.push([p,accuseLine(S,b,t,today)]); out.obs.push({ t:'accuse', from:p.id, to:t.id }); return out; }
    out.say.push([p,LN.pick(LN.QUIET),'quiet']); return out; }
  const ranked=others.map(x=>[x,sus(b,x.id)+(R()-.5)*(1.2-b.iq)]).sort((a,c)=>c[1]-a[1]); const [top,ts]=ranked[0];
  if(ts>0.5 && chance(b.pers.aggr*0.8+0.15)){ out.say.push([p,accuseLine(S,b,top,today)]); out.obs.push({ t:'accuse', from:p.id, to:top.id }); return out; }
  const inn=others.find(x=>sus(b,x.id)<-0.6); if(inn && chance(.5)){ out.say.push([p,LN.fillT(LN.pick(LN.DEFEND),{t:inn.name})]); out.obs.push({ t:'defend', from:p.id, to:inn.id }); return out; }
  out.say.push([p,LN.pick(LN.QUIET),'quiet']); return out;
}
/** insan konuştuktan sonra 1-2 botun tepkisi */
export function botReactions(S,speaker,target,sign,truth){
  const out=[]; const rs=shuffle(bots(S).filter(x=>x!==target&&x!==speaker)).slice(0,chance(.5)?2:1);
  for(const p of rs){ const b=brain(p); const s=sus(b,target.id)*sign; const agree=truth===false?false:(truth===true?s>-0.6:s>0.2); out.push([p,LN.pick(agree?LN.AGREE:LN.OBJECT)]); }
  return out; }
/** ikna göstergesi */
export function botStance(S,target,sign){ const m={}; for(const p of bots(S)){ if(p===target) continue; const s=sus(brain(p),target.id)*sign; m[p.id]=s>0.7?'👍':s<-0.25?'👎':'🤔'; } return m; }
/** sıkıştırılan botun cevabı */
export function botPressed(S,p){ if(p.role==='vampir'){ const b=brain(p); return chance(0.35+b.iq*0.45)?'good':(chance(.6)?'bad':'angry'); } return chance(.8)?'good':'angry'; }
export function botAlly(S,p,from){ const b=brain(p); const ok=sus(b,from.id)<0.6 && (p.role==='vampir'?(from.role==='vampir'||chance(.7)):chance(.75-sus(b,from.id)*0.4)); if(ok){ b.ally=from.id; add(b,from.id,-1.2); } return ok; }
export function botWitness(S,p,acc){ const b=brain(p); return p.role==='vampir'?(acc.role==='vampir'||chance(.5)):(sus(b,acc.id)<0.5&&chance(.8)); }

/** ev seçimi */
export function botSelect(S,p,tally){ const b=brain(p); const others=alive(S).filter(x=>x!==p); let c=p.role==='vampir'?others.filter(x=>x.role!=='vampir'):others; if(b.ally){ const f=c.filter(x=>x.id!==b.ally); if(f.length) c=f; }
  let best=null, bs=-1e9; for(const x of c){ const s=sus(b,x.id)+(tally[x.id]||0)*b.pers.herd*0.7+(R()-.5)*(1.4-b.iq)+(p.role==='vampir'?(tally[x.id]||0)*0.8:0); if(s>bs){ bs=s; best=x; } } return best; }
/** sanık bot kendini savunur → [ [player,text,kind] ], obs */
export function botDefense(S,acc){ const b=brain(acc); const others=alive(S).filter(x=>x!==acc); const out={ say:[], obs:[] };
  if(acc.role==='kahin'){ const f=Object.entries(b.knows).find(([id,v])=>v===true&&P(S,id)?.alive); if(f){ const t=P(S,f[0]); out.say.push([acc,LN.regSpoken(`Ben kâhinim la! ${t.name} VAMPİR! Beni değil onu asın!`,'Ben kâhinim la! Bu herif VAMPİR! Beni değil onu asın!')]); out.obs.push({ t:'claimSeer', from:acc.id, to:t.id, isVamp:true }); return out; } }
  if(acc.role==='doktor' && chance(.7)){ out.say.push([acc,'Ben doktorum! Beni asarsanız geceleri kimse korunmaz!']); out.obs.push({ t:'claimDoctor', from:acc.id }); return out; }
  const t=acc.role==='vampir'?(pickR(others.filter(x=>x.role!=='vampir'))||others[0]):others.map(x=>[x,sus(b,x.id)]).sort((a,c)=>c[1]-a[1])[0]?.[0];
  if(t){ out.say.push([acc,LN.fillT(LN.pick(LN.DEFENSE_BOT),{o:t.name})]); if(chance(.5)) out.obs.push({ t:'accuse', from:acc.id, to:t.id, pow:0.7 }); }
  out.obs.push({ t:'self', who:acc.id, v:-0.3 }); return out; }
/** son oy */
export function botFinal(S,p,acc,hangs,eligible){ const b=brain(p);
  if(p.role==='vampir'){ if(acc.role==='vampir') return (hangs>eligible/2&&chance(b.iq))?'hang':'release'; return 'hang'; }
  if(b.ally===acc.id) return 'release';
  const s=sus(b,acc.id)+(S.selTally?.[acc.id]||0)/Math.max(1,alive(S).length)*b.pers.herd*1.5+(R()-.5)*(1.2-b.iq);
  return s>0.15?'hang':'release'; }
/** gece */
export function botNight(S,p){ const b=brain(p); const al=alive(S);
  if(p.role==='vampir'){ const c=al.filter(x=>x.role!=='vampir'); if(!c.length) return null; let best=null,bs=-1e9; for(const x of c){ let s=(x.claimed==='kahin'?2:0)+(x.claimed==='doktor'?1:0)-sus(b,x.id)*0.3+R()*(1.6-b.iq); for(const o of bots(S)) if(o.role!=='vampir') s+=sus(brain(o),x.id)<0?0.15:0; if(s>bs){ bs=s; best=x; } } return best; }
  if(p.role==='doktor'){ const c=al; const seer=c.find(x=>x.claimed==='kahin'&&sus(b,x.id)<0.5); if(seer&&chance(.6)) return seer; return chance(.35)?p:pickR(c.filter(x=>sus(b,x.id)<0.5))||p; }
  if(p.role==='kahin'){ const c=al.filter(x=>x!==p&&b.knows[x.id]===undefined); if(!c.length) return null; return c.map(x=>[x,sus(b,x.id)+R()*(1.2-b.iq)]).sort((a,c2)=>c2[1]-a[1])[0][0]; }
  return null; }
