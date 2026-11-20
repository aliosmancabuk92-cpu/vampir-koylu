/* =====================================================================
   ORTAK ARAYÜZ PARÇALARI — tek kişilik ve odalı ekranlar aynı kartları çizer
   Hepsi HTML metni döndürür; düğmeler data-… öznitelikleriyle bağlanır.
   nm(id) → oyuncu adı (kaçışlı), av(id) → avatar
   ===================================================================== */
import * as RL from './rules.js';

export const REACT_LABEL = { yuh:'👎 Yuh!', hah:'😂 Hah hah!', vallahi:'☝️ Vallahi o!', hadi:'🙄 Hadi ordan!', helal:'👏 Helal!' };

/** köy olayı kartı */
export function eventCard(k){ const e=RL.EVENTS[k]; if(!e) return ''; return `<div class="evt"><span class="ei">${e.ic}</span><div><b>${e.name}</b><div class="ed">${e.desc}</div></div></div>`; }

/** sabah ipuçları: insp={clueId:'fresh'|'fake'}, left=kalan inceleme hakkı */
export function clueCards({ clues, nm, insp={}, left=0, canInspect=true }){
  if(!clues||!clues.length) return '';
  return `<div class="clues">${clues.map(c=>{ const K=RL.CLUE_KINDS[c.kind]||RL.CLUE_KINDS.iz; const r=insp[c.id];
    const st=r?`<span class="cres ${r==='fresh'?'ok':'bad'}">🔍 ${r==='fresh'?'Taze, gerçek gibi':'Sonradan konmuş gibi'}</span>`:(c.sure?`<span class="cres ok">Kesin iz</span>`:(canInspect&&left>0?`<button class="btn sm bt" data-insp="${c.id}">🔍 İncele</button>`:''));
    return `<div class="clue"><span class="ci">${K.ic}</span><div class="cb"><div class="ck">${K.name} ${st}</div><div class="cn">${c.ids.map(id=>`<span>${nm(id)}</span>`).join('')}</div></div></div>`; }).join('')}${canInspect&&left>0?`<div class="note" style="margin:2px 0 0">Bir ipucunu inceleyebilirsin: gerçek mi, sonradan mı konmuş? (her zaman doğru çıkmaz)</div>`:''}</div>`;
}

/** gece öğrendiklerin (yalnızca sana) */
export function privNotes({ seer, guard, watch, gossip, wentOut, mate }, nm){
  const out=[];
  if(seer) out.push(`🔮 <b>${nm(seer.target)}</b> ${seer.isVamp?'<span class="bad">bir VAMPİR!</span>':'<span class="ok">vampir değil.</span>'}`);
  if(guard) out.push(guard.out===null?`🔦 Fırtınada <b>${nm(guard.target)}</b> evini göremedin.`:`🔦 <b>${nm(guard.target)}</b> ${guard.out?'<span class="bad">gece evinden ÇIKTI!</span>':'<span class="ok">gece evindeydi.</span>'}`);
  if(watch) out.push(watch.saw==='out'?`🪟 Pencereden gördün: <b>${nm(watch.target)}</b> <span class="bad">gece evinden çıktı!</span>`:`🪟 <b>${nm(watch.target)}</b> evinde bir hareket görmedin.`);
  if(gossip) out.push(`🗣️ Dedikodu: <b>${nm(gossip[0])}</b> ya da <b>${nm(gossip[1])}</b> — ikisinden biri gece dışarıdaydı.`);
  if(wentOut===true) out.push(`🧛 Bu gece dışarı <b>sen</b> çıktın; izler sana çıkabilir.`);
  if(wentOut===false) out.push(`🧛 Bu gece dışarı ortağın çıktı; sen evdeydin.`);
  if(!out.length) return '';
  return `<div class="card panelc priv">${out.map(x=>`<div>${x}</div>`).join('')}<div class="note" style="margin-top:4px">Sadece sen biliyorsun.</div></div>`;
}

/** gece seçimi başlıkları */
export const NIGHT_UI = {
  bite:   { q:'🧛 Kimin evine gireceksin?', go:'Kanını em', cls:'' },
  vamp:   { q:'🧛 Kimin evine gireceksin?', go:'Kanını em', cls:'' },
  bite2:  { q:'🌕 Dolunay! İkinci bir kapı çalacak mısın?', go:'Onu da em', cls:'', skip:'Bir kişi yeter' },
  plant:  { q:'👣 Kimin kapısına sahte iz bırakacaksın?', go:'İzi bırak', cls:'gold', skip:'İz bırakma' },
  doctor: { q:'📿 Kimin evini okuyup üfleyeceksin?', go:'Koru', cls:'green' },
  doktor: { q:'📿 Kimin evini okuyup üfleyeceksin?', go:'Koru', cls:'green' },
  seer:   { q:'🔮 Kimin evine bakacaksın?', go:'Bak', cls:'blue' },
  kahin:  { q:'🔮 Kimin evine bakacaksın?', go:'Bak', cls:'blue' },
  guard:  { q:'🔦 Hangi evi gözetleyeceksin?', go:'Gözetle', cls:'blue' },
  bekci:  { q:'🔦 Hangi evi gözetleyeceksin?', go:'Gözetle', cls:'blue' },
  watch:  { q:'🪟 Pencereden hangi evi gözetleyeceksin?', go:'Gözetle', cls:'blue', skip:'😴 Yorganı başına çek', note:'Gözetlersen ışığın yanık kalır: sabah izlerin arasında senin evin de sayılabilir.' },
};

