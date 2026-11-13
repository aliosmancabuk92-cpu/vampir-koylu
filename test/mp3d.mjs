// Odalı mod: 4 oyuncu, yeni köy akışı (seçim → savunma → kilitli oy → infaz → gece → sabah)
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
const browser = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });
const shotDir=process.env.OUT||path.join(root,'test','shots'); fs.mkdirSync(shotDir,{recursive:true});

const R3D=(process.env.R3D||'Zeynep').split(','); const FEM=['Ayşe','Zeynep'];
async function newPlayer(name){
  const ctx=await browser.createBrowserContext(); const page=await ctx.newPage(); await page.setViewport({width:390,height:844});
  page.on('pageerror', e=>log(`[${name}] PAGEERROR`, e.message));
  await page.goto(URL0,{waitUntil:'networkidle0'});
  await page.evaluate((o)=>{ localStorage.setItem('vk_voice','0'); localStorage.setItem('vk_render',o.r3d?'3d':'2d'); localStorage.setItem('vk_quality','medium'); localStorage.setItem('vk_gender',o.fem?'f':'m'); },{ r3d:R3D.includes(name), fem:FEM.includes(name) });
  await page.reload({waitUntil:'networkidle0'});
  await page.evaluate((n)=>{ const i=document.querySelector('#mName'); i.value=n; i.dispatchEvent(new Event('change')); }, name);
  await page.evaluate(()=>document.querySelector('#mMulti').click()); await page.waitForSelector('#name');
  return page;
}
const ev=(p,fn,arg)=>p.evaluate(fn,arg);
const text=(p)=>p.evaluate(()=>document.body.innerText);
const clickSel=(p,sel)=>p.evaluate(s=>{ const e=document.querySelector(s); if(e){ e.click(); return true; } return false; }, sel);
/** sahne oynarken Geç'e basarak, seçici görünene kadar bekle */
async function until(p, sel, ms=180000){
  const t0=Date.now();
  while(Date.now()-t0<ms){ if(await p.$(sel)) return true; await clickSel(p,'#mSkip'); await sleep(250); }
  throw new Error(`${sel} bekleniyordu: `+(await text(p)).slice(-300).replace(/\s+/g,' '));
}
async function untilText(p, needle, ms=180000){ const t0=Date.now(); while(Date.now()-t0<ms){ if((await text(p)).includes(needle)) return; await clickSel(p,'#mSkip'); await sleep(250); } throw new Error(`"${needle}" bekleniyordu: `+(await text(p)).slice(-300).replace(/\s+/g,' ')); }
async function chip(p, name){ await until(p,'[data-chip]'); const ok=await p.evaluate(n=>{ const b=[...document.querySelectorAll('[data-chip]')].find(x=>x.textContent.includes(n)); if(!b) return false; b.click(); return true; }, name); if(!ok) throw new Error('chip yok: '+name); await sleep(120); }

