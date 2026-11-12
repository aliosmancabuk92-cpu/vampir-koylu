/* =====================================================================
   KÖY SAHNESİ — SVG, evler + meydan + dar ağacı + kazık + figürler
   ===================================================================== */
const W=400, H=560;
const SLOTS = [ [62,150],[140,118],[260,118],[338,150], [42,250],[358,250], [42,352],[358,352], [80,456],[165,478],[235,478],[320,456] ];
const ORDER = [0,3,4,5,8,11,1,2,6,7,9,10];
const SQUARE = {x:200,y:330};
const GALLOWS = {x:150,y:262};  // zemin noktası
const STAKES  = [[268,262],[294,262],[320,262]];
const HANG_SLOTS=[[134,250],[150,250],[166,250]];
const CROWD = (n)=>{ const out=[]; for(let i=0;i<n;i++){ const a=Math.PI*(0.15+0.7*(n===1?.5:i/(n-1))); out.push([SQUARE.x+Math.cos(a)*95, SQUARE.y+40+Math.sin(a)*28]); } return out; };
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createVillage(container, opts={}){
  const V = { players:[], pos:{}, onHouse: opts.onHouse||null, night:false };
  container.innerHTML = `<svg class="village" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="vSky" cx="50%" cy="10%" r="90%"><stop offset="0" stop-color="#2a2150"/><stop offset=".5" stop-color="#120d22"/><stop offset="1" stop-color="#07050e"/></radialGradient>
      <radialGradient id="vSkyDay" cx="50%" cy="10%" r="90%"><stop offset="0" stop-color="#5a4a8a"/><stop offset=".5" stop-color="#2d2347"/><stop offset="1" stop-color="#15101f"/></radialGradient>
      <radialGradient id="vMoon" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff2cc"/><stop offset=".8" stop-color="#e6bb5f"/><stop offset="1" stop-color="#a86a2a"/></radialGradient>
      <radialGradient id="vGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e6bb5f" stop-opacity=".45"/><stop offset="1" stop-color="#e6bb5f" stop-opacity="0"/></radialGradient>
      <radialGradient id="vGround" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#3b3148"/><stop offset="1" stop-color="#1a1424"/></radialGradient>
      <linearGradient id="vWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a7a66"/><stop offset="1" stop-color="#4d4238"/></linearGradient>
      <linearGradient id="vRoof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a2e2e"/><stop offset="1" stop-color="#3d1515"/></linearGradient>
      <linearGradient id="vWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3a1e"/><stop offset="1" stop-color="#2e1c0c"/></linearGradient>
      <radialGradient id="vWin" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#c47a1a"/></radialGradient>
      <filter id="vBlur"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <rect id="vSkyRect" width="${W}" height="${H}" fill="url(#vSky)"/>
    <g id="vStars"></g>
    <circle cx="318" cy="72" r="90" fill="url(#vGlow)"/>
    <circle id="vMoonC" cx="318" cy="72" r="34" fill="url(#vMoon)"/>
    <g opacity=".22" fill="#7a4a18"><circle cx="306" cy="62" r="6"/><circle cx="330" cy="82" r="8"/><circle cx="328" cy="58" r="3"/></g>
    <path d="M0 215 Q60 170 130 200 T270 190 T400 205 L400 240 L0 240Z" fill="#0d0a16"/>
    <path d="M0 230 Q90 200 180 222 T400 218 L400 560 L0 560Z" fill="#161020"/>
    <ellipse cx="${SQUARE.x}" cy="${SQUARE.y+30}" rx="130" ry="54" fill="url(#vGround)" stroke="#4a3f5a" stroke-width="1"/>
    <g id="vGallows">
      <rect x="${GALLOWS.x-22}" y="${GALLOWS.y-70}" width="5" height="70" fill="url(#vWood)"/>
      <rect x="${GALLOWS.x+18}" y="${GALLOWS.y-70}" width="5" height="70" fill="url(#vWood)"/>
      <rect x="${GALLOWS.x-26}" y="${GALLOWS.y-74}" width="52" height="5" fill="url(#vWood)"/>
      <rect x="${GALLOWS.x-30}" y="${GALLOWS.y-2}" width="60" height="4" fill="#2e1c0c"/>
      <g id="vStool" style="transition:transform .4s,opacity .4s"><rect x="${GALLOWS.x-7}" y="${GALLOWS.y-12}" width="14" height="3" fill="#8a5a2a"/><rect x="${GALLOWS.x-6}" y="${GALLOWS.y-9}" width="2" height="9" fill="#6a4420"/><rect x="${GALLOWS.x+4}" y="${GALLOWS.y-9}" width="2" height="9" fill="#6a4420"/></g>
    </g>
    <g id="vStakes">${STAKES.map(([x,y])=>`<polygon points="${x-3},${y} ${x+3},${y} ${x+1},${y-46} ${x-1},${y-46}" fill="url(#vWood)"/><polygon points="${x-1.5},${y-46} ${x+1.5},${y-46} ${x},${y-54}" fill="#b8b2a8"/>`).join('')}</g>
    <g id="vHouses"></g>
    <g id="vRopes"></g>
    <g id="vFigs"></g>
    <g id="vBubbles"></g>
    <rect id="vNightShade" width="${W}" height="${H}" fill="#05030c" opacity="0" style="pointer-events:none;transition:opacity 1.2s"/>
  </svg>`;
  const svg=container.querySelector('svg');
  const $=(id)=>svg.querySelector('#'+id);
  // yıldızlar
  let stars=''; for(let i=0;i<40;i++){ const x=Math.random()*W, y=Math.random()*180, r=Math.random()*1.2+.3; stars+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(Math.random()*.6+.3).toFixed(2)}"/>`; } $('vStars').innerHTML=stars;

  function houseSvg(p,i){
    const [x,y]=SLOTS[ORDER[i]];
    return `<g class="house" data-house="${p.id}" transform="translate(${x},${y})" style="cursor:pointer">
      <polygon points="-34,-12 0,-40 34,-12" fill="url(#vRoof)" stroke="#2a0f0f" stroke-width="1"/>
      <rect x="-28" y="-12" width="56" height="34" fill="url(#vWall)" stroke="#2b2420" stroke-width="1"/>
      <rect x="-8" y="2" width="16" height="20" rx="2" fill="#2e1c0c"/>
      <rect class="win" x="12" y="-6" width="11" height="10" fill="url(#vWin)"/>
      <rect class="win" x="-23" y="-6" width="11" height="10" fill="url(#vWin)"/>
      <rect x="18" y="-34" width="6" height="14" fill="#4d4238"/>
      <circle class="ring" cx="0" cy="-2" r="46" fill="none" stroke="#d9a441" stroke-width="2.5" opacity="0" style="transition:opacity .25s"/>
      <g class="badge" opacity="0" style="transition:opacity .25s"><circle cx="30" cy="-30" r="10" fill="#c0202e" stroke="#fff" stroke-width="1.5"/><text class="badgeT" x="30" y="-26" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">0</text></g>
      <g class="ribbon" opacity="0" style="transition:opacity .6s"><path d="M-26,-10 l8,0 l-6,18 l-4,-2z" fill="#0a0a0a"/><path d="M-24,-10 l6,0 l-4,14 l-3,-1z" fill="#1a1a1a"/></g>
      <text y="36" text-anchor="middle" font-size="11" font-weight="800" fill="#ece7f5" font-family="Nunito,sans-serif">${esc(p.name)}</text>
    </g>`;
  }
  function figSvg(p){
    return `<g class="fig" data-fig="${p.id}" style="transition:transform 1.1s cubic-bezier(.4,.1,.3,1)">
      <ellipse cx="0" cy="2" rx="9" ry="3" fill="#000" opacity=".35"/>
      <g class="body"><path d="M-7,-26 Q-9,-10 -6,0 L6,0 Q9,-10 7,-26 Z" fill="${p.color||'#3b4a6b'}" stroke="#0b0a12" stroke-width="1"/>
      <circle cx="0" cy="-31" r="9" fill="#e6dfd6" stroke="#0b0a12" stroke-width="1"/>
      <text class="face" x="0" y="-27" text-anchor="middle" font-size="12">${p.avatar||'🙂'}</text>
      <g class="fangs" opacity="0"><polygon points="-3,-24 -1.5,-19 0,-24" fill="#fff"/><polygon points="3,-24 1.5,-19 0,-24" fill="#fff"/><circle cx="-3" cy="-32" r="1.6" fill="#ff2a3c"/><circle cx="3" cy="-32" r="1.6" fill="#ff2a3c"/></g></g>
    </g>`;
  }
  const COLORS=['#3b4a6b','#5a3a5a','#2f5a4a','#6b4a2f','#4a2f6b','#6b2f3b','#2f4a6b','#5a5a2f','#3a5a6b','#6b3a2f','#2f6b5a','#4a4a4a'];

  V.setPlayers=(players)=>{
    V.players=players.map((p,i)=>({...p, color:COLORS[i%COLORS.length]}));
    $('vHouses').innerHTML=V.players.map((p,i)=>houseSvg(p,i)).join('');
    $('vFigs').innerHTML=V.players.map(figSvg).join('');
    V.players.forEach((p,i)=>{ const [x,y]=SLOTS[ORDER[i]]; V.pos[p.id]=[x,y+22]; setT(p.id,x,y+22,false); });
    svg.querySelectorAll('[data-house]').forEach(h=>h.addEventListener('click',()=>{ if(V.onHouse) V.onHouse(h.dataset.house); }));
  };
  function fig(id){ return svg.querySelector(`[data-fig="${id}"]`); }
  function house(id){ return svg.querySelector(`[data-house="${id}"]`); }
  function setT(id,x,y,anim=true){ const f=fig(id); if(!f) return; if(!anim) f.style.transition='none'; f.style.transform=`translate(${x}px,${y}px)`; if(!anim) requestAnimationFrame(()=>f.style.transition=''); V.pos[id]=[x,y]; }
  V.homePos=(id)=>{ const i=V.players.findIndex(p=>p.id===id); const [x,y]=SLOTS[ORDER[i]]; return [x,y+22]; };
  V.moveTo=(id,x,y)=>setT(id,x,y);
  V.goHome=(ids)=>{ (ids||V.players.map(p=>p.id)).forEach(id=>{ const st=V.state?.[id]; if(st&&(st.hanged||st.impaled)) return; const [x,y]=V.homePos(id); setT(id,x,y); }); };
  V.gather=(ids)=>{ const list=ids||V.players.filter(p=>!(V.state?.[p.id]?.dead)).map(p=>p.id); const pts=CROWD(list.length); list.forEach((id,i)=>setT(id,pts[i][0],pts[i][1])); };
  V.crowdToHouse=(targetId, ids)=>{ const [hx,hy]=V.homePos(targetId); ids.forEach((id,i)=>{ const a=Math.PI*(0.1+0.8*(ids.length===1?.5:i/(ids.length-1))); setT(id, hx+Math.cos(a)*34, hy+14+Math.sin(a)*10); }); };
  V.toSquareCenter=(id)=>setT(id,SQUARE.x,SQUARE.y+18);
  V.toStool=(id)=>setT(id,GALLOWS.x,GALLOWS.y-12);
  V.toStake=(id,k=0)=>setT(id,STAKES[k][0],STAKES[k][1]-4);
  V.drop=(id)=>{ const f=fig(id); if(!f) return; f.style.transition='transform .35s cubic-bezier(.3,1.4,.6,1)'; f.style.transform=`translate(${GALLOWS.x}px,${GALLOWS.y-2}px)`; setTimeout(()=>f.style.transition='',400); };
  V.stool=(show)=>{ const s=$('vStool'); s.style.opacity=show?'1':'0'; s.style.transform=show?'':'translate(14px,2px) rotate(70deg)'; };
  V.rope=(id,show)=>{ const g=$('vRopes'); const ex=g.querySelector(`[data-rope="${id}"]`); if(ex) ex.remove(); if(show){ const [x,y]=V.pos[id]||[GALLOWS.x,GALLOWS.y]; g.insertAdjacentHTML('beforeend',`<line data-rope="${id}" x1="${x}" y1="${GALLOWS.y-70}" x2="${x}" y2="${y-36}" stroke="#b89a6a" stroke-width="1.5"/>`); } };
  V.hangSlot=(id,k)=>{ const [x,y]=HANG_SLOTS[k]; setT(id,x,y); setTimeout(()=>V.rope(id,true),1150); };
  V.fangs=(id,show)=>{ const f=fig(id); if(f) f.querySelector('.fangs').style.opacity=show?'1':'0'; };
  V.bump=(id,dx=0,dy=-10)=>{ const f=fig(id); if(!f) return; const [x,y]=V.pos[id]; f.style.transition='transform .18s'; f.style.transform=`translate(${x+dx}px,${y+dy}px)`; setTimeout(()=>{ f.style.transform=`translate(${x}px,${y}px)`; setTimeout(()=>f.style.transition='',200); },180); };
  V.shake=(id)=>{ const f=fig(id); if(!f) return; const [x,y]=V.pos[id]; let n=0; const t=setInterval(()=>{ f.style.transition='transform .06s'; f.style.transform=`translate(${x+(n%2?4:-4)}px,${y}px) rotate(${n%2?6:-6}deg)`; if(++n>10){ clearInterval(t); f.style.transform=`translate(${x}px,${y}px)`; setTimeout(()=>f.style.transition='',100);} },60); };
  V.dead=(id)=>{ const f=fig(id); if(!f) return; f.querySelector('.body').setAttribute('opacity','.35'); f.querySelector('.body').style.transform='rotate(80deg) translate(-8px,6px)'; f.querySelector('.face').textContent='✖'; const h=house(id); if(h){ h.querySelector('.ribbon').style.opacity='1'; h.querySelectorAll('.win').forEach(w=>w.setAttribute('fill','#1a1420')); } };
  V.impaled=(id)=>{ const f=fig(id); if(!f) return; f.querySelector('.body').setAttribute('opacity','.75'); f.querySelector('.face').textContent='😵'; V.fangs(id,true); const h=house(id); if(h){ h.querySelector('.ribbon').style.opacity='1'; h.querySelectorAll('.win').forEach(w=>w.setAttribute('fill','#1a1420')); } };
  V.hangedLook=(id)=>{ const f=fig(id); if(!f) return; f.querySelector('.face').textContent='😵'; f.querySelector('.body').setAttribute('opacity','.8'); const h=house(id); if(h){ h.querySelector('.ribbon').style.opacity='1'; h.querySelectorAll('.win').forEach(w=>w.setAttribute('fill','#1a1420')); } };
  V.highlight=(id,on)=>{ svg.querySelectorAll('.ring').forEach(r=>r.style.opacity='0'); if(id&&on){ const h=house(id); if(h) h.querySelector('.ring').style.opacity='1'; } };
  V.badges=(counts)=>{ svg.querySelectorAll('[data-house]').forEach(h=>{ const n=counts?.[h.dataset.house]||0; h.querySelector('.badge').style.opacity=n?'1':'0'; h.querySelector('.badgeT').textContent=n; }); };
  V.setNight=(on)=>{ V.night=on; $('vNightShade').style.opacity=on?'.45':'0'; $('vSkyRect').setAttribute('fill',on?'url(#vSky)':'url(#vSkyDay)'); svg.querySelectorAll('.win').forEach(w=>{ if(w.getAttribute('fill')!=='#1a1420') w.setAttribute('fill',on?'url(#vWin)':'#d9cfa8'); }); };
  V.bubble=(id,text,ms=2600)=>{ const g=$('vBubbles'); g.innerHTML=''; const [x,y]=V.pos[id]||[SQUARE.x,SQUARE.y]; const w=Math.min(190,Math.max(70,text.length*5.2)); const bx=Math.max(8,Math.min(W-w-8,x-w/2)); const by=y-52-26; const lines=wrap(text,Math.floor(w/5.2)); const bh=14+lines.length*12; const el=document.createElementNS('http://www.w3.org/2000/svg','g'); el.innerHTML=`<path d="M${bx},${by-bh+4} h${w} v${bh} h-${w/2-6} l-${Math.max(4,x-bx-w/2)+6},8 l6,-8 h-${w/2-6} z" fill="#f6f1e6" stroke="#2a2335" stroke-width="1" rx="6"/>${lines.map((l,i)=>`<text x="${bx+w/2}" y="${by-bh+16+i*12}" text-anchor="middle" font-size="10" font-weight="700" fill="#1a1424" font-family="Nunito,sans-serif">${esc(l)}</text>`).join('')}`; g.appendChild(el); setTimeout(()=>el.remove(),ms); };
  function wrap(t,n){ const words=t.split(' '); const out=[]; let cur=''; for(const w of words){ if((cur+' '+w).trim().length>n){ out.push(cur.trim()); cur=w; } else cur+=' '+w; } if(cur.trim()) out.push(cur.trim()); return out.slice(0,4); }
  V.clearBubbles=()=>{ $('vBubbles').innerHTML=''; };
  /* durum senkronu: {id:{dead,hanged,impaled,hangK,stakeK}} */
  V.applyState=(state)=>{ V.rope; $('vRopes').innerHTML=''; V.stool(true);
    for(const p of V.players){ const s=state[p.id]||{};
      if(s.impaled){ V.toStake(p.id,s.stakeK||0); V.impaled(p.id); }
      else if(s.hanged){ V.hangSlot(p.id,s.hangK||0); V.hangedLook(p.id); }
      else if(s.dead){ const [x,y]=V.homePos(p.id); setT(p.id,x,y); V.dead(p.id); } } };
  V.svg=svg;
  V.container=container;
  if(opts.players) V.setPlayers(opts.players);
  return V;
}
export const VILLAGE_CSS = `
.village{width:100%;height:auto;display:block;border-radius:18px;border:1px solid var(--line);background:#07050e;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.village .house:active .ring{opacity:1!important}
.village .fig{will-change:transform}
`;
