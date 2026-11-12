// 4 oyunculu tam bir turu headless Chrome ile oynar.
import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req,res)=>{ const f=path.join(root,'www', req.url==='/'?'index.html':req.url); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type': f.endsWith('.js')?'text/javascript':'text/html'}); res.end(d); }); }).listen(0);
const port = server.address().port;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);

const browser = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true,
  args:['--no-sandbox','--disable-gpu',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });

async function newPlayer(name){
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('console', m=>{ if(m.type()==='error') log(`[${name}] console.error:`, m.text()); });
  page.on('pageerror', e=>log(`[${name}] pageerror:`, e.message));
  await page.goto(`http://127.0.0.1:${port}/`, {waitUntil:'networkidle0'});
  await page.evaluate(()=>document.querySelector('#mMulti').click());
  await page.waitForSelector('#name');
  await page.type('#name', name);
  return page;
}
const text = async(p,sel)=>p.$eval(sel, e=>e.textContent).catch(()=>null);
const click = async(p,sel)=>{ await p.waitForSelector(sel,{timeout:15000}); await p.evaluate((s)=>document.querySelector(s).click(), sel); };
async function waitText(p, needle, ms=15000){ await p.waitForFunction((n)=>document.body.innerText.includes(n), {timeout:ms}, needle); }

const names=['Ali','Ayşe','Mehmet','Zeynep'];
const pages={};
pages.Ali = await newPlayer('Ali'); await pages.Ali.click('#bCreate');
await pages.Ali.waitForSelector('.codebox .c');
const code = await text(pages.Ali,'.codebox .c'); log('Oda kodu:',code);

for(const n of names.slice(1)){
  const p = await newPlayer(n); await p.click('#bJoin'); await p.waitForSelector('#code'); await p.type('#code',code); await p.click('#bGo');
  await waitText(p,'Oyuncular'); pages[n]=p; log(n,'katıldı');
}
await waitText(pages.Ali,'4 kişi'); log('Lobide 4 kişi görünüyor');

await click(pages.Ali,'#bStart');
for(const n of names){ await waitText(pages[n],'Anladım'); }
const roles={};
for(const n of names){ roles[n]=await text(pages[n],'.rolecard .rn'); }
log('Roller:',roles);
for(const n of names){ await click(pages[n],'#bAck'); }


// ---- SENARYO 2: doktor kurtarır, oylama berabere, vampir kazanır
for(const n of names) await waitText(pages[n],'Gece 1');
const byRole=(r)=>names.filter(n=>roles[n]===r);
const vamp=byRole('Vampir')[0], doc=byRole('Doktor')[0], seer=byRole('Kâhin')[0], vil=byRole('Köylü')[0];
async function pick(p, targetName){ await p.waitForSelector('[data-pick]'); const ok=await p.evaluate((t)=>{ const li=[...document.querySelectorAll('[data-pick]')].find(e=>e.querySelector('.nm').textContent.startsWith(t)); if(!li) return false; li.click(); return true; }, targetName); if(!ok) throw new Error('hedef yok: '+targetName); await sleep(150); }
await pick(pages[vamp], vil); await click(pages[vamp],'#bConfirm:not([disabled])');
await pick(pages[doc], vil); await click(pages[doc],'#bConfirm:not([disabled])');   // doktor köylüyü korur
await pick(pages[seer], doc); await click(pages[seer],'#bConfirm:not([disabled])');
for(const n of names) await waitText(pages[n],'Sabah oldu');
let dawn=(await text(pages.Ali,'.banner')).replace(/\s+/g,' ');
if(!dawn.includes('Doktor birini kurtardı')) throw new Error('Doktor kurtarmalıydı: '+dawn); log('Doktor kurtardı ✔');
await waitText(pages[seer],'vampir değil'); log('Kâhin doktoru temiz gördü ✔');
await click(pages.Ali,'#bNext'); for(const n of names) await waitText(pages[n],'Tartışma');
await click(pages.Ali,'#bNext'); for(const n of names) await waitText(pages[n],'Oylama');
// berabere: vamp->vil, vil->vamp, doc->seer, seer->doc  (hepsi 1 oy)
await pick(pages[vamp], vil); await click(pages[vamp],'#bConfirm:not([disabled])');
await pick(pages[vil], vamp); await click(pages[vil],'#bConfirm:not([disabled])');
await pick(pages[doc], seer); await click(pages[doc],'#bConfirm:not([disabled])');
await pick(pages[seer], doc); await click(pages[seer],'#bConfirm:not([disabled])');
for(const n of names) await waitText(pages[n],'Karar');
let v=(await text(pages.Ali,'.banner')).replace(/\s+/g,' '); if(!v.includes('eşit')) throw new Error('Berabere olmalıydı: '+v); log('Berabere, kimse asılmadı ✔');
await click(pages.Ali,'#bNext'); for(const n of names) await waitText(pages[n],'Gece 2'); log('Gece 2 ✔');
await pick(pages[vamp], vil); await click(pages[vamp],'#bConfirm:not([disabled])');
await pick(pages[doc], doc); await click(pages[doc],'#bConfirm:not([disabled])');
await pick(pages[seer], vamp); await click(pages[seer],'#bConfirm:not([disabled])');
for(const n of names) await waitText(pages[n],'Sabah oldu');
dawn=(await text(pages.Ali,'.banner')).replace(/\s+/g,' '); if(!dawn.includes(vil)) throw new Error('Köylü ölmeliydi'); log('Köylü öldü ✔');
await waitText(pages[vil],'izleyicisin'); log('Ölen oyuncu izleyici ✔');
await click(pages.Ali,'#bNext'); await click(pages.Ali,'#bNext'); for(const n of names) await waitText(pages[n],'Oylama');
// hayattakiler: vamp, doc, seer -> kâhini asarlar
await pick(pages[vamp], seer); await click(pages[vamp],'#bConfirm:not([disabled])');
await pick(pages[doc], seer); await click(pages[doc],'#bConfirm:not([disabled])');
await click(pages[seer],'#bSkip');
for(const n of names) await waitText(pages[n],'kazandı');
const end=await text(pages[vil],'.banner .t'); if(!end.includes('Vampirler')) throw new Error('Vampirler kazanmalıydı: '+end);
log('Vampirler kazandı ✔ — SENARYO 2 BAŞARILI');
await browser.close(); server.close(); process.exit(0);
