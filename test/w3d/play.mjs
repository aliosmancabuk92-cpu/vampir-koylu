// Bir oyun gününü 3B'de oynatır ve aralıklarla ekran görüntüsü alır.
import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root=process.cwd(); const types={'.js':'text/javascript','.html':'text/html','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,u); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); s.end(d); }); }).listen(0);
const OUT='/tmp/w3d/play'; fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
const b=await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, protocolTimeout:600000, args:['--no-sandbox','--use-angle=swiftshader',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });
const p=await b.newPage(); await p.setViewport({width:390,height:844,deviceScaleFactor:1});
p.on('pageerror',e=>console.log('PAGEERROR',e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/favicon|404/.test(m.text())) console.log('CONSOLE',m.text().slice(0,400)); });
await p.goto(`http://127.0.0.1:${server.address().port}/test/w3d/game.html?${process.argv[2]||'lvl=9&seed=42'}`,{waitUntil:'load'});
await p.waitForFunction(()=>window.ready||window.errs.length,{timeout:240000});
const errs=await p.evaluate(()=>window.errs); if(errs.length){ console.log('ERRS',errs); }
let n=0; const snap=async(tag)=>{ const f=`${OUT}/${String(n++).padStart(3,'0')}-${tag}.jpg`; await p.screenshot({path:f,type:'jpeg',quality:80}); return f; };
async function step(code, tag, every=2500, max=40){ const pr=p.evaluate((c)=>window.step(c),code); let done=false, ph=null; pr.then(v=>{ done=true; ph=v; }); let k=0; while(!done && k<max){ await new Promise(r=>setTimeout(r,every)); if(!done) await snap(tag+'-'+k); k++; } await pr; await new Promise(r=>setTimeout(r,1500)); await snap(tag+'-end'); const evs=await p.evaluate(()=>window.lastEvs.join(',')); console.log(tag,'→',ph,'|',evs.slice(0,200)); return ph; }
const script=JSON.parse(process.argv[3]||'[]');
for(const [code,tag,every] of script){ await step(code,tag,every||2500); }
const log=await p.evaluate(()=>window.log.slice(-60)); fs.writeFileSync(OUT+'/log.txt',log.join('\n'));
await b.close(); server.close();