/** hayalet paneli: domates / kapı / bahis / fısıltı düğmeleri (hedef seçimi çağıran tarafta) */
export function ghostPanel({ canTomato, canRattle, canWhisper, bet, nm }){
  return `<div class="card panelc ghost"><label>👻 Hayaletsin — ama iş bitmedi</label>
    <div class="acts">
      <button class="btn sm sec" data-gh="tomato" ${canTomato?'':'disabled'}>🍅 Domates at</button>
      <button class="btn sm sec" data-gh="rattle" ${canRattle?'':'disabled'}>🚪 Kapı tıkırdat</button>
      <button class="btn sm ${bet?'sec':'gold'}" data-gh="bet">🎲 ${bet?`Bahsin: ${nm(bet)}`:'Vampir kim? Bahse gir'}</button>
      <button class="btn sm blue" data-gh="whisper" ${canWhisper?'':'disabled'}>🌬️ Fısılda ${canWhisper?'(1 hak)':'(kullanıldı)'}</button>
    </div></div>`;
}
export const GHOST_Q = { tomato:'Kime domates atacaksın?', rattle:'Kimin kapısını tıkırdatacaksın?', bet:'Sence vampir kim?', whisper:'Kime fısıldayacaksın? (içinde vampir olan üç ev söylenir)' };

/** oyun sonu: ödüller + gün gün olanlar */
export function awardsHTML(list, nm, av){
  if(!list||!list.length) return '';
  return `<div class="card"><label>Köyün ödülleri</label>${list.map(a=>`<div class="award"><span class="ai">${a.ic}</span><div><b>${a.title}</b> · ${av(a.who)} ${nm(a.who)}<div class="ed">${a.note}</div></div></div>`).join('')}</div>`;
}
export function timelineHTML(hist, players, nm){
  if(!hist||!hist.length) return ''; const P=(id)=>players.find(p=>p.id===id); const rn=(id)=>{ const p=P(id); return p?`${RL.ROLES[p.role]?.ic||''}`:''; };
  const rows=hist.map(H=>{ const L=[];
    if(H.first) L.push('🐔 İlk gece: tavuk gitti, kimse ölmedi.');
    else if(H.killed&&H.killed.length) L.push(`🌙 Gece: ${H.killed.map(id=>`<b>${nm(id)}</b> ${rn(id)}`).join(', ')} öldü.`);
    else L.push(H.saved?'🌙 Gece: hoca korudu, kimse ölmedi.':'🌙 Gece: kimse ölmedi.');
    if(H.grief&&H.grief.length) L.push(`💔 ${H.grief.map(id=>`<b>${nm(id)}</b>`).join(', ')} sevdiğinin ardından gitti.`);
    if(H.event) L.push(`${RL.EVENTS[H.event].ic} ${RL.EVENTS[H.event].name}`);
    for(const c of H.clues||[]){ const K=RL.CLUE_KINDS[c.kind]||RL.CLUE_KINDS.iz; L.push(`${K.ic} ${c.ids.map(id=>nm(id)).join(', ')} → ${c.real?'<span class="ok">gerçek iz</span>':c.planted?'<span class="bad">vampirin sahte izi</span>':'<span style="color:var(--muted)">boş iz</span>'}`); }
    if(H.wedding) L.push('🥁 Düğün günü: kimse asılmadı.');
    else if(H.accused){ L.push(H.hanged?`🪢 <b>${nm(H.accused)}</b> ${rn(H.accused)} asıldı (${H.hang}–${H.rel}).`:`🕊️ <b>${nm(H.accused)}</b> bırakıldı (${H.hang}–${H.rel}).`);
      if(H.votes){ const hv=Object.entries(H.votes).filter(([,v])=>v==='hang').map(([id])=>nm(id)), rv=Object.entries(H.votes).filter(([,v])=>v==='release').map(([id])=>nm(id)); L.push(`<span class="vt">AS: ${hv.join(', ')||'–'} · BIRAK: ${rv.join(', ')||'–'}</span>`); } }
    if(H.griefDay&&H.griefDay.length) L.push(`💔 ${H.griefDay.map(id=>`<b>${nm(id)}</b>`).join(', ')} sevdiğinin ardından gitti.`);
    return `<div class="tl"><div class="td">Gün ${H.day}</div>${L.map(x=>`<div class="tr">${x}</div>`).join('')}</div>`; });
  return `<details class="card"><summary><label style="cursor:pointer">📜 Gün gün neler oldu (kim kime oy verdi, hangi iz sahteydi)</label></summary>${rows.join('')}</details>`;
}

