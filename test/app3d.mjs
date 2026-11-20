// Gerçek uygulama (www/) — tek oyunculu 3B akış: ekran görüntüleri + hata kontrolü
import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root=path.resolve(import.meta.dirname,'..');
const types={'.js':'text/javascript','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const server=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,'www',u==='/'?'index.html':u); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); s.end(d); }); }).listen(0);
const port=server.address().port; const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const OUT=process.env.OUT||'/tmp/app3d'; fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const LVL=process.argv[2]||'1', Q=process.argv[3]||'high', SHOTWAIT=+(process.argv[4]||3500);
const browser=await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, protocolTimeout:900000, args:['--no-sandbox','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });
const page=await browser.newPage(); await page.setViewport({width:390,height:844,deviceScaleFactor:1.5});
let voiceReq=0, voiceOK=0; page.on('response',r=>{ if(r.url().includes('/assets/voice/')&&r.url().endsWith('.mp3')){ voiceReq++; if(r.status()===200) voiceOK++; } });
const errs=[]; page.on('pageerror',e=>{ errs.push(e.message); console.log('PAGEERROR',e.message); }); page.on('console',m=>{ if(m.type()==='error'&&!/favicon|ERR_|404/.test(m.text())) console.log('console.error',m.text().slice(0,300)); });
await page.evaluateOnNewDocument(()=>{ window.VK_DEBUG=true; });
await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load'});
await page.evaluate((Q,VO,R2)=>{ localStorage.setItem('vk_name','Ali'); localStorage.setItem('vk_voice',VO); localStorage.setItem('vk_quality',Q); if(R2) localStorage.setItem('vk_render','2d'); else localStorage.removeItem('vk_render'); localStorage.setItem("vk_solo_v1",JSON.stringify({stars:Object.fromEntries([...Array(30)].map((_,i)=>[i+1,3])),xp:0,seenIntro:true})); },Q,process.env.VOICE||'0',process.env.R2D==='1');
await page.reload({waitUntil:'load'});
let n=0; const shot=async(tag)=>{ const f=`${OUT}/${String(n++).padStart(2,'0')}-${tag}.jpg`; await page.screenshot({path:f,type:'jpeg',quality:82}); console.log('📸',f); };
const click=async(sel)=>{ await page.waitForSelector(sel,{timeout:20000}); await page.evaluate(s=>document.querySelector(s).click(),sel); await sleep(200); };
const has=async(sel)=>!!(await page.$(sel));
const text=async()=>page.evaluate(()=>document.body.innerText);
await page.evaluate(()=>{ const i=document.querySelector('#mName'); if(i){ i.value='Ali'; i.dispatchEvent(new Event('change')); } });
await click('#mSolo'); await shot('map'); await click(`[data-lvl="${LVL}"]`); await click('#bStart');
const t0=Date.now(); if(process.env.R2D!=='1') await page.waitForFunction(()=>!document.querySelector('#gLoad')||document.querySelector('#gLoad').classList.contains('out'),{timeout:300000}); console.log('3B yüklendi',Date.now()-t0,'ms');
await sleep(2500); await shot('roles');
if(process.env.GHOST==='1') await page.evaluate(()=>{ const G=window.VK_G; const o=G._botNight.bind(G); G._botNight=function(){ o(); if(!this.firstNight && this.human.alive && this.human.role!=='vampir'){ this.night.bite=[this.human.id]; this.night.doctor=null; } }; });
await click('#bGo'); await sleep(SHOTWAIT); await shot('opening-a'); await sleep(SHOTWAIT); await shot('opening-b');
const shots={}; const once=async(k)=>{ if(!shots[k]){ shots[k]=1; await shot(k); } };
let guard=0, skips=0, nightN=0, dawns=0;
while(guard++<500){
  if(await has('#bFast')&&!shots.fast){ shots.fast=1; await page.evaluate(()=>document.querySelector('#bFast')?.click()); await sleep(600); await shot('fast'); continue; }
  if(await has('#bSkip')){ skips++; if(skips%4===0){ await sleep(SHOTWAIT); await shot('cine'+skips); } else await sleep(900); await page.evaluate(()=>document.querySelector('#bSkip')?.click()); await sleep(300); continue; }
  const t=await text();
  if(t.includes('Kazandın!')||t.includes('Kaybettin')){ await sleep(2500); await once('end'); await page.evaluate(()=>{ const d=document.querySelector('details.card'); if(d) d.open=true; const s=document.querySelector('.sheet-scroll'); if(s) s.scrollTop=420; else window.scrollTo(0,420); }); await sleep(400); await shot('end-awards'); await page.evaluate(()=>{ const s=document.querySelector('.sheet-scroll'); if(s) s.scrollTop=1400; else window.scrollTo(0,1400); }); await sleep(300); await shot('end-timeline'); if(await has('#bShare')){ await page.evaluate(()=>{ window.__shared=0; const o=URL.createObjectURL; URL.createObjectURL=(b)=>{ window.__shared=b.size; window.__blob=b; return o.call(URL,b); }; }); await click('#bShare'); await sleep(2500); console.log('paylaşım kartı bayt:', await page.evaluate(()=>window.__shared)); const b64=await page.evaluate(async()=>{ const b=window.__blob; if(!b) return ''; const u=new Uint8Array(await b.arrayBuffer()); let s=''; for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(s); }); if(b64) fs.writeFileSync(`${OUT}/share.png`,Buffer.from(b64,'base64')); } break; }
  if(await has('[data-act]')){ await once('talk'); const acts=await page.$$eval('[data-act]',b=>b.map(x=>x.dataset.act)); if(acts.includes('claimBekci')&&!shots.bek){ shots.bek=1; await click('[data-act="claimBekci"]'); await sleep(400); await shot('bekci-claim'); if(await has('[data-bek]')) await click('[data-bek]'); await sleep(600); console.log('bekçi gördüğünü açıkladı'); } else if(acts.includes('gossip')&&!shots.gos){ shots.gos=1; await shot('gossip'); await click('[data-act="gossip"]'); await sleep(600); console.log('dedikodu yayıldı'); } else if(process.env.CLAIM==='1'&&acts.includes('claimDoctor')&&!shots.claim){ shots.claim=1; await click('[data-act="claimDoctor"]'); await sleep(500); } else if(acts.includes('accuse')&&!shots.accuse){ shots.accuse=1; await click('[data-act="accuse"]'); await sleep(1200); await shot('accuse-pick'); const c=await page.$$('[data-chip]'); await c[0].evaluate(e=>e.click()); await sleep(1500); await shot('accuse-sel'); await click('#bDo'); } else await click('[data-act="quiet"]'); continue; }
  if(await has('#bSel')){ await sleep(3000); await once('select'); const cid=await page.$eval('[data-chip]',e=>e.dataset.chip); await page.evaluate(id=>document.querySelector(`[data-chip="${id}"]`).click(),cid); await sleep(3500); await once('select-picked'); await click('#bSel'); await sleep(SHOTWAIT); await once('drag'); continue; }
  if(await has('[data-ans]')){ await once('answer'); await click('[data-ans]'); continue; }
  if(await has('[data-why]')){ await once('reason'); await click('[data-why]'); continue; }
  if(await has('[data-def]')){ const ks=await page.$$eval('[data-def]',b=>b.map(x=>x.dataset.def)); await once('defense-'+ks.join('').length); const k=ks.find(x=>x!=='blame'&&x!=='witness')||ks[0]; await click(`[data-def="${k}"]`); await sleep(400); if(await has('[data-chip]')&&!(await has('[data-def]'))){ const c=await page.$$('[data-chip]'); await c[0].evaluate(e=>e.click()); await sleep(300); if(await has('#bDo')) await click('#bDo'); } continue; }
  if(await has('#bLock')){ await sleep(1500); await once('final'); await click('[data-fv="hang"]'); await click('#bLock'); await sleep(SHOTWAIT); await once('hang'); continue; }
  if(await has('[data-gh="bet"]')&&!shots.ghost){ shots.ghost=1; await sleep(800); await shot('ghost'); await click('[data-gh="bet"]'); await sleep(300); const c=await page.$$('[data-chip]'); if(c[0]) await c[0].evaluate(e=>e.click()); await sleep(300); await shot('ghost-bet'); if(await has('#bGhGo')) await click('#bGhGo'); continue; }
  if(await has('[data-gh="whisper"]:not([disabled])')&&!shots.whisper){ shots.whisper=1; await click('[data-gh="whisper"]'); await sleep(300); const c=await page.$$('[data-chip]'); if(c[0]) await c[0].evaluate(e=>e.click()); await sleep(300); if(await has('#bGhGo')) await click('#bGhGo'); await sleep(500); continue; }
  if(await has('[data-gh="tomato"]:not([disabled])')&&!shots.tomato){ shots.tomato=1; await click('[data-gh="tomato"]'); await sleep(300); const c=await page.$$('[data-chip]'); if(c[0]) await c[0].evaluate(e=>e.click()); await sleep(300); if(await has('#bGhGo')) await click('#bGhGo'); await sleep(1500); await shot('tomato'); continue; }
  if(await has('#bNight')){ await sleep(2000); await once('verdict'); await click('#bNight'); await sleep(SHOTWAIT); await once('dusk-home'); continue; }
  if(await has('#bNightGo')){ await sleep(1500); await once('night'); nightN++; if(nightN%3===0&&await has('#bNightSkip')){ await click('#bNightSkip'); continue; } const c=await page.$$('[data-chip]'); await c[0].evaluate(e=>e.click()); await sleep(1500); await once('night-picked'); await click('#bNightGo'); continue; }
  if(await has('#bTalk')){ await sleep(1500); await once('dawn'); if(await has('[data-insp]')){ await click('[data-insp]'); await sleep(500); await once('dawn-inspected'); } dawns++; if(dawns===2) await shot('dawn2'); await click('#bTalk'); continue; }
  await sleep(250);
}
const perf=await page.evaluate(()=>({ mem:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6)+'MB':'?' }));
console.log('ses dosyası:',voiceOK,'/',voiceReq);
console.log('döngü:',guard,'| hata:',errs.length,'|',(await text()).includes('Kazandın!')?'KAZANDI':'KAYBETTİ/BİTMEDİ', JSON.stringify(perf));
await browser.close(); server.close();
