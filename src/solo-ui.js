/* =====================================================================
   VAMPİR KÖYLÜ — Tek oyunculu arayüz
   ===================================================================== */
import { SoloGame, LEVELS, CHAPTERS, ROLE_INFO, objectiveText, rankFor, xpFor, RANKS, makeRng } from './solo-engine.js';
import { createVillage } from './village.js';
import { createScene } from './scene.js';
import { setHardMode } from './lines.js';
import SFX from './sfx.js';
import { createSpeaker, prefetchLines, loadVoices } from './voice.js';
import { stageWanted, stage3d, hideStage, loadingHTML, setRenderPref, setQualityPref } from './stage-prefs.js';

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
  setHardMode(save.hard!==false);
  let screen='map'; let level=null; let G=null; let pendingXp=null; let freeCfg={players:7,vampires:2,role:'random',iq:.5};

  function load(){ try{ const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'); return { stars:{}, xp:0, games:0, wins:0, byRole:{}, streak:0, best:0, ...s }; }catch(e){ return { stars:{}, xp:0, games:0, wins:0, byRole:{}, streak:0, best:0 }; } }
  function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }
  const starsOf=(id)=>save.stars[id]||0;
  const unlocked=(L)=>{ if(L.id===1) return true; const prev=LEVELS.find(x=>x.id===L.id-1); if(!prev||starsOf(prev.id)<1) return false; if(L.boss){ const chStars=LEVELS.filter(x=>x.ch===L.ch&&!x.boss).reduce((a,x)=>a+starsOf(x.id),0); return chStars>=10; } return true; };
  const freeUnlocked=()=>LEVELS.filter(x=>x.ch<=2).every(x=>starsOf(x.id)>=1);
  const totalStars=()=>Object.values(save.stars).reduce((a,b)=>a+b,0);

  function render(){
    if(screen!=='game'){ hideStage(); if(D){ try{ D.dispose(); }catch(e){} D=null; } }
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

  /* ================= OYUN (köy sahnesi) ================= */
  let endFolded=false; const speaker=createSpeaker(voice); loadVoices();
  let V=null, SC=null, D=null, is3d=false, cursor=0, sel=null, finalChoice=null, talkMode=null, defMode=null, shownLines=[];
  async function startGame(L){
    SFX.unlock();
    level=L; const longIntro=!save.seenIntro;
    const hn=(localStorage.getItem('vk_name')||'').trim()||'Oyuncu';
    G=new SoloGame(L,{rng:makeRng((Date.now()^(typeof L.id==='number'?L.id*2654435761:7))>>>0), humanName:hn, longIntro});
    if(longIntro){ save.seenIntro=true; persist(); }
    cursor=0; sel=null; finalChoice=null; talkMode=null; defMode=null; pendingXp=null; shownLines=[]; screen='game'; endFolded=false;
    if(D){ try{ D.dispose(); }catch(e){} D=null; } SC=null; V=null;
    is3d=stageWanted();
    if(is3d){
      const myG=G;
      app.innerHTML=`<div class="game g3d fade">
        <div class="topbar" id="gTop"></div>
        <div class="spacer"></div>
        <div class="subs" id="gLines"></div>
        <div id="gPanel"></div>
        <div id="gLog" class="logmodal hidden"></div>
        ${loadingHTML()}
      </div>`;
      drawTop();
      const bar=app.querySelector('#gLoadBar');
      try{
        const S3=await stage3d(); if(G!==myG || screen!=='game') return;
        S3.showStage(true);
        await S3.ensureStage((p)=>{ if(bar) bar.style.width=Math.round(p*100)+'%'; });
        if(G!==myG || screen!=='game') return;
        D=await S3.newDirector(G.players,{ voice, onLine:addLine, onPick:onHouse, speak:speaker, prefetch:prefetchLines });
        SC=D; V={ highlight:(id,on)=>D.highlight(id,on), setNight(){} };
        const ld=app.querySelector('#gLoad'); if(ld){ ld.classList.add('out'); setTimeout(()=>ld.remove(),700); }
        renderGame(); return;
      }catch(err){ console.error('3B açılamadı',err); is3d=false; hideStage(); setRenderPref('2d'); toast('3B grafik açılamadı, basit görünüme geçildi'); }
    }
    app.innerHTML=`<div class="game fade">
      <div class="topbar" id="gTop"></div>
      <div class="vwrap" id="gVillage"></div>
      <div class="lines" id="gLines"></div>
      <div id="gPanel"></div>
      <div id="gLog" class="logmodal hidden"></div>
    </div>`;
    V=createVillage(app.querySelector('#gVillage'), { players:G.players.map(p=>({id:p.id, name:p.human?p.name+' (sen)':p.name, avatar:p.avatar})), onHouse });
    SC=createScene({ village:V, voice, onLine:addLine, speak:speaker });
    V.setNight(false);
    renderGame();
  }
  function sync3d(){ if(!is3d||!D||!SC||SC.busy||!G) return; D.setMode(G.phase); D.setCandidates(pickCands()); }
  function renderGame(){ drawTop(); renderPanel(); sync3d(); }
  function flush(){
    if(!SC) return;
    const evs=G.events.slice(cursor); cursor=G.events.length;
    sel=null; talkMode=null; defMode=null; V.highlight(null); if(is3d&&D) D.setCandidates(null);
    SC.play(evs, ()=>{ SC.sync(G.villageState()); renderGame(); });
    renderGame();
  }
  function addLine(e){
    shownLines.push(e); if(shownLines.length>3) shownLines.shift();
    const el=app.querySelector('#gLines'); if(!el) return;
    if(is3d){ const l=e; const pv=shownLines.length>1?shownLines[shownLines.length-2]:null; const cut=(t,n)=>t.length>n?t.slice(0,n-2)+'…':t;
      el.innerHTML=`${pv?`<div class="prev">${esc(pv.t==='narr'?'Anlatıcı':pv.name)}: ${esc(cut(pv.text,72))}</div>`:''}<div class="who">${l.t==='narr'?'🌙 Anlatıcı':`${esc(l.avatar)} ${esc(l.name)}${l.title?` <span class="tt">· ${esc(l.title)}</span>`:''}`}</div><div class="tx ${l.t==='narr'?'narr':''} ${l.kind==='scream'?'scream':''}">${esc(l.text)}</div>`; return; }
    el.innerHTML=shownLines.map((l,i)=>`<div class="ln ${l.t==='narr'?'narr':''} ${l.kind==='scream'?'scream':''} ${i===shownLines.length-1?'last':''}"><b>${l.t==='narr'?'🌙':esc(l.avatar)} ${esc(l.name)}${l.title?` <span class="tt">${esc(l.title)}</span>`:''}:</b> ${esc(l.text)}</div>`).join('');
  }
  function drawTop(){
    const t=app.querySelector('#gTop'); if(!t||!G) return; const r=ROLE_INFO[G.human.role];
    const ph={roles:'Başlıyor',talk:'Meydan',select:'Seçim',defense:'Savunma',final:'Son karar',verdict:'Hüküm',night:'Gece',dawn:'Sabah',end:'Bitti'}[G.phase]||'';
    t.innerHTML=`<button id="bQuit">✕</button><span class="pill">${G.day?`Gün ${G.day} · `:''}${ph}</span><span class="pill">${r.ic} ${r.name}</span><button id="bLog">📜</button><button id="bVoice">${voice.on?'🔊':'🔇'}</button>`;
    t.querySelector('#bQuit').onclick=()=>{ if(G.phase==='end'||!SC||confirmQuit()){ SC&&SC.skip(); try{speechSynthesis.cancel();}catch(e){} screen=level.free?'free':'map'; render(); } };
    t.querySelector('#bVoice').onclick=()=>{ voice.set(!voice.on); if(!voice.on){ try{speechSynthesis.cancel();}catch(e){} } drawTop(); };
    t.querySelector('#bLog').onclick=toggleLog;
  }
  function toggleLog(){
    const m=app.querySelector('#gLog'); if(!m) return;
    if(!m.classList.contains('hidden')){ m.classList.add('hidden'); return; }
    let last=null; m.innerHTML=`<div class="login"><div class="row" style="align-items:center"><h2 style="font-size:18px">Konuşmalar</h2><button class="btn sm sec" id="bLogX" style="flex:none">Kapat</button></div><div class="logbody">${G.feed.map(f=>{ let s=''; if(f.day!==last){ last=f.day; s+=`<div class="fsep">Gün ${f.day}</div>`; } return s+(f.t==='narr'?`<div class="fnarr">${esc(f.text)}</div>`:`<div class="fb ${f.who==='me'?'me':''} ${f.kind}"><span class="fav">${f.avatar}</span><div class="fbody"><div class="fname">${esc(f.name)}${f.title?' · '+esc(f.title):''}</div><div>${esc(f.text)}</div></div></div>`); }).join('')}</div></div>`;
    m.classList.remove('hidden'); m.querySelector('#bLogX').onclick=()=>m.classList.add('hidden');
    const b=m.querySelector('.logbody'); b.scrollTop=b.scrollHeight;
  }
  function confirmQuit(){ if(quitArmed){ quitArmed=false; return true; } quitArmed=true; toast('Çıkmak için tekrar ✕\'e bas (oyun kaybolur)'); setTimeout(()=>quitArmed=false,3000); return false; }
  let quitArmed=false;

  /* ---- ev seçimi (dokunma) ---- */
  function pickCands(){
    if(!G||SC?.busy) return null;
    if(G.phase==='select'&&G.needs) return G.needs.cands;
    if(G.phase==='night'&&G.needs) return G.needs.cands;
    if(G.phase==='talk'&&talkMode) return G.alive().filter(p=>!p.human).map(p=>p.id);
    if(G.phase==='defense'&&defMode==='blame') return G.needs.targets;
    return null;
  }
  function onHouse(id){ const c=pickCands(); if(!c||!c.includes(id)) return; sel=id; V.highlight(id,true); renderPanel(); if(is3d&&D) D.setCandidates(c); }
  const chips=(ids)=>`<div class="chips">${ids.map(id=>{ const p=G.P(id); return `<button class="chip ${sel===id?'on':''}" data-chip="${id}">${p.avatar} ${esc(p.human?p.name+' (sen)':p.name)}${p.claimed?` <small>"${ROLE_INFO[p.claimed].name}"</small>`:''}</button>`; }).join('')}</div>`;

  function renderPanel(){
    const el=app.querySelector('#gPanel'); if(!el||!G) return;
    if(!SC){ el.innerHTML=''; return; }
    if(SC.busy){ el.innerHTML=is3d?`<div class="skipf"><button id="bSkip">⏩ Geç</button></div>`:`<div class="card panelc"><button class="btn sec" id="bSkip">⏩ Geç</button></div>`; el.querySelector('#bSkip').onclick=()=>SC.skip(); return; }
    const h=G.human, r=ROLE_INFO[h.role]; let html='';
    switch(G.phase){
      case 'roles': {
        const mates=G.players.filter(p=>p.role==='vampir'&&p!==h);
        html=`<div class="rolecard ${h.role}" style="padding:16px"><div class="ic" style="font-size:54px">${r.ic}</div><div class="rn">${r.name}</div><div class="rd">${ROLE_DESC[h.role]}</div>${h.role==='vampir'&&mates.length?`<div style="margin-top:10px;color:var(--blood2);font-weight:800">Ortağın: ${mates.map(m=>m.avatar+' '+esc(m.name)).join(', ')}</div>`:''}</div>
          <button class="btn gold" id="bGo">🔔 Meydana toplan</button>`; break; }
      case 'talk': {
        if(talkMode){
          if(talkMode==='claimSeer'){ const o=G.humanOptions().find(x=>x.type==='claimSeer'); html=`<div class="card panelc"><label>${h.role==='kahin'?'Hangi kehanetini açıklayacaksın?':'Kimi işaret edeceksin? (yalan)'}</label><div class="chips">${o.results.map((x,i)=>`<button class="chip" data-claim="${i}">${G.P(x.target).avatar} ${esc(G.P(x.target).name)} <small class="${x.isVamp?'bad':'ok'}">${x.isVamp?'VAMPİR':'temiz'}</small></button>`).join('')}</div><button class="btn sec" id="bCancel">Vazgeç</button></div>`; }
          else html=`<div class="card panelc"><label>${talkMode==='accuse'?'Kimi suçlayacaksın? Evine dokun':'Kimi savunacaksın? Evine dokun'}</label>${chips(pickCands())}<div class="row"><button class="btn sec" id="bCancel">Vazgeç</button><button class="btn ${talkMode==='accuse'?'':'green'}" id="bDo" ${sel?'':'disabled'}>${talkMode==='accuse'?'Suçla':'Savun'}</button></div></div>`;
        } else {
          html=`<div class="card panelc"><label>Sıra sende — ne diyeceksin? <span class="tt">Tur ${G.round}/${G.roundsToday}</span></label><div class="acts">${G.humanOptions().map(o=>`<button class="btn sm ${o.type==='accuse'?'':o.type==='defend'?'green':o.type==='quiet'?'sec':'blue'}" data-act="${o.type}">${o.label}</button>`).join('')}</div></div>`;
        }
        break; }
      case 'select':
        html=`<div class="card panelc"><label>🏠 Şüphelendiğin kişinin evine dokun</label>${chips(G.needs.cands)}<button class="btn" id="bSel" ${sel?'':'disabled'}>${sel?`${esc(G.P(sel).name)} meydana getirilsin!`:'Bir ev seç'}</button></div>`; break;
      case 'defense': {
        if(defMode==='blame') html=`<div class="card panelc"><label>Kimi işaret edeceksin?</label>${chips(G.needs.targets)}<div class="row"><button class="btn sec" id="bCancel">Vazgeç</button><button class="btn" id="bBlame" ${sel?'':'disabled'}>Onu göster!</button></div></div>`;
        else html=`<div class="card panelc" style="border-color:var(--blood2)"><label style="color:var(--blood2)">⚖️ Meydanda sen varsın! Kendini savun:</label><div class="acts">${G.needs.options.map(o=>`<button class="btn sm ${o.key==='silent'?'sec':o.key==='role'?'blue':o.key==='blame'?'':'green'}" data-def="${o.key}">${o.label}</button>`).join('')}</div></div>`;
        break; }
      case 'final': {
        const acc=G.P(G.accused); const locks=Object.entries(G.finalVotes);
        html=`<div class="card panelc"><label>Son karar: <b style="color:var(--gold)">${acc.avatar} ${esc(acc.name)}</b> asılsın mı?</label>
          ${locks.length?`<div class="note" style="text-align:left">Kitleyenler: ${locks.map(([k,v])=>`${G.P(k).avatar}${v==='hang'?'🪢':'🕊️'}`).join(' ')}</div>`:''}
          <div class="row"><button class="btn ${finalChoice==='hang'?'':'sec'}" data-fv="hang">🪢 AS</button><button class="btn ${finalChoice==='release'?'green':'sec'}" data-fv="release">🕊️ BIRAK</button></div>
          <button class="btn gold" id="bLock" ${finalChoice?'':'disabled'}>🔒 Oyumu kitledim</button></div>`; break; }
      case 'verdict': {
        const lv=G.lastVote||{};
        html=`<div class="card panelc" style="text-align:center">${lv.hanged?(lv.role==='vampir'?`<div class="big" style="color:var(--blood2)">🧛 VAMPİR ÇIKTI!</div><div class="note">${esc(lv.name)} kazığa oturtuldu.</div>`:`<div class="big">🪢 ${esc(lv.name)}</div><div class="note">${ROLE_INFO[lv.role].ic} ${ROLE_INFO[lv.role].name} idi. (${lv.hang} AS / ${lv.rel} BIRAK)</div>`):`<div class="big">🕊️ Bırakıldı</div><div class="note">${esc(lv.name||'')} bugün kurtuldu (${lv.hang} AS / ${lv.rel} BIRAK).</div>`}
          <button class="btn" id="bNight">🌙 Herkes evine, gece olsun</button></div>`; break; }
      case 'night': {
        if(!G.needs){ html=''; break; }
        const n=G.needs; const t={vamp:'🧛 Kimin evine gireceksin?',doktor:'🩺 Kimin evini koruyacaksın?',kahin:'🔮 Kimin evine bakacaksın?'}[n.type];
        html=`<div class="card panelc"><label>${t} <span class="tt">Eve dokun</span></label>${chips(n.cands)}<button class="btn ${n.type==='doktor'?'green':n.type==='kahin'?'blue':''}" id="bNightGo" ${sel?'':'disabled'}>${{vamp:'Kanını em',doktor:'Koru',kahin:'Bak'}[n.type]}</button></div>`; break; }
      case 'dawn': {
        const sr=G.lastNight?.seer;
        html=`${sr?`<div class="card panelc" style="text-align:center;border-color:var(--blue)">🔮 <b>${esc(G.P(sr.target).name)}</b> ${sr.isVamp?'<span class="bad">bir VAMPİR!</span>':'<span class="ok">vampir değil.</span>'}<div class="note">Sadece sen biliyorsun.</div></div>`:''}
          <button class="btn gold" id="bTalk">🔔 Meydana toplan</button>`; break; }
      case 'end': html=is3d?`<div class="skipf" style="margin-bottom:6px"><button id="bFold">${endFolded?'▴ Sonucu göster':'▾ Sahneyi gör'}</button></div><div class="sheet-scroll" style="${endFolded?'display:none':''}">${viewEnd()}</div>`:viewEnd(); break;
    }
    el.innerHTML=html; bindPanel(el); if(is3d) sync3d();
  }
  function bindPanel(el){
    const q=(s)=>el.querySelector(s);
    q('#bGo')&&(q('#bGo').onclick=()=>{ G.ackRole(); flush(); });
    el.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>onHouse(b.dataset.chip));
    el.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{ const t=b.dataset.act; if(t==='quiet'||t==='claimDoctor'){ G.talkAction({type:t}); flush(); } else { talkMode=t; sel=null; renderPanel(); } });
    el.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>{ const o=G.humanOptions().find(x=>x.type==='claimSeer'); const x=o.results[+b.dataset.claim]; G.talkAction({type:'claimSeer',target:x.target,isVamp:x.isVamp}); flush(); });
    q('#bCancel')&&(q('#bCancel').onclick=()=>{ talkMode=null; defMode=null; sel=null; V.highlight(null); renderPanel(); });
    q('#bFold')&&(q('#bFold').onclick=()=>{ endFolded=!endFolded; renderPanel(); });
    q('#bDo')&&(q('#bDo').onclick=()=>{ G.talkAction({type:talkMode,target:sel}); flush(); });
    q('#bSel')&&(q('#bSel').onclick=()=>{ G.selectHouse(sel); flush(); });
    el.querySelectorAll('[data-def]').forEach(b=>b.onclick=()=>{ const k=b.dataset.def; if(k==='blame'){ defMode='blame'; sel=null; renderPanel(); } else { G.defend(k); flush(); } });
    q('#bBlame')&&(q('#bBlame').onclick=()=>{ G.defend('blame',sel); flush(); });
    el.querySelectorAll('[data-fv]').forEach(b=>b.onclick=()=>{ finalChoice=b.dataset.fv; renderPanel(); });
    q('#bLock')&&(q('#bLock').onclick=()=>{ const v=finalChoice; finalChoice=null; G.finalVote(v); flush(); });
    q('#bNight')&&(q('#bNight').onclick=()=>{ G.nextNight(); flush(); });
    q('#bNightGo')&&(q('#bNightGo').onclick=()=>{ G.nightAction(sel); flush(); });
    q('#bTalk')&&(q('#bTalk').onclick=()=>{ G.startTalk(); flush(); });
    q('#bNext')&&(q('#bNext').onclick=()=>{ level=LEVELS.find(l=>l.id===level.id+1); screen='intro'; render(); });
    q('#bRetry')&&(q('#bRetry').onclick=()=>startGame(level));
    q('#bMap')&&(q('#bMap').onclick=()=>{ screen=level.free?'free':'map'; render(); });
  }
  function viewEnd(){
    const res=G.result; if(!pendingXp) applyResult(res);
    const h=G.human; const rk=rankFor(save.xp);
    const next=level.free?null:LEVELS.find(l=>l.id===level.id+1);
    return `<div class="banner ${res.won?'day':'night'}"><div class="big">${res.won?'🏆':'💀'}</div><div class="t">${res.won?'Kazandın!':'Kaybettin'}</div><div class="d">${G.winner==='vampir'?'Vampirler köyü ele geçirdi.':'Köy vampirlerden kurtuldu.'} · ${res.days} gün${G.stats.humanDiedDay?` · ${G.stats.humanDiedDay}. gün öldün`:''}</div>
      <div class="stars ${res.stars?'won':''}">${[1,2,3].map(i=>`<span class="${i<=res.stars?'on':''}" style="animation-delay:${i*.25}s">★</span>`).join('')}</div></div>
      <div class="card">
        <div class="obj ${res.won?'ok':'bad'}">${res.won?'✔':'✘'} Kazan</div>
        <div class="obj ${res.objOk?'ok':'bad'}">${res.objOk?'✔':'✘'} ${esc(res.objText)}</div>
        <div class="obj ${res.perfect?'ok':'bad'}">${res.perfect?'✔':'✘'} ${h.role==='vampir'?'En fazla 1 oy al':'Hiç yanlış kişiye AS deme, hayatta kal'}</div>
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
    let r3d=true, curQ='auto'; try{ r3d=localStorage.getItem('vk_render')!=='2d'; curQ=localStorage.getItem('vk_quality')||'auto'; }catch(e){}
    app.innerHTML=`<div class="fade">
      <div class="topbar"><button id="bBack">‹ Harita</button><span class="pill">İstatistik</span><span></span></div>
      <div class="card"><div class="row"><div><label>Oyun</label><div class="big">${save.games}</div></div><div><label>Kazanma</label><div class="big">%${wr}</div></div><div><label>En iyi seri</label><div class="big">${save.best}</div></div></div></div>
      <div class="card"><label>Role göre</label><ul class="plist">${Object.keys(ROLE_INFO).map(r=>{ const b=save.byRole[r]||{g:0,w:0}; return `<li><span class="av">${ROLE_INFO[r].ic}</span><span class="nm">${ROLE_INFO[r].name}</span><span class="tag">${b.g} oyun</span><span class="cnt" style="background:${b.g?'var(--green)':'var(--card2)'};color:#03150c">${b.g?Math.round(100*b.w/b.g)+'%':'–'}</span></li>`; }).join('')}</ul></div>
      <div class="card"><label>Rütbeler</label><ul class="plist">${RANKS.map(k=>`<li class="${save.xp>=k.xp?'':'dead'}"><span class="av">${k.ic}</span><span class="nm">${k.name}</span><span class="tag">${k.xp} XP</span></li>`).join('')}</ul></div>
      <div class="card"><label>Grafik</label>
        <div class="acts"><button class="btn sm ${r3d?'gold':'sec'}" data-gfx="3d">🎬 3B sinematik</button><button class="btn sm ${r3d?'sec':'gold'}" data-gfx="2d">🖼️ 2B basit</button></div>
        <div class="acts">${['auto','high','medium','low'].map(k=>`<button class="btn sm ${curQ===k?'gold':'sec'}" data-q="${k}">${{auto:'Otomatik',high:'Yüksek',medium:'Orta',low:'Düşük'}[k]}</button>`).join('')}</div>
        <div class="note">Kalite değişikliği uygulamayı yeniden açınca uygulanır. Telefon ısınırsa Orta/Düşük seç.</div></div>
      <div class="card"><label>Ayarlar</label><button class="btn ${save.hard!==false?'':'sec'}" id="bHard">${save.hard!==false?'🌶️ Sert mod AÇIK (argolu şive)':'🙂 Sert mod KAPALI (yumuşak dil)'}</button><button class="btn sec" id="bIntro">Açılış sahnesini yeniden göster</button></div>
      <button class="btn sec" id="bReset">İlerlemeyi sıfırla</button></div>`;
    app.querySelector('#bBack').onclick=()=>{screen='map';render();};
    app.querySelectorAll('[data-gfx]').forEach(b=>b.onclick=()=>{ setRenderPref(b.dataset.gfx); render(); });
    app.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ setQualityPref(b.dataset.q==='auto'?null:b.dataset.q); render(); toast('Kalite ayarı kaydedildi'); });
    app.querySelector('#bHard').onclick=()=>{ save.hard = save.hard===false; setHardMode(save.hard); persist(); render(); };
    app.querySelector('#bIntro').onclick=()=>{ save.seenIntro=false; persist(); toast('Bir sonraki oyunda açılış sahnesi tam oynayacak'); };
    app.querySelector('#bReset').onclick=()=>{ if(resetArmed){ save={stars:{},xp:0,games:0,wins:0,byRole:{},streak:0,best:0}; persist(); resetArmed=false; toast('İlerleme sıfırlandı'); render(); } else { resetArmed=true; toast('Emin misin? Tekrar bas.'); setTimeout(()=>resetArmed=false,3000);} };
  }
  let resetArmed=false;

  return { show(){ screen='map'; render(); } };
}
