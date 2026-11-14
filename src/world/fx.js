/* =====================================================================
   SAHNE EFEKTLERİ — kan fışkırması, toz, kül/kıvılcım (havuzlu parçacıklar)
   ===================================================================== */
import * as THREE from 'three';
import { glowTex } from './people.js';

const VS=`attribute float aSize; attribute float aAlpha; attribute vec3 aCol; varying float vA; varying vec3 vC; uniform float uPR;
void main(){ vA=aAlpha; vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPR*aSize*420./max(.5,-mv.z); }`;
const FS=`uniform sampler2D uMap; varying float vA; varying vec3 vC; void main(){ vec4 t=texture2D(uMap,gl_PointCoord); float a=t.a*vA; if(a<.01) discard; gl_FragColor=vec4(vC*(.55+.45*t.r),a); }`;

function pool(scene, N, blending, pr){
  const g=new THREE.BufferGeometry(); const pos=new Float32Array(N*3), size=new Float32Array(N), alpha=new Float32Array(N), col=new Float32Array(N*3);
  g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('aSize',new THREE.BufferAttribute(size,1)); g.setAttribute('aAlpha',new THREE.BufferAttribute(alpha,1)); g.setAttribute('aCol',new THREE.BufferAttribute(col,3));
  g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),400);
  const m=new THREE.ShaderMaterial({ vertexShader:VS, fragmentShader:FS, uniforms:{ uMap:{ value:glowTex() }, uPR:{ value:pr } }, transparent:true, depthWrite:false, blending });
  const pts=new THREE.Points(g,m); pts.frustumCulled=false; pts.renderOrder=5; scene.add(pts);
  const P=[]; for(let i=0;i<N;i++) P.push({ on:false });
  return { pts, g, P, pos, size, alpha, col, next:0 };
}

export function createFX(scene, pr=1){
  const normal=pool(scene,420,THREE.NormalBlending,pr), add=pool(scene,260,THREE.AdditiveBlending,pr);
  const _c=new THREE.Color();
  function emit(sys, o){ const k=sys.next; sys.next=(sys.next+1)%sys.P.length; const p=sys.P[k];
    Object.assign(p,{ on:true, x:o.x, y:o.y, z:o.z, vx:o.vx||0, vy:o.vy||0, vz:o.vz||0, g:o.g??-9.8, drag:o.drag??0.4, life:o.life||1, age:0, s0:o.s0||0.05, s1:o.s1??o.s0??0.05, a0:o.a0??1, floor:o.floor??0.01, stick:!!o.stick });
    _c.set(o.col||0xffffff); p.r=_c.r; p.gg=_c.g; p.b=_c.b; }
  const R=(a,b)=>a+Math.random()*(b-a);
  const api={
    /** kan fışkırması: p konum, dir yön (birim), n adet */
    blood(p,dir,n=26,pow=2.6){ for(let i=0;i<n;i++){ const sp=pow*R(0.35,1.2); emit(normal,{ x:p.x,y:p.y,z:p.z, vx:dir.x*sp+R(-.8,.8), vy:dir.y*sp+R(0.2,1.4), vz:dir.z*sp+R(-.8,.8), g:-9.8, drag:0.6, life:R(0.6,1.4), s0:R(0.025,0.06), s1:0.02, col:Math.random()<.5?0x6a0008:0x8a0c0c, stick:true }); } },
    /** toz bulutu */
    dust(p,n=14,spread=0.5,col=0x9a8a72){ for(let i=0;i<n;i++){ const a=Math.random()*6.283; emit(normal,{ x:p.x+Math.cos(a)*spread*0.3,y:p.y+R(0,.15),z:p.z+Math.sin(a)*spread*0.3, vx:Math.cos(a)*R(.3,1.2)*spread, vy:R(.2,.9), vz:Math.sin(a)*R(.3,1.2)*spread, g:0.15, drag:2.2, life:R(0.9,1.8), s0:R(0.12,0.22), s1:R(0.35,0.6), a0:0.42, col }); } },
    /** sürüklenen ayakların bıraktığı ince toz izi */
    trail(p){ emit(normal,{ x:p.x+R(-.06,.06),y:0.04,z:p.z+R(-.06,.06), vx:R(-.2,.2), vy:R(.05,.35), vz:R(-.2,.2), g:0.05, drag:2.5, life:R(0.7,1.3), s0:0.06, s1:R(0.2,0.32), a0:0.32, col:0x9a8a72 }); },
    /** kül ve kıvılcım (vampir ölürken) */
    ash(p,n=10){ for(let i=0;i<n;i++){ emit(normal,{ x:p.x+R(-.35,.35),y:p.y+R(0,.2),z:p.z+R(-.35,.35), vx:R(-.15,.15), vy:R(.4,1.1), vz:R(-.15,.15), g:0.35, drag:0.8, life:R(1.6,3.0), s0:R(0.05,0.1), s1:R(0.25,0.45), a0:0.55, col:0x2a2a2e });
      if(Math.random()<.6) emit(add,{ x:p.x+R(-.3,.3),y:p.y+R(0,.2),z:p.z+R(-.3,.3), vx:R(-.3,.3), vy:R(.6,1.6), vz:R(-.3,.3), g:0.2, drag:0.6, life:R(0.8,1.8), s0:R(0.02,0.04), s1:0.01, col:0xff6a20 }); } },
    /** kıymık / tahta parçası */
    splinters(p,n=8){ for(let i=0;i<n;i++){ const a=Math.random()*6.283; emit(normal,{ x:p.x,y:p.y,z:p.z, vx:Math.cos(a)*R(1,3), vy:R(1,3), vz:Math.sin(a)*R(1,3), g:-9.8, drag:0.3, life:R(0.6,1.1), s0:R(0.02,0.035), s1:0.02, col:0x6a4a2a }); } },
    update(dt){
      for(const sys of [normal,add]){ let any=false;
        for(let i=0;i<sys.P.length;i++){ const p=sys.P[i];
          if(!p.on){ sys.alpha[i]=0; continue; } any=true;
          p.age+=dt; if(p.age>=p.life){ p.on=false; sys.alpha[i]=0; continue; }
          const k=Math.exp(-p.drag*dt); p.vx*=k; p.vy=p.vy*k+p.g*dt; p.vz*=k; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
          if(p.y<p.floor){ p.y=p.floor; if(p.stick){ p.vx=p.vy=p.vz=0; p.g=0; } else { p.vy=Math.abs(p.vy)*0.2; p.vx*=0.5; p.vz*=0.5; } }
          const t=p.age/p.life; sys.pos[i*3]=p.x; sys.pos[i*3+1]=p.y; sys.pos[i*3+2]=p.z;
          sys.size[i]=p.s0+(p.s1-p.s0)*t; sys.alpha[i]=p.a0*(t<0.08?t/0.08:1)*(1-Math.pow(t,p.stick?3:1.5)); sys.col[i*3]=p.r; sys.col[i*3+1]=p.gg; sys.col[i*3+2]=p.b; }
        if(any||sys.wasAny){ for(const k of ['position','aSize','aAlpha','aCol']) sys.g.attributes[k].needsUpdate=true; } sys.wasAny=any; }
    },
    dispose(){ for(const sys of [normal,add]){ scene.remove(sys.pts); sys.g.dispose(); sys.pts.material.dispose(); } },
  };
  return api;
}
