import * as THREE from 'three';
import { createWorld, WORLD_CSS, LAYOUT } from '../../src/world/world.js';
import { loadPeople, createVillager, MALE_KEYS, setHeadYawAxis, AXES, POSES } from '../../src/world/people.js';
const st=document.createElement('style'); st.textContent=WORLD_CSS+`html,body{margin:0;height:100%;background:#000} #v{position:fixed;inset:0}`; document.head.appendChild(st);
const P=new URLSearchParams(location.search); const N=+(P.get('n')||10);
window.ready=false; window.errs=[];
window.addEventListener('error',e=>window.errs.push(String(e.message)));
(async()=>{
  try{
  const t0=performance.now();
  const W=await createWorld(document.getElementById('v'), { base:'/www/assets/3d/', quality:P.get('q')||'high', debug:true });
  await loadPeople('/www/assets/3d/');
  const players=[...Array(N)].map((_,i)=>({id:'p'+i, name:'Köylü '+i}));
  W.setupVillage(players);
  const vs=players.map((p,i)=>{ const k= i===0?'player':MALE_KEYS[(i-1)%MALE_KEYS.length]; const V=createVillager(k); W.addActor(V); return V; });
  const n=vs.length; vs.forEach((V,i)=>{ const th=-1.95+3.9*i/(n-1); const r=LAYOUT.CROWD_R; const x=Math.sin(th)*r, z=-Math.cos(th)*r; V.place(x,z,Math.atan2(-x,-z)); });
  window.W=W; window.vs=vs; window.THREE=THREE; window.AXES=AXES; window.setHeadYawAxis=setHeadYawAxis;
  document.getElementById('msg').textContent='hazır '+Math.round(performance.now()-t0)+'ms';
  window.ready=true;
  }catch(e){ window.errs.push(String(e&&e.stack||e)); }
})();
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
window.shot=(name)=>{ const W=window.W; const vs=window.vs;
  switch(name){
    case 'establish': W.camCut(V3(0,13,31),V3(0,2.5,-3),50); break;
    case "square": W.camCut(V3(0,3.0,12.5),V3(0,1.7,-1.5),52); break;
    case "gather": W.camCut(V3(0,15,13),V3(0,0.6,-1.2),55); break;
    case 'crowd': W.camCut(V3(2.5,2.2,6.5),V3(-0.5,1.5,-2.5),45); break;
    case 'close': { const v=vs[3]; const h=v.headPos(V3()); const f=V3(-h.x,0,-h.z).normalize(); W.camCut(h.clone().addScaledVector(f,1.5).add(V3(0.25,0.0,0)), h.clone().add(V3(0,-0.08,0)),40); break; }
    case 'close2': { const v=vs[1]; const h=v.headPos(V3()); const f=V3(-h.x,0,-h.z).normalize(); W.camCut(h.clone().addScaledVector(f,2.6).add(V3(0.4,-0.1,0)), h.clone().add(V3(0,-0.35,0)),40); break; }
    case 'player': { const v=vs[0]; const h=v.headPos(V3()); const f=V3(-h.x,0,-h.z).normalize(); W.camCut(h.clone().addScaledVector(f,1.4), h.clone().add(V3(0,-0.05,0)),40); break; }
    case 'crane': W.camCut(V3(0,30,30),V3(0,0,-3),55); break;
    case 'house': { const h=W.village.houses[0]; const d=h.door; const out=V3(-d.x,0,-d.z).normalize(); W.camCut(d.clone().addScaledVector(out,7).add(V3(1.5,2.4,0)), d.clone().add(V3(0,1.8,0)),50); break; }
    case 'gallows': W.camCut(V3(-2.8,2.6,3.2),V3(-5.7,2.4,-4.9),50); break;
    case 'stakes': W.camCut(V3(3.2,2.6,3.0),V3(5.7,2.0,-4.9),50); break;
  }
};
