/* =====================================================================
   HAYVANLAR — meydanda dolaşan tavuklar (gagalar, yürür, kaçar, kanat çırpar)
   Tek parça gövde + kafa + iki kanat: tavuk başına 4 çizim çağrısı.
   ===================================================================== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const col=(g,hex)=>{ g=g.index?g.toNonIndexed():g; const c=new THREE.Color(hex); const n=g.attributes.position.count; const a=new Float32Array(n*3); for(let i=0;i<n;i++){ a[i*3]=c.r; a[i*3+1]=c.g; a[i*3+2]=c.b; } g.setAttribute('color',new THREE.BufferAttribute(a,3)); g.deleteAttribute('uv'); return g; };
const at=(g,x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>{ g.scale(sx,sy,sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x,y,z); return g; };
const wrap=(a)=>{ while(a>Math.PI) a-=Math.PI*2; while(a<-Math.PI) a+=Math.PI*2; return a; };

const LOOKS=[ { body:0xf3eee4, tail:0xe9e2d4 }, { body:0xa0582a, tail:0x3a2414 }, { body:0x2a2622, tail:0x1a2a20 }, { body:0xd9a25a, tail:0x8a4a1a }, { body:0xf3eee4, tail:0x2a2622 } ];

function chickenParts(lk){
  const body=mergeGeometries([
    col(at(new THREE.SphereGeometry(0.15,12,9),0,0.25,0,0,0,0,1,0.86,1.25),lk.body),
    col(at(new THREE.SphereGeometry(0.11,10,8),0,0.31,0.1,0,0,0,1,1.05,1),lk.body),
    col(at(new THREE.ConeGeometry(0.09,0.2,7),0,0.36,-0.2,-0.9,0,0),lk.tail),
    col(at(new THREE.ConeGeometry(0.06,0.17,6),0,0.4,-0.17,-0.45,0,0),lk.tail),
    col(at(new THREE.CylinderGeometry(0.012,0.012,0.15,5),0.05,0.075,0.01),0xe0a030),
    col(at(new THREE.CylinderGeometry(0.012,0.012,0.15,5),-0.05,0.075,0.01),0xe0a030),
    col(at(new THREE.BoxGeometry(0.05,0.008,0.07),0.05,0.004,0.03),0xe0a030),
    col(at(new THREE.BoxGeometry(0.05,0.008,0.07),-0.05,0.004,0.03),0xe0a030),
  ]);
  const head=mergeGeometries([
    col(at(new THREE.SphereGeometry(0.065,10,8),0,0.06,0.03),lk.body),
    col(at(new THREE.ConeGeometry(0.022,0.06,6),0,0.055,0.115,Math.PI/2,0,0),0xe8a020),
    col(at(new THREE.BoxGeometry(0.014,0.045,0.07),0,0.125,0.03),0xc81e1e),
    col(at(new THREE.SphereGeometry(0.02,6,5),0,0.02,0.085,0,0,0,0.7,1.3,0.7),0xc81e1e),
    col(at(new THREE.SphereGeometry(0.011,6,5),0.045,0.075,0.07),0x111111),
    col(at(new THREE.SphereGeometry(0.011,6,5),-0.045,0.075,0.07),0x111111),
  ]);
  const wing=col(at(new THREE.SphereGeometry(0.1,9,7),0,-0.03,-0.02,0,0,0,0.25,0.7,1.15),lk.tail===0x2a2622?lk.body:lk.body);
  return { body, head, wing };
}

export function createAnimals(W,{ count=7, rIn=4.5, rOut=14.5 }={}){
  const mat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.92 });
  const group=new THREE.Group(); W.scene.add(group);
  const geos=LOOKS.map(chickenParts);
  const R=(a,b)=>a+Math.random()*(b-a);
  const list=[];
  for(let i=0;i<count;i++){
    const G=geos[i%geos.length]; const g=new THREE.Group();
    const body=new THREE.Mesh(G.body,mat); body.castShadow=true; g.add(body);
    const head=new THREE.Group(); head.position.set(0,0.34,0.15); g.add(head); const hm=new THREE.Mesh(G.head,mat); hm.castShadow=true; head.add(hm);
    const wl=new THREE.Group(), wr=new THREE.Group(); wl.position.set(0.13,0.31,0); wr.position.set(-0.13,0.31,0); g.add(wl,wr);
    const ml=new THREE.Mesh(G.wing,mat), mr=new THREE.Mesh(G.wing,mat); wl.add(ml); wr.add(mr);
    const a=R(0,Math.PI*2), r=R(rIn,rOut); g.position.set(Math.sin(a)*r,0,-Math.cos(a)*r); g.rotation.y=R(-Math.PI,Math.PI);
    const s=R(0.9,1.15); g.scale.setScalar(s); group.add(g);
    list.push({ g, head, wl, wr, yaw:g.rotation.y, state:'idle', t:R(0,4), tgt:null, spd:0, flap:0, hop:0, vy:0, y:0, peck:0, from:null, pinned:false });
  }
  let hidden=false;
  function pickTarget(c){ const a=Math.random()*Math.PI*2, r=R(rIn,rOut); c.tgt=new THREE.Vector3(Math.sin(a)*r,0,-Math.cos(a)*r); c.state='walk'; c.spd=R(0.35,0.6); }
  function flee(c,from,force=1){ const p=c.g.position; const d=new THREE.Vector3(p.x-from.x,0,p.z-from.z); if(d.lengthSq()<1e-4) d.set(Math.random()-.5,0,Math.random()-.5); d.normalize();
    d.applyAxisAngle(new THREE.Vector3(0,1,0),R(-0.7,0.7)); c.tgt=p.clone().addScaledVector(d,R(2.2,3.8)*force); c.state='flee'; c.spd=R(2.4,3.2); c.flap=R(0.5,0.9); if(c.y<0.01){ c.vy=R(1.2,2.2); } c.pinned=false; }
  const _v=new THREE.Vector3();
  const off=W.tick((dt,t)=>{
    if(hidden) return;
    for(const c of list){ const p=c.g.position;
      if(c.dead){ c.g.rotation.set(0,c.yaw,1.45); p.y=0.11; c.wl.rotation.z=-0.6; c.wr.rotation.z=0.6; c.head.rotation.x=0.9; continue; }   // sabah kümeste bulunan tavuk
      // kaçma: koşan ya da çok yaklaşan insan
      if(c.state!=='flee' && !c.pinned){ for(const a of W.actors){ if(!a.holder.visible||a.alpha<0.5) continue; a.holder.getWorldPosition(_v); const d=Math.hypot(_v.x-p.x,_v.z-p.z); const run=a.target&&a.spd>1.8;
          if(d<(run?2.4:0.75)){ flee(c,_v,run?1.2:0.7); break; } } }
      c.t-=dt;
      if(c.state==='idle'){ if(c.t<=0){ if(Math.random()<.55) pickTarget(c); else { c.t=R(1.5,4); c.peck=R(0.8,2.2); } } }
      if((c.state==='walk'||c.state==='flee') && c.tgt){ const dx=c.tgt.x-p.x, dz=c.tgt.z-p.z; const d=Math.hypot(dx,dz);
        if(d<0.08){ c.state='idle'; c.tgt=null; c.t=R(1,3.5); c.peck=R(0.6,1.8); }
        else { const want=Math.atan2(dx,dz); const dy=wrap(want-c.yaw); c.yaw+=Math.sign(dy)*Math.min(Math.abs(dy),dt*(c.state==='flee'?12:5)); const st=Math.min(d,c.spd*dt*(Math.abs(dy)>1.2?0.3:1)); p.x+=dx/d*st; p.z+=dz/d*st;
          const rr=Math.hypot(p.x,p.z); if(rr>rOut+3){ p.x*=(rOut+3)/rr; p.z*=(rOut+3)/rr; } } }
      // zıplama / kanat
      if(c.y>0||c.vy>0){ c.vy-=9.8*dt; c.y+=c.vy*dt; if(c.y<0){ c.y=0; c.vy=0; } }
      c.flap=Math.max(0,c.flap-dt);
      const f=c.flap>0?Math.sin(t*38)*0.9+0.4:0; c.wl.rotation.z=-f; c.wr.rotation.z=f;
      // kafa: yürürken ileri-geri, gagalarken aşağı
      const walking=c.state!=='idle'; c.peck=Math.max(0,c.peck-dt);
      const bob=walking?Math.sin(t*(c.state==='flee'?22:11)+p.x)*0.035:0; const pk=c.peck>0?Math.max(0,Math.sin(t*9+p.z))*1.0:0;
      c.head.position.z=0.15+bob; c.head.rotation.x=pk*0.9; c.head.position.y=0.34-pk*0.08;
      c.g.rotation.set(walking?Math.sin(t*11)*0.04:0,c.yaw,walking?Math.sin(t*11+1)*0.06:0); p.y=c.y; }
  });
  return {
    list, group,
    /** p noktasından herkes kaçsın */
    flee(p,r=3.5){ for(const c of list){ const d=Math.hypot(c.g.position.x-p.x,c.g.position.z-p.z); if(d<r) flee(c,p,1.3); } },
    /** bir tavuğu sahne için yerleştir (sabit bekler, kaçmaz) */
    place(i,x,z,yaw=0){ const c=list[i%list.length]; c.g.position.set(x,0,z); c.yaw=yaw; c.state='idle'; c.tgt=null; c.t=99; c.pinned=true; c.peck=99; c.g.visible=true; return c; },
    release(c){ if(c){ c.pinned=false; c.t=R(0.5,2); c.peck=0; } },
    kick(c,from){ if(c) flee(c,from,1.6); },
    show(on){ hidden=!on; group.visible=on; },
    dispose(){ off(); W.scene.remove(group); mat.dispose(); },
  };
}
