import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req,res)=>{ const f=path.join(root,'www', req.url==='/'?'index.html':req.url.split('?')[0]); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'content-type': f.endsWith('.js')?'text/javascript':'text/html'}); res.end(d); }); }).listen(0);
const port=server.address().port; const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const browser = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });
const page = await browser.newPage(); await page.setViewport({width:390,height:844,deviceScaleFactor:2});
page.on('pageerror', e=>console.log('PAGEERROR', e.message));
await page.goto(`http://127.0.0.1:${port}/`, {waitUntil:'networkidle0'});
await page.evaluate(()=>localStorage.setItem('vk_solo_v1', JSON.stringify({stars:{1:3,2:3},xp:500,games:2,wins:2,byRole:{},streak:2,best:2})));
await page.reload({waitUntil:'networkidle0'});
const click=async(sel)=>{ await page.waitForSelector(sel,{timeout:8000}); await page.evaluate(s=>document.querySelector(s).click(), sel); await sleep(120); };
const text=async()=>page.evaluate(()=>document.body.innerText);
await page.evaluate(()=>{const i=document.querySelector('#mName'); i.value='Ali'; i.dispatchEvent(new Event('change'));}); await click('#mSolo'); await click('[data-lvl="3"]'); await click('#bStart');
console.log('Rol kâhin mi:', (await text()).includes('Kâhin'));
await click('#bAck');
let guard=0, claimed=false, seerShot=false;
while(guard++<60){
  const t=await text();
  if(t.includes('Kazandın!')||t.includes('Kaybettin')) break;
  if(await page.$('#bConfirm') && t.includes('Gece')){ const picks=await page.$$('[data-pick]'); await picks[0].evaluate(e=>e.click()); await sleep(60); await click('#bConfirm'); if(!seerShot){ await page.screenshot({path:'test/shots/11-seer-dawn.png'}); seerShot=true; } continue; }
  if(await page.$('#bTalk')){ await click('#bTalk'); continue; }
  if(await page.$('#bResult')){ await click('#bResult'); continue; }
  if(await page.$('[data-act="claimSeer"]') && !claimed){ await click('[data-act="claimSeer"]'); await page.screenshot({path:'test/shots/12-claim.png'}); const c=await page.$$('[data-claim]'); console.log('Kehanet seçenekleri:', c.length); await c[0].evaluate(e=>e.click()); claimed=true; await sleep(300); console.log('İddia feed\'de:', (await text()).includes('Ben kâhinim')); continue; }
  if(await page.$('[data-act="quiet"]')){ await click('[data-act="quiet"]'); await sleep(600); continue; }
  if(await page.$('#bSkip')){ const picks=await page.$$('[data-pick]'); await picks[0].evaluate(e=>e.click()); await sleep(60); await click('#bConfirm'); continue; }
  if(await page.$('#bNight')){ await click('#bNight'); continue; }
  await sleep(150);
}
console.log('Bitti:', (await text()).includes('Kazandın!')?'KAZANDI':'KAYBETTİ', '| iddia yapıldı:', claimed);
await browser.close(); server.close();