const names=['Ali','Ayşe','Mehmet','Zeynep']; const pg={};
pg.Ali=await newPlayer('Ali'); await clickSel(pg.Ali,'#bCreate'); await pg.Ali.waitForSelector('.codebox .c');
const code=await pg.Ali.$eval('.codebox .c',e=>e.textContent); log('Oda', code);
for(const n of names.slice(1)){ const p=await newPlayer(n); await clickSel(p,'#bJoin'); await p.waitForSelector('#code'); await p.type('#code',code); await clickSel(p,'#bGo'); await p.waitForFunction(()=>document.body.innerText.includes('Oyuncular'),{timeout:20000}); pg[n]=p; log(n,'katıldı'); }
await pg.Ali.waitForFunction(()=>document.body.innerText.includes('4 kişi'),{timeout:20000});
await pg.Ali.screenshot({path:path.join(shotDir,'mp00-lobby.png')});
await clickSel(pg.Ali,'#bStart');
const roles={};
for(const n of names){ await until(pg[n],'#mAck'); roles[n]=await pg[n].$eval('.rolecard .rn',e=>e.textContent); }
log('Roller', JSON.stringify(roles));
const by=(r)=>names.filter(n=>roles[n]===r); const vamp=by('Vampir')[0], doc=by('Doktor')[0], seer=by('Kâhin')[0], vil=by('Köylü')[0];
for(const n of names) await clickSel(pg[n],'#mAck');
await untilText(pg.Ali,'Tartışmaya başla'); log('Açılış sahnesi bitti'); await pg.Ali.screenshot({path:path.join(shotDir,'mp01-opening.png')}); for(const n of R3D) if(pg[n]) await pg[n].screenshot({path:path.join(shotDir,`mp01-3d-${n}.png`)});
await clickSel(pg.Ali,'#mNext'); // tartışma
await untilText(pg.Ali,'Seçime geç'); log('Tartışma');
await clickSel(pg.Ali,'#mNext'); // seçime geç
// GÜN 1: herkes köylüyü seçer (köylü kendisi vampiri seçer) → savunma → BIRAK
for(const n of names){ await until(pg[n],'#mSel'); await chip(pg[n], n===vil?vamp:vil); await clickSel(pg[n],'#mSel'); }
log('Gün 1 seçim yapıldı →', vil);
await until(pg[vil],'[data-def]'); await pg[vil].screenshot({path:path.join(shotDir,'mp02-defense.png')}); for(const n of R3D) if(pg[n]) await pg[n].screenshot({path:path.join(shotDir,`mp02-3d-${n}.png`)});
await clickSel(pg[vil],'[data-def="innocent"]'); await chip(pg[vil], seer); await clickSel(pg[vil],'#mDefGo'); log('Savunma yapıldı');
for(const n of names.filter(x=>x!==vil)){ await until(pg[n],'[data-fv]'); await clickSel(pg[n],'[data-fv="release"]'); await sleep(100); await clickSel(pg[n],'#mLock'); }
await pg[seer].screenshot({path:path.join(shotDir,'mp03-final.png')});
for(const n of names) await untilText(pg[n],'Bırakıldı');
log('Gün 1: BIRAKILDI ✔');
await untilText(pg.Ali,'gece olsun'); await clickSel(pg.Ali,'#mNext'); // gece
// GECE 1: vampir köylüyü seçer, doktor köylüyü korur, kâhin vampire bakar
await until(pg[vamp],'#mNightGo'); await chip(pg[vamp], vil); await clickSel(pg[vamp],'#mNightGo');
await until(pg[doc],'#mNightGo'); await chip(pg[doc], vil); await clickSel(pg[doc],'#mNightGo');
await until(pg[seer],'#mNightGo'); await chip(pg[seer], vamp); await clickSel(pg[seer],'#mNightGo');
for(const n of names) await untilText(pg[n],'Gün 2');
await untilText(pg[seer],'VAMPİR'); log('Gece 1: doktor kurtardı, kâhin vampiri gördü ✔');
const dawnTxt=await text(pg.Ali); if(!/doktor|kimse ölmedi/i.test(dawnTxt)) log('UYARI: sabah metni', dawnTxt.slice(0,200));
await untilText(pg.Ali,'Meydana toplan'); await clickSel(pg.Ali,'#mNext'); // tartışma
await untilText(pg.Ali,'Seçime geç'); await clickSel(pg.Ali,'#mNext'); // seçim
// GÜN 2: herkes vampiri seçer → AS → kazık → köylüler kazanır
for(const n of names){ await until(pg[n],'#mSel'); await chip(pg[n], n===vamp?vil:vamp); await clickSel(pg[n],'#mSel'); }
await until(pg[vamp],'[data-def]'); await clickSel(pg[vamp],'[data-def="role"]'); await until(pg[vamp],'[data-claimr]'); await clickSel(pg[vamp],'[data-claimr="kahin"]'); log('Vampir kâhinim dedi');
for(const n of names.filter(x=>x!==vamp)){ await until(pg[n],'[data-fv]'); await clickSel(pg[n],'[data-fv="hang"]'); await sleep(100); await clickSel(pg[n],'#mLock'); }
// kazık anını yakala (Geç'e basmadan)
{ const watch=R3D.find(n=>pg[n])||seer; for(let k=0;k<200;k++){ const t=await text(pg[watch]); if(/Gıpraşma|süzgeç|Bağır bağır|Tutun ayak|son tahtın/.test(t)){ await sleep(2500); await pg[watch].screenshot({path:path.join(shotDir,'mp04-impale.png')}); break; } await sleep(300); } }
for(const n of names) await untilText(pg[n],'Köylüler kazandı');
log('Gün 2: vampir kazığa oturtuldu, KÖYLÜLER KAZANDI ✔');
await pg.Ali.screenshot({path:path.join(shotDir,'mp05-end.png')}); for(const n of R3D) if(pg[n]){ await sleep(2500); await pg[n].screenshot({path:path.join(shotDir,`mp05-3d-${n}.png`)}); }
// yeni oyun
await clickSel(pg.Ali,'#mRestart'); for(const n of names) await untilText(pg[n],'ODA KODU');
log('Yeni oyun lobisi ✔ — TEST BAŞARILI');
await browser.close(); server.close(); process.exit(0);
