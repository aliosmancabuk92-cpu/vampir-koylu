// Kullanım: node test/w3d/shot.mjs "phase:shot,phase:shot" [n] [q] [w] [h]
import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root=process.cwd(); const types={'.js':'text/javascript','.html':'text/html','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((q,s)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,u); fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); s.end(d); }); }).listen(0);
const shots=(process.argv[2]||'night:square').split('|');
const n=process.argv[3]||'10', q=process.argv[4]||'high', W=+(process.argv[5]||412), H=+(process.argv[6]||860);
const b=await puppeteer.launch({ executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox','--use-angle=swiftshader',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost'] });
const p=await b.newPage(); await p.setViewport({width:W,height:H,deviceScaleFactor:1.5});
p.on('pageerror',e=>console.log('PAGEERROR',e.message)); p.on('console',m=>{ if(['error','warning'].includes(m.type())) console.log('CONSOLE',m.type(),m.text().slice(0,300)); }); p.on('requestfailed',r=>console.log('REQFAIL',r.url())); p.on('response',r=>{ if(r.status()>=400) console.log('HTTP',r.status(),r.url()); });
const t0=Date.now();
await p.goto(`http://127.0.0.1:${server.address().port}/test/w3d/index.html?n=${n}&q=${q}`,{waitUntil:'load'});
await p.waitForFunction(()=>window.ready||window.errs.length,{timeout:240000});
const errs=await p.evaluate(()=>window.errs); if(errs.length) console.log('ERRS',errs);
console.log('ready in',Date.now()-t0,'ms');
fs.mkdirSync('/tmp/w3d',{recursive:true});
for(const s of shots){ const [ph,sh,...ex]=s.split(':'); const extra=ex.join(':');
  await p.evaluate((ph,sh,extra)=>{ W.setPhase(ph,0); shot(sh); if(extra) eval(extra); },ph,sh,extra||'');
  await new Promise(r=>setTimeout(r,2500));
  const f=`/tmp/w3d/${ph}-${sh}.jpg`; await p.screenshot({path:f,type:'jpeg',quality:85}); console.log('shot',f);
}
const info=await p.evaluate(()=>({ calls:W.renderer.info.render.calls, tris:W.renderer.info.render.triangles, geos:W.renderer.info.memory.geometries, tex:W.renderer.info.memory.textures, progs:W.renderer.info.programs.length }));
console.log(JSON.stringify(info));
await b.close(); server.close();
