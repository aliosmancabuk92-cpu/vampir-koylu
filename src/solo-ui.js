/* =====================================================================
   VAMPİR KÖYLÜ — Tek oyunculu arayüz
   ===================================================================== */
import { SoloGame, LEVELS, CHAPTERS, ROLE_INFO, objectiveText, rankFor, xpFor, RANKS, makeRng } from './solo-engine.js';

const ROLE_DESC = {
  vampir:'Her gece bir kurban seçersin. Gündüz masum rolü yap, kâhini erken yok et. Köylü sayısı vampirlere eşitlenince kazanırsın.',
  doktor:'Her gece birini korursun. Vampir, kendisini suçlayanları ve kâhin olduğunu söyleyenleri hedef alır.',
  kahin:'Her gece birinin vampir olup olmadığını öğrenirsin. Açıklarsan herkes sana inanır ama vampir seni hedef alır.',
  koylu:'Özel yeteneğin yok. Tartışmayı oku, kimin yalan söylediğini bul, doğru kişiyi as.',
};
const SAVE_KEY='vk_solo_v1';

export function mountSolo(ctx){
  const { app, esc, voice, toast, onExit } = ctx;
  let save=load();
  let screen='map'; let level=null; let G=null; let picking=null; let lastSpoken=-1; let pendingXp=null; let freeCfg={players:7,vampires:2,role:'random',iq:.5};

  function load(){ try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'); return { stars:{}, xp:0, games:0, wins:0, byRole:{}, streak:0, best:0, ...s }; }catch(e){ return { stars:{}, xp:0, games:0, wins:0, byRole:{}, streak:0, best:0 }; } }
  function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }
  const starsOf=(id)=>save.stars[id]||0;
  const unlocked=(L)=>{ if(L.id===1) return true; const prev=LEVELS.find(x=>x.id===L.id-1); if(!prev||starsOf(prev.id)<1) return false; if(L.boss){ const chStars=LEVELS.filter(x=>x.ch===L.ch&&!x.boss).reduce((a,x)=>a+starsOf(x.id),0); return chStars>=10; } return true; };
  const freeUnlocked=()=>LEVELS.filter(x=>x.ch<=2).every(x=>starsOf(x.id)>=1);
  const totalStars=()=>Object.values(save.stars).reduce((a,b)=>a+b,0);

  function render(){
    switch(screen){
      case 'map': return renderMap();
      case 'intro': return renderIntro();
      case 'game': return renderGame();
      case 'free': return renderFree();
      case 'stats': return renderStats();
    }
  }
  const star=(n,max=3)=>'★'.repeat(n)+'<span style="opacity:.25">'+'★'.repeat(max-n)+'</span>';

  /* ---------------- HARİTA ---------------- */
  function renderMap(){
    const rk=rankFor(save.xp); const nextXp=rk.next?rk.next.xp:rk.xp; const prevXp=rk.xp; const pct=rk.next?Math.round(100*(save.xp-prevXp)/(nextXp-prevXp)):100;
    app.innerHTML=`<div class="fade">
      <div class="topbar"><button id="bBack">‹ Ana menü</button><span class="pill">⭐ ${totalStars()}/${LEVELS.length*3}</span><button id="bStats">📊</button></div>
      <div class="card" style="display:flex;gap:14px;align-items:center">
        <div style="font-size:42px">${rk.ic}</div>
        <div style="flex:1"><div style="font-family:Cinzel,serif;font-size:18px;color:var(--gold)">${rk.name}</div>
          <div class="xpbar"><div style="width:${pct}%"></div></div>
          <div class="note" style="text-align:left;margin:4px 0 0">${save.xp} XP${rk.next?` · ${rk.next.name} için ${rk.next.xp-save.xp} XP`:' · En yüksek rütbe'}</div></div>
      </div>
      ${CHAPTERS.map(ch=>{
        const ls=LEVELS.filter(l=>l.ch===ch.id); const got=ls.reduce((a,l)=>a+starsOf(l.id),0);
        return `<div class="card chap" style="border-color:${ch.color}40">
          <div class="row" style="align-items:center"><div style="font-size:30px;flex:none">${ch.ic}</div><div><div style="font-family:Cinzel,serif;font-size:17px;color:${ch.color}">Bölüm ${ch.id} · ${ch.name}</div><div class="note" style="text-align:left;margin:0">${ch.sub} · ${got}/${ls.length*3} ★</div></div></div>
          <div class="lvls">${ls.map(l=>{ const u=unlocked(l); const s=starsOf(l.id); return `<button class="lvl ${u?'':'lock'} ${s?'done':''} ${l.boss?'boss':''}" data-lvl="${l.id}" ${u?'':'disabled'} style="${u?`border-color:${ch.color}`:''}"><div class="n">${u?(l.boss?'👑':l.id):'🔒'}</div><div class="s">${u?star(s):''}</div></button>`; }).join('')}</div>
          ${ls.some(l=>l.boss&&!unlocked(l)&&starsOf(l.id-1)>=1)?`<div class="note">Bölüm sonu için bu bölümde 10 ★ gerekli.</div>`:''}
        </div>`; }).join('')}
      <button class="btn ${freeUnlocked()?'gold':'sec'}" id="bFree" ${freeUnlocked()?'':'disabled'}>🎲 Serbest Oyun ${freeUnlocked()?'':'(Bölüm 2\'yi bitir)'}</button>
    </div>`;
    app.querySelector('#bBack').onclick=onExit;
    app.querySelector('#bStats').onclick=()=>{screen='stats';render();};
    app.querySelector('#bFree').onclick=()=>{screen='free';render();};
    app.querySelectorAll('[data-lvl]').forEach(b=>b.onclick=()=>{ level=LEVELS.find(l=>l.id===+b.dataset.lvl); screen='intro'; render(); });
  }

  /* ---------------- SEVİYE GİRİŞİ ---------------- */
  function renderIntro(){
    const L=level; const ch=CHAPTERS.find(c=>c.id===L.ch); const r=L.role==='random'?null:ROLE_INFO[L.role];
    app.innerHTML=`<div class="fade" style="flex:1;display:flex;flex-direction:column">
      <div class="topbar"><button id="bBack">‹ Harita</button><span class="pill">${L.free?'Serbest Oyun':`Seviye ${L.id}`}</span><span class="pill">${star(starsOf(L.id))}</span></div>
      <div class="rolecard ${L.role==='random'?'koylu':L.role}" style="padding:22px">
        <div class="ic">${r?r.ic:'🎲'}</div><div class="rn" style="font-size:24px">${esc(L.name)}</div>
        <div style="margin-top:6px;color:var(--gold);font-weight:800">Rolün: ${r?r.name:'Rastgele'}</div>
        <div class="rd">${esc(L.desc||ROLE_DESC[L.role]||'Rolün oyun başında belli olur.')}</div>
      </div>
      <div class="card">
        <div class="row"><div><label>Oyuncu</label><div class="big">${L.players}</div></div><div><label>Vampir</label><div class="big" style="color:var(--blood2)">${L.vampires}</div></div><div><label>Zekâ</label><div class="big">${'●'.repeat(Math.ceil(L.iq*5))}<span style="opacity:.25">${'●'.repeat(5-Math.ceil(L.iq*5))}</span></div></div></div>
        <div style="margin-top:12px"><label>Hedefler</label>
          <div class="obj">★ Kazan</div>
          <div class="obj">★★ ${objectiveText(L.objective)}</div>
          <div class="obj">★★★ ${L.role==='vampir'?'…ve en fazla 1 oy al':'…ve hiç yanlış oy verme'}</div></div>
      </div>
      <button class="btn" id="bStart">Oyuna Başla</button>
    </div>`;
    app.querySelector('#bBack').onclick=()=>{screen=L.free?'free':'map';render();};
    app.querySelector('#bStart').onclick=()=>startGame(L);
  }

  function startGame(L){
    level=L; G=new SoloGame(L,{rng:makeRng((Date.now()^(L.id*2654435761))>>>0), humanName:(localStorage.getItem('vk_name')||'').trim()||'Oyuncu'}); lastSpoken=-1; picking=null; pendingXp=null; screen='game'; render();
  }

  /* ---------------- OYUN ---------------- */
  function renderGame(){
    const S=G.publicInfo(); const h=G.human; const r=ROLE_INFO[h.role];
    let body='';
    switch(G.phase){
      case 'roles': body=viewRoles(h,r); break;
      case 'night': body=viewNight(S,h); break;
      case 'dawn': body=viewDawn(S,h); break;
      case 'talk': body=viewTalk(S,h); break;
      case 'vote': body=viewVote(S,h); break;
      case 'verdict': body=viewVerdict(S,h); break;
      case 'end': body=viewEnd(S,h); break;
    }
    app.innerHTML=`<div class="fade" style="flex:1;display:flex;flex-direction:column">
      <div class="topbar"><button id="bQuit">✕</button><span class="pill">${G.phase==='roles'?'Başlıyor':'Gün '+G.day}${G.phase==='talk'?` · Tur ${G.round}/${G.maxRounds}`:''}</span><span class="pill">${r.ic} ${r.name}</span><button id="bVoice">${voice.on?'🔊':'🔇'}</button></div>
      ${body}</div>`;
    app.querySelector('#bQuit').onclick=()=>{ if(G.phase==='end'||confirmQuit()){ screen=level.free?'free':'map'; render(); } };
    app.querySelector('#bVoice').onclick=()=>{ voice.set(!voice.on); render(); };
    bind(S,h);
    speakNew();
    const f=app.querySelector('#feed'); if(f) f.scrollTop=f.scrollHeight;
  }
  function confirmQuit(){ if(quitArmed){ quitArmed=false; return true; } quitArmed=true; toast('Çıkmak için tekrar ✕\'e bas (oyun kaybolur)'); setTimeout(()=>quitArmed=false,3000); return false; }
  let quitArmed=false;

  function speakNew(){
    const narrs=G.feed.map((f,i)=>({f,i})).filter(x=>x.f.kind==='narr');
    const last=narrs[narrs.length-1]; if(last && last.i>lastSpoken){ lastSpoken=last.i; voice.speak(last.f.text); }
  }

  const plist=(ids, sel, extra={})=>`<ul class="plist">${ids.map(id=>{ const p=G.P(id); const dead=!p.alive; return `<li class="pick ${sel===id?'sel':''} ${dead?'dead':''}" data-pick="${id}"><span class="av">${p.avatar}</span><span class="nm">${esc(p.name)}${p.claimed?` <span class="tag">· "${ROLE_INFO[p.claimed].name}"</span>`:''}${extra.showRole&&(dead||G.phase==='end'||(G.human.role==='vampir'&&p.role==='vampir'))?` <span class="tag">${ROLE_INFO[p.role].ic}</span>`:''}</span>${extra.counts&&extra.counts[id]?`<span class="cnt">${extra.counts[id]}</span>`:''}${sel===id?'<span class="tag">✔</span>':''}</li>`; }).join('')}</ul>`;

  function viewRoles(h,r){
    const mates=G.players.filter(p=>p.role==='vampir'&&p!==h);
    return `<p class="sub">Rolün belli oldu</p>
      <div class="rolecard ${h.role}"><div class="ic">${r.ic}</div><div class="rn">${r.name}</div><div class="rd">${ROLE_DESC[h.role]}</div>
      ${h.role==='vampir'&&mates.length?`<div style="margin-top:12px;color:var(--blood2);font-weight:800">Ortağın: ${mates.map(m=>m.avatar+' '+esc(m.name)).join(', ')}</div>`:''}</div>
      <div class="card"><label>Köy (${G.players.length} kişi)</label><div class="villagers">${G.players.map(p=>`<span class="vp">${p.avatar} ${esc(p.name)}</span>`).join('')}</div></div>
      <button class="btn" id="bAck">Geceye geç</button>`;
  }
  function viewNight(S,h){
    const n=G.needs; const title={vamp:'🧛 Kurbanını seç',doktor:'🩺 Kimi koruyacaksın?',kahin:'🔮 Kimi araştıracaksın?'}[n.type];
    const hint={vamp:'Kâhin olduğunu söyleyen ya da seni suçlayan varsa önce onu.',doktor:'Vampir en çok suçlayanı veya kâhin iddiasında olanı hedef alır.',kahin:'En çok şüphelendiğine bak; bulduğunu gündüz açıklayabilirsin.'}[n.type];
    return `<div class="banner night"><div class="big">🌙</div><div class="t">Gece ${G.day}</div><div class="d">${hint}</div></div>
      <div class="card"><h2>${title}</h2>${plist(n.cands, picking)}<button class="btn ${n.type==='doktor'?'green':n.type==='kahin'?'blue':''}" id="bConfirm" ${picking?'':'disabled'}>${{vamp:'Öldür',doktor:'Koru',kahin:'Araştır'}[n.type]}</button></div>`;
  }
  function viewDawn(S,h){
    const ln=G.lastNight; const sr=ln.seer; const died=!h.alive;
    return `<div class="banner day"><div class="big">🌅</div><div class="t">Sabah oldu</div>
      <div style="margin-top:10px;font-size:19px;font-weight:800">${ln.killed?`<span class="bad">${esc(ln.killedName)}</span> öldürüldü. <span class="tag">${ROLE_INFO[ln.killedRole].ic} ${ROLE_INFO[ln.killedRole].name}</span>`:(ln.saved?'<span class="ok">Doktor kurtardı!</span> Kimse ölmedi.':'Kimse ölmedi.')}</div></div>
      ${sr?`<div class="card" style="text-align:center;border-color:var(--blue)">🔮 <b>${esc(G.P(sr.target).name)}</b> ${sr.isVamp?'<span class="bad">bir VAMPİR!</span>':'<span class="ok">vampir değil.</span>'}</div>`:''}
      ${died?`<div class="card" style="text-align:center"><div style="font-size:44px">👻</div><b>Öldün.</b><div class="note">Kalan oyun botlar arasında oynandı; sonucu gör.</div></div><button class="btn" id="bResult">Sonucu gör</button>`:`<button class="btn gold" id="bTalk">Tartışmayı başlat</button>`}
      ${villageCard()}`;
  }
  function feedHtml(){
    const items=G.feed.filter(f=>f.kind!=='narr'||true);
    let lastDay=null, out='';
    for(const f of items){ if(f.day!==lastDay){ lastDay=f.day; out+=`<div class="fsep">Gün ${f.day}</div>`; }
      if(f.kind==='narr'){ out+=`<div class="fnarr">${esc(f.text)}</div>`; continue; }
      const me=f.who==='me'; out+=`<div class="fb ${me?'me':''} ${f.kind}"><span class="fav">${f.avatar}</span><div class="fbody"><div class="fname">${esc(f.name)}</div><div>${esc(f.text)}</div></div></div>`; }
    return out;
  }
  function viewTalk(S,h){
    const opts=G.humanOptions();
    let actions='';
    if(picking&&picking.mode){
      const m=picking.mode;
      if(m==='claimSeer'){ const o=opts.find(x=>x.type==='claimSeer'); actions=`<div class="card"><h2 style="font-size:16px">${h.role==='kahin'?'Hangi kehanetini açıklayacaksın?':'Kimi işaret edeceksin? (yalan)'}</h2><ul class="plist">${o.results.map((r,i)=>`<li class="pick" data-claim="${i}"><span class="av">${G.P(r.target).avatar}</span><span class="nm">${esc(G.P(r.target).name)}</span><span class="tag ${r.isVamp?'bad':'ok'}">${r.isVamp?'VAMPİR':'temiz'}</span></li>`).join('')}</ul><button class="btn sec" id="bCancel">Vazgeç</button></div>`; }
      else { const o=opts.find(x=>x.type===m); actions=`<div class="card"><h2 style="font-size:16px">${m==='accuse'?'Kimi suçlayacaksın?':'Kimi savunacaksın?'}</h2>${plist(o.targets, picking.target)}<div class="row"><button class="btn sec" id="bCancel">Vazgeç</button><button class="btn ${m==='accuse'?'':'green'}" id="bDo" ${picking.target?'':'disabled'}>${m==='accuse'?'Suçla':'Savun'}</button></div></div>`; }
    } else {
      actions=`<div class="card"><label>Sıra sende — ne diyeceksin?</label><div class="acts">${opts.map(o=>`<button class="btn sm ${o.type==='accuse'?'':o.type==='defend'?'green':o.type==='quiet'?'sec':'blue'}" data-act="${o.type}">${o.label}</button>`).join('')}</div></div>`;
    }
    return `<div class="banner day" style="padding:12px"><div class="t" style="font-size:18px">☀️ Tartışma</div></div>
      <div class="feed" id="feed">${feedHtml()}</div>${actions}`;
  }
  function viewVote(S,h){
    return `<div class="banner day" style="padding:12px"><div class="t" style="font-size:18px">⚖️ Oylama</div><div class="d">Kim asılsın?</div></div>
      <div class="feed small" id="feed">${feedHtml()}</div>
      <div class="card">${plist(G.needs.cands, picking)}<div class="row"><button class="btn sec" id="bSkip">Çekimser</button><button class="btn" id="bConfirm" ${picking?'':'disabled'}>As</button></div></div>`;
  }
  function viewVerdict(S,h){
    const lv=G.lastVote; const died=!h.alive;
    const voters=(id)=>Object.entries(lv.votes).filter(([,v])=>v===id).map(([k])=>G.P(k).avatar).join('');
    return `<div class="banner day"><div class="big">${lv.hanged?'🪢':'🤷'}</div><div class="t">Karar</div>
      <div style="margin-top:10px;font-size:19px;font-weight:800">${lv.hanged?`<span class="bad">${esc(lv.name)}</span> asıldı. <span class="tag">${ROLE_INFO[lv.role].ic} ${ROLE_INFO[lv.role].name}</span>`:(lv.tie?'Oylar eşit, kimse asılmadı.':'Kimse asılmadı.')}</div></div>
      <div class="card"><label>Oylar</label><ul class="plist">${Object.entries(lv.tally).sort((a,b)=>b[1]-a[1]).map(([id,c])=>`<li><span class="av">${G.P(id).avatar}</span><span class="nm">${esc(G.P(id).name)}</span><span class="tag">${voters(id)}</span><span class="cnt">${c}</span></li>`).join('')}${lv.skips?`<li><span class="av">–</span><span class="nm">Çekimser</span><span class="cnt">${lv.skips}</span></li>`:''}</ul></div>
      ${died?`<div class="card" style="text-align:center"><div style="font-size:44px">👻</div><b>Asıldın.</b><div class="note">Kalan oyun botlar arasında oynandı.</div></div><button class="btn" id="bResult">Sonucu gör</button>`:`<button class="btn" id="bNight">Geceye geç</button>`}
      ${villageCard()}`;
  }
  function villageCard(){
    return `<div class="card"><label>Köy</label><ul class="plist">${G.players.map(p=>`<li class="${p.alive?'':'dead'} ${p.human?'me':''}"><span class="av">${p.avatar}</span><span class="nm">${esc(p.name)}${p.claimed?` <span class="tag">· "${ROLE_INFO[p.claimed].name}"</span>`:''}</span>${(!p.alive||p.human||(G.human.role==='vampir'&&p.role==='vampir'))?`<span class="tag">${ROLE_INFO[p.role].ic} ${ROLE_INFO[p.role].name}</span>`:''}</li>`).join('')}</ul></div>`;
  }
  function viewEnd(S,h){
    const res=G.result; if(!pendingXp) applyResult(res);
    const rk=rankFor(save.xp);
    const next=level.free?null:LEVELS.find(l=>l.id===level.id+1);
    return `<div class="banner ${res.won?'day':'night'}"><div class="big">${res.won?'🏆':'💀'}</div><div class="t">${res.won?'Kazandın!':'Kaybettin'}</div><div class="d">${G.winner==='vampir'?'Vampirler köyü ele geçirdi.':'Köy vampirlerden kurtuldu.'} · ${res.days} gün${G.stats.humanDiedDay?` · ${G.stats.humanDiedDay}. gün öldün, kalanı botlar oynadı`:''}</div>
      <div class="stars ${res.stars?'won':''}">${[1,2,3].map(i=>`<span class="${i<=res.stars?'on':''}" style="animation-delay:${i*.25}s">★</span>`).join('')}</div></div>
      <div class="card">
        <div class="obj ${res.won?'ok':'bad'}">${res.won?'✔':'✘'} Kazan</div>
        <div class="obj ${res.objOk?'ok':'bad'}">${res.objOk?'✔':'✘'} ${esc(res.objText)}</div>
        <div class="obj ${res.perfect?'ok':'bad'}">${res.perfect?'✔':'✘'} ${h.role==='vampir'?'En fazla 1 oy al':'Hiç yanlış oy verme'}</div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center"><span>+${pendingXp.xp} XP ${pendingXp.newStars>0?`· <span class="ok">+${pendingXp.newStars} yeni ★</span>`:''}</span><span class="pill">${rk.ic} ${rk.name}</span></div>
        ${pendingXp.rankUp?`<div class="note ok">Rütbe atladın: ${rk.name}!</div>`:''}
      </div>
      <div class="card"><label>Roller</label><ul class="plist">${G.players.map(p=>`<li class="${p.alive?'':'dead'} ${p.human?'me':''}"><span class="av">${p.avatar}</span><span class="nm">${esc(p.name)}</span><span class="tag">${ROLE_INFO[p.role].ic} ${ROLE_INFO[p.role].name}</span></li>`).join('')}</ul></div>
      ${next&&res.won?`<button class="btn gold" id="bNext">Sonraki seviye →</button>`:''}
      <div class="row"><button class="btn sec" id="bRetry">Tekrar</button><button class="btn sec" id="bMap">${level.free?'Serbest Oyun':'Harita'}</button></div>`;
  }
  function applyResult(res){
    const L=level; const xp=xpFor(res,L); const before=rankFor(save.xp).name;
    const old=L.free?0:starsOf(L.id); const newStars=Math.max(0,res.stars-old);
    if(!L.free && res.stars>old) save.stars[L.id]=res.stars;
    save.xp+=xp; save.games++; if(res.won){ save.wins++; save.streak++; save.best=Math.max(save.best,save.streak);} else save.streak=0;
    const br=save.byRole[res.role]||{g:0,w:0}; br.g++; if(res.won) br.w++; save.byRole[res.role]=br;
    persist();
    pendingXp={xp,newStars,rankUp:rankFor(save.xp).name!==before};
  }

  function bind(S,h){
    const q=(s)=>app.querySelector(s);
    q('#bAck')&&(q('#bAck').onclick=()=>{ G.ackRole(); picking=null; render(); });
    app.querySelectorAll('[data-pick]').forEach(li=>li.onclick=()=>{ const id=li.dataset.pick; if(G.phase==='talk'){ picking={...picking,target:id}; } else picking=id; render(); });
    q('#bConfirm')&&(q('#bConfirm').onclick=()=>{ if(!picking) return; const t=picking; picking=null; if(G.phase==='night') G.nightAction(t); else if(G.phase==='vote') G.vote(t); render(); });
    q('#bSkip')&&(q('#bSkip').onclick=()=>{ picking=null; G.vote('skip'); render(); });
    q('#bTalk')&&(q('#bTalk').onclick=()=>{ G.startTalk(); picking=null; render(); });
    q('#bNight')&&(q('#bNight').onclick=()=>{ G.nextNight(); picking=null; render(); });
    q('#bResult')&&(q('#bResult').onclick=()=>{ render(); });
    app.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{ const t=b.dataset.act; if(t==='quiet'){ act({type:'quiet'}); } else if(t==='claimDoctor'){ act({type:'claimDoctor'}); } else picking={mode:t,target:null}; render(); });
    app.querySelectorAll('[data-claim]').forEach(li=>li.onclick=()=>{ const o=G.humanOptions().find(x=>x.type==='claimSeer'); const r=o.results[+li.dataset.claim]; act({type:'claimSeer',target:r.target,isVamp:r.isVamp}); });
    q('#bCancel')&&(q('#bCancel').onclick=()=>{ picking=null; render(); });
    q('#bDo')&&(q('#bDo').onclick=()=>{ const m=picking.mode, t=picking.target; act({type:m,target:t}); });
    q('#bNext')&&(q('#bNext').onclick=()=>{ level=LEVELS.find(l=>l.id===level.id+1); screen='intro'; render(); });
    q('#bRetry')&&(q('#bRetry').onclick=()=>startGame(level));
    q('#bMap')&&(q('#bMap').onclick=()=>{ screen=level.free?'free':'map'; render(); });
  }
  function act(a){ picking=null; const before=G.feed.length; G.talkAction(a); render(); animateNew(before); }
  function animateNew(from){ const f=app.querySelector('#feed'); if(!f) return; const items=[...f.querySelectorAll('.fb,.fnarr')]; const newOnes=items.slice(items.length-(G.feed.length-from)); newOnes.forEach((el,i)=>{ el.style.opacity='0'; setTimeout(()=>{ el.style.transition='opacity .3s'; el.style.opacity='1'; f.scrollTop=f.scrollHeight; }, 250+i*450); }); }

  /* ---------------- SERBEST OYUN ---------------- */
  function renderFree(){
    const c=freeCfg; const maxV=c.players>=12?3:c.players>=8?2:1; if(c.vampires>maxV) c.vampires=maxV;
    app.innerHTML=`<div class="fade">
      <div class="topbar"><button id="bBack">‹ Harita</button><span class="pill">Serbest Oyun</span><span></span></div>
      <div class="card">
        <label>Oyuncu sayısı: <b>${c.players}</b></label><input type="range" min="5" max="12" value="${c.players}" id="rP">
        <label>Vampir sayısı: <b>${c.vampires}</b></label><input type="range" min="1" max="${maxV}" value="${c.vampires}" id="rV">
        <label>Bot zekâsı: <b>${['Saf','Kolay','Orta','Zor','Usta'][Math.min(4,Math.floor(c.iq*5))]}</b></label><input type="range" min="0" max="100" value="${Math.round(c.iq*100)}" id="rI">
        <label>Rolün</label><div class="acts">${['random','koylu','kahin','doktor','vampir'].map(r=>`<button class="btn sm ${c.role===r?'gold':'sec'}" data-role="${r}">${r==='random'?'🎲 Rastgele':ROLE_INFO[r].ic+' '+ROLE_INFO[r].name}</button>`).join('')}</div>
      </div>
      <button class="btn" id="bGo">Oyna</button></div>`;
    const q=(s)=>app.querySelector(s);
    q('#bBack').onclick=()=>{screen='map';render();};
    q('#rP').oninput=(e)=>{c.players=+e.target.value;render();}; q('#rV').oninput=(e)=>{c.vampires=+e.target.value;render();}; q('#rI').oninput=(e)=>{c.iq=+e.target.value/100;render();};
    app.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{c.role=b.dataset.role;render();});
    q('#bGo').onclick=()=>{ const L={ id:'free', free:true, ch:0, name:'Serbest Oyun', players:c.players, vampires:c.vampires, role:c.role, iq:c.iq, rounds:c.players>=8?3:2, objective:{type:'win'}, desc:`${c.players} kişi, ${c.vampires} vampir.` }; level=L; screen='intro'; render(); };
  }

  /* ---------------- İSTATİSTİK ---------------- */
  function renderStats(){
    const wr=save.games?Math.round(100*save.wins/save.games):0;
    app.innerHTML=`<div class="fade">
      <div class="topbar"><button id="bBack">‹ Harita</button><span class="pill">İstatistik</span><span></span></div>
      <div class="card"><div class="row"><div><label>Oyun</label><div class="big">${save.games}</div></div><div><label>Kazanma</label><div class="big">%${wr}</div></div><div><label>En iyi seri</label><div class="big">${save.best}</div></div></div></div>
      <div class="card"><label>Role göre</label><ul class="plist">${Object.keys(ROLE_INFO).map(r=>{ const b=save.byRole[r]||{g:0,w:0}; return `<li><span class="av">${ROLE_INFO[r].ic}</span><span class="nm">${ROLE_INFO[r].name}</span><span class="tag">${b.g} oyun</span><span class="cnt" style="background:${b.g?'var(--green)':'var(--card2)'};color:#03150c">${b.g?Math.round(100*b.w/b.g)+'%':'–'}</span></li>`; }).join('')}</ul></div>
      <div class="card"><label>Rütbeler</label><ul class="plist">${RANKS.map(k=>`<li class="${save.xp>=k.xp?'':'dead'}"><span class="av">${k.ic}</span><span class="nm">${k.name}</span><span class="tag">${k.xp} XP</span></li>`).join('')}</ul></div>
      <button class="btn sec" id="bReset">İlerlemeyi sıfırla</button></div>`;
    app.querySelector('#bBack').onclick=()=>{screen='map';render();};
    app.querySelector('#bReset').onclick=()=>{ if(resetArmed){ save={stars:{},xp:0,games:0,wins:0,byRole:{},streak:0,best:0}; persist(); resetArmed=false; toast('İlerleme sıfırlandı'); render(); } else { resetArmed=true; toast('Emin misin? Tekrar bas.'); setTimeout(()=>resetArmed=false,3000);} };
  }
  let resetArmed=false;

  return { show(){ screen='map'; render(); } };
}
