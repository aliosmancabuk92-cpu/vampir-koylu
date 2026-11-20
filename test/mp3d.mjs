// Odalı mod: 4 oyuncu, v5 akışı
// roller → açılış → ilk gece (kimse ölmez; gözetleme/sahte iz) → sabah (ipuçları, özel notlar) → meydan (tepki, inceleme)
// → seçim → savunma → kilitli oy → infaz → hayalet (bahis/domates) → gece → sabah → ... → bitiş (ödüller, paylaş, rövanş)
import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(import.meta.dirname, '..');
const BASE = process.argv[2] || null; // canlı adres verilirse onu kullan
const types={'.js':'text/javascript','.html':'text/html','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg'};
const server = http.createServer((req,res)=>{ const u=decodeURIComponent(req.url.split('?')[0]); const f=path.join(root,'www', u==='/'?'index.html':u); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type': types[path.extname(f)]||'application/octet-stream'}); res.end(d); }); }).listen(0);
const URL0 = BASE || `http://127.0.0.1:${server.address().port}/`;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>{ const l=new Date().toISOString().slice(11,19)+' '+a.join(' '); console.log(l); fs.appendFileSync('/tmp/mp.log', l+'\n'); };
fs.writeFileSync('/tmp/mp.log','');
const browser = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, protocolTimeout:600000, args:['--no-sandbox','--use-angle=swiftshader',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });
const shotDir=process.env.OUT||path.join(root,'test','shots'); fs.mkdirSync(shotDir,{recursive:true});
let errN=0;
const R3D=(process.env.R3D||'Zeynep').split(','); const FEM=['Ayşe','Zeynep'];
async function newPlayer(name){
  const ctx=await browser.createBrowserContext(); const page=await ctx.newPage(); await page.setViewport({width:390,height:844});
  page.on('pageerror', e=>{ errN++; log(`[${name}] PAGEERROR`, e.message); });
  await page.goto(URL0,{waitUntil:'networkidle0'});
  await page.evaluate((o)=>{ localStorage.setItem('vk_voice','0'); localStorage.setItem('vk_render',o.r3d?'3d':'2d'); localStorage.setItem('vk_quality','low'); localStorage.setItem('vk_gender',o.fem?'f':'m'); },{ r3d:R3D.includes(name), fem:FEM.includes(name) });
  await page.reload({waitUntil:'networkidle0'});
  await page.evaluate((n)=>{ const i=document.querySelector('#mName'); i.value=n; i.dispatchEvent(new Event('change')); }, name);
  await page.evaluate(()=>document.querySelector('#mMulti').click()); await page.waitForSelector('#name');
  return page;
}
const text=(p)=>p.evaluate(()=>document.body.innerText);
const clickSel=(p,sel)=>p.evaluate(s=>{ const e=document.querySelector(s); if(e&&!e.disabled){ e.click(); return true; } return false; }, sel);
const names=['Ali','Ayşe','Mehmet','Zeynep']; const pg={};
const skipAll=async()=>{ for(const n of names) if(pg[n]) await clickSel(pg[n],'#mSkip'); };
/** sahne oynarken herkes Geç'e basar (hazır bildirimi gitsin diye), seçici görünene kadar beklenir */
async function until(p, sel, ms=240000){
  const t0=Date.now();
  while(Date.now()-t0<ms){ if(await p.$(sel)) return true; await skipAll(); await sleep(250); }
  throw new Error(`${sel} bekleniyordu: `+(await text(p)).slice(-300).replace(/\s+/g,' '));
}
async function untilText(p, needle, ms=240000){ const t0=Date.now(); const re=needle instanceof RegExp?needle:null; while(Date.now()-t0<ms){ const t=await text(p); if(re?re.test(t):t.includes(needle)) return t; await skipAll(); await sleep(250); } throw new Error(`"${needle}" bekleniyordu: `+(await text(p)).slice(-300).replace(/\s+/g,' ')); }
async function chip(p, name){ await until(p,'[data-chip]'); const ok=await p.evaluate(n=>{ const b=[...document.querySelectorAll('[data-chip]')].find(x=>x.textContent.includes(n)); if(!b) return false; b.click(); return true; }, name); if(!ok) throw new Error('chip yok: '+name); await sleep(120); }
const shot=(p,f)=>p.screenshot({path:path.join(shotDir,f)});
const shot3d=async(tag)=>{ for(const n of R3D) if(pg[n]) await shot(pg[n],`${tag}-3d-${n}.png`); };

pg.Ali=await newPlayer('Ali'); await clickSel(pg.Ali,'#bCreate'); await pg.Ali.waitForSelector('.codebox .c');
const code=await pg.Ali.$eval('.codebox .c',e=>e.textContent); log('Oda', code);
for(const n of names.slice(1)){ const p=await newPlayer(n); await clickSel(p,'#bJoin'); await p.waitForSelector('#code'); await p.type('#code',code); await clickSel(p,'#bGo'); await p.waitForFunction(()=>document.body.innerText.includes('Oyuncular'),{timeout:20000}); pg[n]=p; log(n,'katıldı'); }
await pg.Ali.waitForFunction(()=>document.body.innerText.includes('4 kişi'),{timeout:20000});
await shot(pg.Ali,'mp00-lobby.png');
await clickSel(pg.Ali,'#bStart');
const roles={};
for(const n of names){ await until(pg[n],'#mAck'); roles[n]=await pg[n].$eval('.rolecard .rn',e=>e.textContent); }
log('Roller', JSON.stringify(roles));
const by=(r)=>names.filter(n=>roles[n]===r); const vamp=by('Vampir')[0], doc=by('Hoca')[0], seer=by('Kâhin')[0], vil=by('Köylü')[0];
if(!vamp||!doc||!seer||!vil) throw new Error('rol dağılımı beklenenden farklı');
await shot(pg[doc],'mp00b-role.png');
for(const n of names) await clickSel(pg[n],'#mAck');

// İLK GECE: kimse ölmez. Vampir sahte iz bırakır, kâhin vampire bakar, hoca pencereden vampiri gözetler, köylü yatar.
await until(pg[vamp],'#mNightGo'); log('Açılış bitti, ilk gece (kapı kendiliğinden açıldı)');
await shot(pg[vamp],'mp01-night1-vamp.png'); await shot(pg[vil],'mp01-night1-watch.png'); await shot3d('mp01');
if(!/sahte iz|SAHTE İZ/.test(await text(pg[vamp]))) throw new Error('vampire ilk gece sahte iz sorulmalıydı');
await chip(pg[vamp], doc); await clickSel(pg[vamp],'#mNightGo');
await until(pg[seer],'#mNightGo'); await chip(pg[seer], vamp); await clickSel(pg[seer],'#mNightGo');
await until(pg[doc],'#mNightGo'); if(!/Pencereden|PENCEREDEN/.test(await text(pg[doc]))) throw new Error('hoca ilk gece gözetleme yapmalıydı'); await chip(pg[doc], vamp); await clickSel(pg[doc],'#mNightGo');
await until(pg[vil],'#mNightSkip'); await clickSel(pg[vil],'#mNightSkip');
// SABAH 1
for(const n of names) await untilText(pg[n],'Gün 1');
const d1=await untilText(pg[seer],'VAMPİR'); log('İlk gece: kimse ölmedi, kâhin vampiri gördü ✔');
await untilText(pg[vamp],'dışarı sen çıktın');
if(!/Sahte|sahte|iz|İz|tüy|havla|kan|Baca|baca/.test(await text(pg.Ali))) log('UYARI: sabah ipucu metni yok');
await sleep(600); await shot(pg[seer],'mp02-dawn1-seer.png'); await shot(pg[vamp],'mp02-dawn1-vamp.png'); await shot3d('mp02');
// ipucu inceleme
if(!(await pg[vil].$('[data-insp]'))) await clickSel(pg[vil],'#mClues'); await sleep(300);
if(await pg[vil].$('[data-insp]')){ await clickSel(pg[vil],'[data-insp]'); await untilText(pg[vil],/gerçek gibi|sonradan konmuş/i,15000); log('İpucu incelendi ✔'); await shot(pg[vil],'mp02b-inspect.png'); } else log('UYARI: incele düğmesi yok');
// MEYDAN 1 (kapı: çoğunluk izleyince kendiliğinden geçer)
for(const n of names) await untilText(pg[n],'Yüz yüze konuşun'); log('Meydan (kendiliğinden geçti)');
await clickSel(pg[doc],'[data-react="yuh"]'); await sleep(900); await shot(pg[seer],'mp03-discussion.png'); await shot3d('mp03');
await clickSel(pg[seer],'[data-talk="accuse"]'); await chip(pg[seer], vamp); await clickSel(pg[seer],'#mTDo'); await until(pg[seer],'[data-why]'); await clickSel(pg[seer],'[data-why]'); await sleep(500);
await untilText(pg.Ali,'Seçime geç'); await clickSel(pg.Ali,'#mNext');
// GÜN 1: herkes köylüyü seçer (köylü vampiri) → savunma → AS → köylü hayalet olur
for(const n of names){ await until(pg[n],'#mSel'); await chip(pg[n], n===vil?vamp:vil); await clickSel(pg[n],'#mSel'); }
log('Gün 1 seçim →', vil);
await until(pg[vil],'[data-def]'); await shot(pg[vil],'mp04-defense.png');
async function defSteps(p){ await until(p,'[data-dq]'); await clickSel(p,'[data-dq]'); await until(p,'[data-dl]'); await clickSel(p,'[data-dl]'); }
await clickSel(pg[vil],'[data-def="witness"]'); await chip(pg[vil], seer); await clickSel(pg[vil],'#mDefGo'); await defSteps(pg[vil]); log('Savunma yapıldı');
for(const n of names.filter(x=>x!==vil)){ await until(pg[n],'[data-fv]'); await clickSel(pg[n],'[data-fv="hang"]'); await sleep(100); await clickSel(pg[n],'#mLock'); }
for(const n of names) await untilText(pg[n],'Köylü idi'); log('Gün 1: köylü asıldı ✔'); await shot(pg[seer],'mp05-verdict.png');
// HAYALET: bahis
await until(pg[vil],'[data-gh="bet"]'); await shot(pg[vil],'mp06-ghost.png');
await clickSel(pg[vil],'[data-gh="bet"]'); await chip(pg[vil], vamp); await clickSel(pg[vil],'#mGhGo'); await untilText(pg[vil],'Bahsin',15000); log('Hayalet bahse girdi ✔');
// GECE 2: vampir kâhini ısırır, hoca kâhini korur, kâhin hocaya bakar
await until(pg[vamp],'#mNightGo'); log('Gece 2 (kendiliğinden geçti)');
await chip(pg[vamp], seer); await clickSel(pg[vamp],'#mNightGo'); await until(pg[vamp],'#mNightSkip'); await clickSel(pg[vamp],'#mNightSkip');
await until(pg[doc],'#mNightGo'); await chip(pg[doc], seer); await clickSel(pg[doc],'#mNightGo');
await until(pg[seer],'#mNightGo'); await chip(pg[seer], doc); await clickSel(pg[seer],'#mNightGo');
// hayalet gece kapı tıkırdatır
if(await pg[vil].$('[data-gh="rattle"]:not([disabled])')){ await clickSel(pg[vil],'[data-gh="rattle"]'); await chip(pg[vil], vamp); await clickSel(pg[vil],'#mGhGo'); log('Hayalet kapı tıkırdattı ✔'); }
for(const n of names) await untilText(pg[n],'Gün 2');
log('Gece 2: hoca kurtardı ✔'); await sleep(500); await shot(pg[doc],'mp07-dawn2.png');
for(const n of [vamp,doc,seer]) await untilText(pg[n],'Yüz yüze konuşun');
// hayalet domates atar
await until(pg[vil],'[data-gh="tomato"]:not([disabled])'); await clickSel(pg[vil],'[data-gh="tomato"]'); await chip(pg[vil], vamp); await clickSel(pg[vil],'#mGhGo'); await sleep(1200); await shot3d('mp08-tomato'); log('Hayalet domates attı ✔');
await untilText(pg.Ali,'Seçime geç'); await clickSel(pg.Ali,'#mNext');
// GÜN 2: herkes vampiri seçer → AS → köylüler kazanır
for(const n of [vamp,doc,seer]){ await until(pg[n],'#mSel'); await chip(pg[n], n===vamp?doc:vamp); await clickSel(pg[n],'#mSel'); }
await until(pg[vamp],'[data-def]'); await clickSel(pg[vamp],'[data-def="role"]'); await until(pg[vamp],'[data-claimr]'); await shot(pg[vamp],'mp09-claim.png'); await clickSel(pg[vamp],'[data-claimr="kahin"]'); await defSteps(pg[vamp]); log('Vampir kâhinim dedi');
for(const n of [doc,seer]){ await until(pg[n],'[data-fv]'); await clickSel(pg[n],'[data-fv="hang"]'); await sleep(100); await clickSel(pg[n],'#mLock'); }
{ const watch=R3D.find(n=>pg[n])||seer; for(let k=0;k<200;k++){ const t=await text(pg[watch]); if(/Gıpraşma|süzgeç|Bağır bağır|Tutun ayak|son tahtın|kazı/i.test(t)){ await sleep(2500); await shot(pg[watch],'mp10-impale.png'); break; } await sleep(300); } }
for(const n of names) await untilText(pg[n],'Köylüler kazandı');
log('Gün 2: vampir kazığa oturtuldu, KÖYLÜLER KAZANDI ✔');
await sleep(800); await shot(pg.Ali,'mp11-end.png'); await pg[vil].evaluate(()=>{ const s=document.querySelector('#mPanel')||document.scrollingElement; s.scrollTop=600; window.scrollTo(0,700); }); await sleep(300); await shot(pg[vil],'mp11b-end-scrolled.png'); await shot3d('mp11');
const endT=await text(pg[vil]); if(!endT.includes('Sonucu paylaş')) throw new Error('paylaş düğmesi yok'); if(!/GÜN GÜN|Gün gün/i.test(endT)) log('UYARI: zaman çizelgesi yok');
// rövanş
await clickSel(pg.Ali,'#mRestart'); for(const n of names) await untilText(pg[n],'ODA KODU',30000);
log(`Rövanş lobisi ✔ — TEST BAŞARILI (sayfa hatası: ${errN})`);
await browser.close(); server.close(); process.exit(errN?1:0);
