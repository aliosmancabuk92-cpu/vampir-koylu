// Kullanım: node test/w3d/cap.mjs page.html "kurulum kodu" saniye fps çıktıDizini [w] [h] [q] [her_kaçta_bir_kare]
import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const root=process.cwd(); const types={'.js':'text/javascript','.html':'text/html','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg'};
const server=http.createServer((q,s)=>{ let u=decodeURIComponent(q.url.split('?')[0]); if(u.startsWith('/test/w3d/assets/')) u='/www'+u.slice('/test/w3d'.length); const f=path.join(root,u); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); s.end(d); }); }).listen(0);
const [page,setup,secs,fps,out,w,h,q,every]=process.argv.slice(2);
const W=+(w||360), H=+(h||640), N=Math.round(+secs*+fps), EV=+(every||1);
fs.mkdirSync(out,{recursive:true}); for(const f of fs.readdirSync(out)) if(f.endsWith('.jpg')) fs.unlinkSync(path.join(out,f));
const b=await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, protocolTimeout:240000, args:['--no-sandbox','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });
const p=await b.newPage(); await p.setViewport({ width:W, height:H, deviceScaleFactor:1 });
p.on('pageerror',e=>console.log('PAGEERROR',e.message)); p.on('console',m=>{ if(['error','warning'].includes(m.type())) console.log('CONSOLE',m.type(),m.text().slice(0,300)); else if(m.text().startsWith('@')) console.log(m.text()); });
const t0=Date.now();
await p.goto(`http://127.0.0.1:${server.address().port}/test/w3d/${page}`,{ waitUntil:'load' });
// hazır olana kadar sanal zamanı ilerlet
for(let i=0;i<4000;i++){ const ok=await p.evaluate(async()=>{ await window.__advance(50); return window.ready||window.errs.length>0; }); if(ok) break; await new Promise(r=>setTimeout(r,5)); }
const errs=await p.evaluate(()=>window.errs); if(errs.length){ console.log('ERRS',errs); }
console.log('hazır', Date.now()-t0,'ms');
await p.evaluate(async(code)=>{ await (0,eval)(code+"\n;0"); }, setup);
const dt=1000/+fps; let k=0;
for(let i=0;i<N;i++){ await p.evaluate(async(dt)=>{ await window.__advance(dt); }, dt);
  if(i%EV===0){ await p.screenshot({ path:path.join(out,`f${String(k++).padStart(5,'0')}.jpg`), type:'jpeg', quality:88 }); } }
const log=await p.evaluate(()=>window.caplog||[]); fs.writeFileSync(path.join(out,'log.json'),JSON.stringify(log));
const hasA=await p.evaluate(()=>!!window.renderAudio); if(hasA){ const b64=await p.evaluate(async()=>await window.renderAudio()); fs.writeFileSync(path.join(out,'audio.wav'),Buffer.from(b64,'base64')); console.log('ses kaydedildi'); }
console.log('kare',k,'süre',Math.round((Date.now()-t0)/1000),'s');
await b.close(); server.close();