/* ---------------------------- PAYLAŞIM KARTI ---------------------------- */
/** oyun sonu kartını çizer → Promise<Blob> (PNG) */
export async function makeShareCard({ title, sub, players, awards, days }){
  const W=1080, H=1350; const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#1b1430'); g.addColorStop(1,'#07050e'); x.fillStyle=g; x.fillRect(0,0,W,H);
  const rg=x.createRadialGradient(W*0.8,-80,40,W*0.8,-80,700); rg.addColorStop(0,'rgba(226,59,74,.35)'); rg.addColorStop(1,'rgba(226,59,74,0)'); x.fillStyle=rg; x.fillRect(0,0,W,H);
  const F=(px,w=800,fam='Nunito, system-ui, sans-serif')=>{ x.font=`${w} ${px}px ${fam}`; };
  x.textAlign='center'; x.fillStyle='#e23b4a'; F(84,800,'Cinzel, Georgia, serif'); x.fillText('VAMPİR KÖYLÜ',W/2,150);
  x.fillStyle='#ece7f5'; F(64,800); x.fillText(title,W/2,270);
  x.fillStyle='#9b94b3'; F(36,600); x.fillText(sub||`${days} gün sürdü`,W/2,330);
  // roller: iki sütun
  x.textAlign='left'; const n=players.length; const cols=n>8?2:1; const rowsN=Math.ceil(n/cols); const top=380; const rh=Math.min(72,Math.floor(520/rowsN)); const cw=(W-140)/cols;
  players.forEach((p,i)=>{ const col=Math.floor(i/rowsN), row=i%rowsN; const px=70+col*cw, py=top+row*rh;
    x.fillStyle=p.alive?'rgba(255,255,255,.07)':'rgba(255,255,255,.03)'; x.beginPath(); x.roundRect(px,py,cw-20,rh-10,16); x.fill();
    F(Math.min(40,rh-26),800); x.fillStyle=p.alive?'#ece7f5':'#7d7794'; x.fillText(`${p.avatar||'🙂'}  ${p.name}`.slice(0,22),px+18,py+rh/2+8);
    x.textAlign='right'; x.fillStyle=p.role==='vampir'?'#e23b4a':'#d9a441'; F(Math.min(32,rh-30),800); x.fillText(`${RL.ROLES[p.role]?.ic||''} ${RL.roleName(p.role)}`,px+cw-38,py+rh/2+7); x.textAlign='left'; });
  // ödüller
  let y=top+rowsN*rh+58; x.fillStyle='#d9a441'; F(40,800,'Cinzel, Georgia, serif'); x.fillText('KÖYÜN ÖDÜLLERİ',70,y); y+=20;
  const P=(id)=>players.find(p=>p.id===id);
  for(const a of (awards||[]).slice(0,4)){ y+=62; if(y>H-110) break; F(44,800); x.fillStyle='#ece7f5'; x.fillText(`${a.ic}  ${a.title}`,70,y); x.textAlign='right'; F(36,700); x.fillStyle='#9b94b3'; x.fillText(`${P(a.who)?.name||''} · ${a.note}`.slice(0,34),W-70,y); x.textAlign='left'; }
  x.textAlign='center'; x.fillStyle='#9b94b3'; F(30,700); x.fillText('Sen de oyna: aliosmancabuk92-cpu.github.io/vampir-koylu',W/2,H-50);
  return await new Promise(res=>c.toBlob(res,'image/png'));
}
/** kartı paylaş: telefonun paylaşım menüsü; olmazsa indir; uygulamada dosya olarak kaydedip paylaş */
export async function shareCard(blob, text, toast){
  const file=new File([blob],'vampir-koylu.png',{ type:'image/png' });
  try{
    // Android uygulaması: çekirdek JS yüklü olmadığı için yerel köprü doğrudan çağrılır
    const Cap=window.Capacitor; const call=Cap&&typeof Cap.nativePromise==='function'?(pl,m,o)=>Cap.nativePromise(pl,m,o):null;
    if(Cap?.isNativePlatform?.()&&call){
      const b64=await new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
      const w=await call('Filesystem','writeFile',{ path:'vampir-koylu.png', data:b64, directory:'CACHE' });
      await call('Share','share',{ title:'Vampir Köylü', text, files:[w.uri] }); return 'shared';
    }
    if(navigator.canShare&&navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], text, title:'Vampir Köylü' }); return 'shared'; }
  }catch(e){ if(e&&(e.name==='AbortError'||/cancel|iptal/i.test(String(e.message||e)))) return 'cancel'; if(window.Capacitor?.isNativePlatform?.()){ toast&&toast('Paylaşılamadı'); return 'fail'; } }
  try{ const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download='vampir-koylu.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); toast&&toast('Kart indirildi; galeriden paylaşabilirsin'); return 'saved'; }catch(e){ toast&&toast('Paylaşılamadı'); return 'fail'; }
}
