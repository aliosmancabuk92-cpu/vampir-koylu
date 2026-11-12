import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req,res)=>{ const f=path.join(root,'www', req.url==='/'?'index.html':req.url.split('?')[0]); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} const ct=f.endsWith('.js')?'text/javascript':f.endsWith('.png')?'image/png':f.endsWith('.webmanifest')?'application/manifest+json':'text/html'; res.writeHead(200,{'content-type':ct}); res.end(d); }); }).listen(0);
const port=server.address().port;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(...a);
const browser = await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox','--disable-gpu',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });
const page = await browser.newPage(); await page.setViewport({width:390,height:844,deviceScaleFactor:2});
page.on('pageerror', e=>log('PAGEERROR', e.message)); page.on('console', m=>{ if(m.type()==='error') log('console.error', m.text()); });
await page.goto(`http://127.0.0.1:${port}/`, {waitUntil:'networkidle0'});
const shot=(n)=>page.screenshot({path:path.join(root,'test','shots',n+'.png')});
fs.mkdirSync(path.join(root,'test','shots'),{recursive:true});
const click=async(sel)=>{ await page.waitForSelector(sel,{timeout:8000}); await page.evaluate(s=>document.querySelector(s).click(), sel); await sleep(120); };
const has=async(t)=>page.evaluate(t=>document.body.innerText.includes(t), t);
const text=async()=>page.evaluate(()=>document.body.innerText);

await shot('01-mode');
await page.evaluate(()=>{const i=document.querySelector('#mName'); i.value='Ali'; i.dispatchEvent(new Event('change'));}); await click('#mSolo'); await shot('02-map');
await click('[data-lvl="1"]'); await shot('03-intro');
await click('#bStart'); await shot('04-role');
await click('#bAck');
// döngü: oyun bitene kadar
let guard=0, shotTalk=false, shotVote=false;
while(guard++<60){
  const t=await text();
  if(t.includes('Kazandın!')||t.includes('Kaybettin')){ await shot('09-end'); break; }
  if(await page.$('#bConfirm') && t.includes('Gece')){ // gece aksiyonu
    const picks=await page.$$('[data-pick]'); await picks[0].evaluate(e=>e.click()); await sleep(80); await click('#bConfirm'); continue; }
  if(await page.$('#bTalk')){ if(!shotTalk){ await shot('05-dawn'); } await click('#bTalk'); continue; }
  if(await page.$('#bResult')){ await click('#bResult'); continue; }
  if(await page.$('[data-act="accuse"]')){ if(!shotTalk){ await shot('06-talk'); shotTalk=true; }
    await click('[data-act="accuse"]'); const picks=await page.$$('[data-pick]'); await picks[0].evaluate(e=>e.click()); await sleep(80); await click('#bDo'); await sleep(1200); continue; }
  if(await page.$('#bSkip')){ if(!shotVote){ await shot('07-vote'); shotVote=true; } const picks=await page.$$('[data-pick]'); await picks[picks.length-1].evaluate(e=>e.click()); await sleep(80); await click('#bConfirm'); await shot('08-verdict'); continue; }
  if(await page.$('#bNight')){ await click('#bNight'); continue; }
  await sleep(200);
}
const endTxt=await text(); log('Sonuç:', endTxt.includes('Kazandın!')?'KAZANDI':'KAYBETTİ');
// harita ve kayıt kontrolü
await click('#bMap'); const mapTxt=await text(); log('XP kaydı var mı:', /\d+ XP/.test(mapTxt));
await page.reload({waitUntil:'networkidle0'}); await click('#mSolo'); const after=await text(); log('Yenileme sonrası XP korunuyor:', +(after.match(/(\d+) XP/)||[0,0])[1]>0);
// serbest oyun ve istatistik ekranları
await click('#bStats'); await shot('10-stats'); await click('#bBack');
// çok oyunculu giriş hâlâ çalışıyor mu
await click('#bBack'); await click('#mMulti'); log('Çok oyunculu ekran:', await has('Oda Aç'));
await browser.close(); server.close();
