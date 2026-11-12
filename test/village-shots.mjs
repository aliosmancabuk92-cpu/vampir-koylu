import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req,res)=>{ const f=path.join(root,'www', req.url==='/'?'index.html':req.url.split('?')[0]); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} const ct=f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':'text/html'; res.writeHead(200,{'content-type':ct}); res.end(d); }); }).listen(0);
const port=server.address().port; const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const browser = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox','--autoplay-policy=no-user-gesture-required',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });
const page = await browser.newPage(); await page.setViewport({width:390,height:844,deviceScaleFactor:2});
const errs=[]; page.on('pageerror', e=>{ errs.push(e.message); console.log('PAGEERROR', e.message); }); page.on('console', m=>{ if(m.type()==='error') console.log('console.error', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, {waitUntil:'networkidle0'});
const dir=path.join(root,'test','shots'); fs.mkdirSync(dir,{recursive:true});
const shot=(n)=>page.screenshot({path:path.join(dir,n+'.png')});
const click=async(sel)=>{ await page.waitForSelector(sel,{timeout:15000}); await page.evaluate(s=>document.querySelector(s).click(), sel); await sleep(150); };
const has=async(sel)=>!!(await page.$(sel));
const text=async()=>page.evaluate(()=>document.body.innerText);
// sesi kapat (headless'ta TTS yok) ama akış sürelerini kısaltmak için Geç'i kullan
await page.evaluate(()=>{ localStorage.setItem('vk_name','Ali'); localStorage.setItem('vk_voice','0'); });
await page.reload({waitUntil:'networkidle0'});
await page.evaluate(()=>{ const i=document.querySelector('#mName'); i.value='Ali'; i.dispatchEvent(new Event('change')); });
await click('#mSolo'); await click('[data-lvl="1"]'); await click('#bStart');
await sleep(300); await shot('v01-roles');
await click('#bGo'); await sleep(4500); await shot('v02-opening');
const want=process.argv[2]||'';
let guard=0, shots={}, lastPhase=''; var idle=0;
const snap=async(name)=>{ if(!shots[name]){ shots[name]=1; await shot(name); } };
while(guard++<400){ if(guard%3===0) fs.appendFileSync('/tmp/trace.log', ['T', guard, await page.evaluate(()=>(document.querySelector('#gTop')?.innerText||'').replace(/\s+/g,' ')), '|', await page.evaluate(()=>(document.querySelector('#gPanel')?.innerText||'').slice(0,60).replace(/\s+/g,' '))].join(' ')+'\n');
  if(await has('#bSkip')){ const t=await text(); if(/Vampir çıktı|ÖLMEDİ|keklüüük/i.test(t) && !shots['v-impale']){ for(let k=0;k<60;k++){ const tt=await text(); if(/Gıpraşma|süzgeç|Bağır bağır|Tutun ayak|son tahtın/.test(tt)){ await sleep(1300); break; } await sleep(300); } await snap('v-impale'); } await sleep(700); await page.evaluate(()=>document.querySelector('#bSkip')?.click()); await sleep(250); continue; }
  const t=await text();
  if(t.includes('Kazandın!')||t.includes('Kaybettin')){ await sleep(400); await snap('v09-end'); break; }
  if(await has('[data-act]')){ await snap('v03-talk'); const acts=await page.$$eval('[data-act]',b=>b.map(x=>x.dataset.act)); if(acts.includes('accuse')){ await click('[data-act="accuse"]'); const c=await page.$$('[data-chip]'); await c[0].evaluate(e=>e.click()); await sleep(80); await click('#bDo'); } else await click('[data-act="quiet"]'); continue; }
  if(await has('#bSel')){ await snap('v04-select'); const cid=await page.$eval('[data-chip]',e=>e.dataset.chip); await page.evaluate(id=>document.querySelector(`[data-house="${id}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true})), cid); await sleep(100); await snap('v05-select-picked'); await click('#bSel'); await sleep(1800); await snap('v06-drag'); continue; }
  if(await has('[data-def]')){ await snap('v07-defense'); await click('[data-def="innocent"]'); continue; }
  if(await has('#bLock')){ await snap('v08-final'); await click('[data-fv="hang"]'); await click('#bLock'); await sleep(5000); await snap('v08b-hang'); continue; }
  if(await has('#bNight')){ await snap('v10-verdict'); await click('#bNight'); continue; }
  if(await has('#bNightGo')){ await snap('v11-night'); const c=await page.$$('[data-chip]'); await c[0].evaluate(e=>e.click()); await sleep(80); await click('#bNightGo'); continue; }
  if(await has('#bTalk')){ await snap('v12-dawn'); await click('#bTalk'); continue; }
  idle=(typeof idle==='number'?idle:0)+1; if(idle%10===0){ console.log('IDLE', await page.evaluate(()=>document.querySelector('#gPanel')?.innerText.slice(0,200)), '| top:', await page.evaluate(()=>document.querySelector('#gTop')?.innerText)); }
  await sleep(200);
}
console.log('döngü:', guard, '| hata:', errs.length, '|', (await text()).includes('Kazandın!')?'KAZANDI':'KAYBETTİ/BİTMEDİ');
console.log(Object.keys(shots).join(' '));
await browser.close(); server.close();
