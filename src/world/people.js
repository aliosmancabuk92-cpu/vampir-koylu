/* =====================================================================
   KÖYLÜLER — gerçek oranlı gövde + köylü kıyafeti + bıyık / başlık
   Yürüme, dönme, başını konuşana çevirme, asılma/kazık pozları.
   Animasyonlar: Quaternius Universal Animation Library (CC0)
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Karakter tipleri (tek oyunculu: hepsi erkek) */
export const LOOKS = {
  player:   { skin:'#d9a882', hair:'#1a120c', cloth:'#8a5a3a', hat:'kasket', hatC:'#2a2826', must:'kalin', h:1.78, w:1.0, idle:'Idle_Loop' },
  muhtar:   { skin:'#c99472', hair:'#2a2420', cloth:'#4a4a52', hat:'kasket', hatC:'#1e1c1a', must:'pala',  h:1.76, w:1.1,  idle:'Idle_FoldArms_Loop', walk:'Walk_Formal_Loop' },
  dayioglu: { skin:'#c48d66', hair:'#16100c', cloth:'#5a6a3a', hat:'kasket', hatC:'#3a3228', must:'kalin', h:1.8,  w:1.04, idle:'Idle_Loop' },
  emmi:     { skin:'#d8a47e', hair:'#5a544c', cloth:'#d8ccb4', hat:'takke',  hatC:'#e6e0d4', must:'kalin', h:1.74, w:1.0,  idle:'Idle_FoldArms_Loop' },
  delikanli:{ skin:'#dcb08a', hair:'#120c08', cloth:'#3a5a8a', hat:'none',   must:'ince',  h:1.84, w:0.94, idle:'Idle_Loop' },
  memis:    { skin:'#caa07a', hair:'#1a120c', cloth:'#8a3a30', hat:'kasket', hatC:'#4a1a16', must:'kalin', h:1.72, w:1.12, idle:'Idle_Loop' },
  dede:     { skin:'#c49070', hair:'#cfcac2', cloth:'#6a6258', hat:'kalpak', hatC:'#2a2420', must:'pala', mustC:'#d8d4cc', beard:'#cfcac2', h:1.7, w:0.98, idle:'Idle_FoldArms_Loop', slow:true },
  coban:    { skin:'#b98060', hair:'#1e140e', cloth:'#9a7a4a', hat:'none',   must:'kalin', h:1.79, w:1.02, idle:'Idle_Loop' },
  bakkal:   { skin:'#d4a07c', hair:'#2a1e14', cloth:'#e2d8c4', hat:'kasket', hatC:'#3a342c', must:'kalin', h:1.73, w:1.15, idle:'Idle_FoldArms_Loop' },
  kahveci:  { skin:'#c48d66', hair:'#1a120c', cloth:'#6a4a6a', hat:'takke',  hatC:'#2a2a30', must:'pala',  h:1.77, w:1.0,  idle:'Idle_Loop' },
  bekci:    { skin:'#c08a68', hair:'#1a120c', cloth:'#2e3e5e', hat:'bekci',  hatC:'#1e2230', must:'kalin', h:1.8,  w:1.05, idle:'Idle_Lantern_Loop', lantern:true },
  demirci:  { skin:'#b07858', hair:'#0e0a08', cloth:'#5a3a26', hat:'none',   must:'kalin', h:1.82, w:1.18, idle:'Idle_FoldArms_Loop' },
  deli:     { skin:'#d4a47e', hair:'#3a2414', cloth:'#7a8a5a', hat:'none',   must:'none',  h:1.75, w:0.96, idle:'Idle_Loop' },
  // gece kapıya gelen isimsiz gölge (kimliği belli olmasın)
  golge:    { skin:'#4a3a36', hair:'#050505', cloth:'#0b0b10', clothAmt:0.96, hat:'hood', hatC:'#08080b', must:'none', h:1.88, w:1.05, idle:'Idle_Loop' },
  // odalı mod (kadın) tipleri
  kadin1:   { female:true, skin:'#e0b494', hair:'#2a1a10', cloth:'#6a3a40', scarf:'#8a2a2a', h:1.66, w:1.0, idle:'Idle_Loop' },
  kadin2:   { female:true, skin:'#d4a07c', hair:'#140c08', cloth:'#3a4a5a', scarf:'#e8e2d4', h:1.64, w:1.0, idle:'Idle_FoldArms_Loop' },
  kadin3:   { female:true, skin:'#c99472', hair:'#5a3a22', cloth:'#5a5a3a', scarf:'#3a5a3a', h:1.68, w:1.0, idle:'Idle_Loop' },
};
export const MALE_KEYS=['muhtar','dayioglu','emmi','delikanli','memis','dede','coban','bakkal','kahveci','bekci','demirci','deli'];
export const FEMALE_KEYS=['kadin1','kadin2','kadin3'];

let LIB=null, LIBP=null;
/** GLB yükle; önizleme ortamında (yalnızca bazı dosya türleri sunulur) base64'lü JSON içinden okunur */
export function loadGLTF(loader, url){
  if((globalThis.VK_GLB_EXT||'.glb')!=='.json') return loader.loadAsync(url);
  return fetch(url).then(r=>r.json()).then(j=>{ const bin=atob(j.b); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); return loader.parseAsync(u8.buffer,''); });
}
/** Varlıkları bir kez yükle */
export function loadPeople(base='./assets/3d/', onProgress){
  if(LIBP) return LIBP;
  const L=new GLTFLoader(); L.setMeshoptDecoder(MeshoptDecoder);
  const X=globalThis.VK_GLB_EXT||'.glb';
  const files=['chars/male_body','chars/male_outfit','chars/female_body','chars/female_outfit','anim/ual1','anim/ual2','anim/mocap'].map(f=>f+X);
  let done=0;
  const metaP=fetch(base+'anim/mocap_meta.json').then(r=>r.ok?r.json():{}).catch(()=>({}));
  LIBP=Promise.all([...files.map(f=>loadGLTF(L,base+f).then(g=>{ done++; onProgress&&onProgress(done/files.length); return g; })), metaP]).then(out=>{
    const clips=new Map(); for(const g of [out[4],out[5],out[6]]) for(const c of g.animations) clips.set(c.name, c);
    const meta=out[7]||{}; for(const k in meta){ const m=meta[k]; m.traj=Float32Array.from(m.traj); }
    LIB={ maleBody:out[0], maleOutfit:out[1], femBody:out[2], femOutfit:out[3], clips, meta }; return LIB; });
  return LIBP;
}
/** gerçek hareket (mocap) klibinin bilgisi: süre, olay zamanları (vuruş vb.) */
export function clipInfo(name){ const c=LIB&&LIB.clips.get(name); const m=LIB&&LIB.meta[name]; return c?{ dur:c.duration, ev:(m&&m.ev)||{}, traj:m?.traj||null, n:m?.n||0, fps:m?.fps||30 }:null; }
/** iki kişilik klipte B'nin başlangıç konumu (A'nın çapasına göre) */
export function clipStart(name){ const m=LIB&&LIB.meta[name]; if(!m) return { x:0, z:0, yaw:0 }; return { x:m.traj[0], z:m.traj[1], yaw:m.traj[2] }; }

const tint=(mat,hex,amt)=>{ if(!mat||!hex) return; const c=new THREE.Color(hex); mat.color.lerp(c,amt); };
/** kıyafet dokusunu gri tona çevirip istenen renge boyar (çeşitlilik için) */
function recolor(mat,hex,amt){ const u={ value:new THREE.Color(hex) }, k={ value:amt }; mat.userData.tint=u;
  mat.onBeforeCompile=(sh)=>{ sh.uniforms.uTint=u; sh.uniforms.uTintAmt=k;
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uTint; uniform float uTintAmt;').replace('#include <map_fragment>',`#include <map_fragment>
      float lum=dot(diffuseColor.rgb,vec3(.299,.587,.114)); vec3 rc=uTint*lum*2.6; diffuseColor.rgb=mix(diffuseColor.rgb,rc,uTintAmt*smoothstep(.04,.16,lum));`); };
  mat.customProgramCacheKey=()=>'recolor'; mat.needsUpdate=true; }
const maskedGeo=new Map();
function maskBelowNeck(mesh){
  const sk=mesh.skeleton; const ni=sk.bones.findIndex(b=>b.name==='neck_01'), hi=sk.bones.findIndex(b=>b.name==='Head'); if(ni<0||hi<0) return;
  const key=mesh.geometry.uuid;
  if(!maskedGeo.has(key)){
    const neck=new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[ni].clone().invert());
    const head=new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[hi].clone().invert());
    const pos=mesh.geometry.attributes.position; const hide=new Float32Array(pos.count); const v=new THREE.Vector3();
    for(let k=0;k<pos.count;k++){ v.fromBufferAttribute(pos,k); const below=v.y<neck.y-0.012; const far=Math.hypot(v.x-head.x,v.z-head.z)>0.16 && v.y<head.y; hide[k]=(below||far)?1:0; }
    const g=mesh.geometry.clone(); g.setAttribute('aHide',new THREE.BufferAttribute(hide,1)); maskedGeo.set(key,g);
  }
  mesh.geometry=maskedGeo.get(key);
  mesh.material.onBeforeCompile=(sh)=>{
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aHide; varying float vHide;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHide=aHide;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vHide;').replace('void main() {','void main() {\nif(vHide>0.5) discard;');
  };
  mesh.material.customProgramCacheKey=()=>'mask-neck'; mesh.material.needsUpdate=true;
}
let _glow=null; export function glowTex(){ if(_glow) return _glow; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); const g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.25,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); _glow=new THREE.CanvasTexture(c); return _glow; }

const _q=new THREE.Quaternion(), _v=new THREE.Vector3(), _w=new THREE.Vector3();
const AX=new THREE.Vector3(1,0,0), AY=new THREE.Vector3(0,1,0), AZ=new THREE.Vector3(0,0,1);
export const AXES={ X:AX, Y:AY, Z:AZ };
const wrap=(a)=>{ while(a>Math.PI) a-=Math.PI*2; while(a<-Math.PI) a+=Math.PI*2; return a; };
const WALK_V=1.3, JOG_V=3.1;

/** Pozlar (kemik eklemeleri: [eksen, açı]) */
export const POSES = {
  hang:    { Head:[[AZ,0.5],[AX,0.18]], neck_01:[[AZ,0.22]], spine_03:[[AX,0.06]], upperarm_l:[[AZ,-0.1]], upperarm_r:[[AZ,0.1]], foot_l:[[AX,0.7]], foot_r:[[AX,0.75]], thigh_l:[[AX,0.05]], calf_r:[[AX,-0.12]] },
  hangVamp:{ Head:[[AX,-0.25]], foot_l:[[AX,0.5]], foot_r:[[AX,0.5]] },
  impaled: { Head:[[AX,-0.5],[AZ,0.28]], spine_03:[[AX,-0.15]], upperarm_l:[[AZ,0.45]], upperarm_r:[[AZ,-0.45]], lowerarm_l:[[AX,0.3]], lowerarm_r:[[AX,0.3]], thigh_l:[[AZ,0.18],[AX,0.3]], thigh_r:[[AZ,-0.18],[AX,0.22]], calf_l:[[AX,-0.45]], calf_r:[[AX,-0.35]], foot_l:[[AX,0.6]], foot_r:[[AX,0.6]] },
  slump:   { Head:[[AX,0.5]] },
  cower:   { Head:[[AX,0.35]], spine_02:[[AX,0.25]] },
};

/** Bir köylü oluştur */
export function createVillager(key='player', opts={}){
  if(!LIB) throw new Error('loadPeople() önce çağrılmalı');
  const Lk={ ...(LOOKS[key]||LOOKS.player), ...(opts.look||{}) }; const fem=!!Lk.female;
  const body=fem?LIB.femBody:LIB.maleBody, outfit=fem?LIB.femOutfit:LIB.maleOutfit;
  const root=SkeletonUtils.clone(body.scene);
  const bones=new Map(); root.traverse(o=>{ if(o.isBone) bones.set(o.name,o); });
  const mats=[]; const bodySkin=[];
  root.traverse(o=>{ if(o.isSkinnedMesh){ o.material=o.material.clone(); mats.push(o.material); o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false;
    const n=o.material.name||''; if(/Superhero|Regular/.test(n)){ maskBelowNeck(o); tint(o.material,Lk.skin,.5); o.material.roughness=.7; bodySkin.push(o); }
    if(/Hair|Eyebrow/.test(n)){ tint(o.material,Lk.hair,.85); } if(/Eye/.test(n) && !/Eyebrow/.test(n)) o.userData.eyes=true; } });
  const out=SkeletonUtils.clone(outfit.scene); const add=[]; out.traverse(o=>{ if(o.isSkinnedMesh) add.push(o); });
  for(const m of add){ const nb=m.skeleton.bones.map(b=>bones.get(b.name)||b); m.material=m.material.clone(); mats.push(m.material); m.castShadow=true; m.receiveShadow=true; m.frustumCulled=false;
    if(/Peasant/.test(m.material.name||'')) recolor(m.material,Lk.cloth,Lk.clothAmt??0.62); if(/Regular/.test(m.material.name||'')) tint(m.material,Lk.skin,.5);
    const sk=new THREE.Skeleton(nb, m.skeleton.boneInverses); m.removeFromParent(); root.add(m); m.bind(sk, m.bindMatrix); }

  /* ---- aksesuarlar ---- */
  root.updateMatrixWorld(true);
  const headB=bones.get('Head'); let eyeBox=null;
  root.traverse(o=>{ if(o.isMesh && o.userData.eyes){ o.geometry.computeBoundingBox(); const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); eyeBox=eyeBox?eyeBox.union(b):b; } });
  const eyeGlow=[], hatParts=[]; let headTop=1.75;
  if(headB && eyeBox){
    const E=eyeBox.getCenter(new THREE.Vector3()); const ew=Math.max(0.05, eyeBox.max.x-eyeBox.min.x); const fz=eyeBox.max.z;
    const hm=new THREE.MeshStandardMaterial({ color:new THREE.Color(Lk.mustC||Lk.hair), roughness:.95 }); mats.push(hm);
    const attach=(m,hat=false)=>{ m.castShadow=true; root.add(m); headB.attach(m); if(hat) hatParts.push(m); };
    if(!fem && Lk.must && Lk.must!=='none'){
      const y=E.y-ew*0.62, z=fz+ew*0.03, w=ew*(Lk.must==='pala'?0.8:Lk.must==='ince'?0.5:0.64); const droop=Lk.must==='pala'?0.32:0.15;
      const curve=new THREE.CatmullRomCurve3([ new THREE.Vector3(E.x-w,y-ew*droop,z-ew*0.14), new THREE.Vector3(E.x-w*0.5,y+ew*0.01,z+ew*0.02), new THREE.Vector3(E.x,y+ew*0.035,z+ew*0.05), new THREE.Vector3(E.x+w*0.5,y+ew*0.01,z+ew*0.02), new THREE.Vector3(E.x+w,y-ew*droop,z-ew*0.14) ]);
      const thick=Lk.must==='ince'?0.04:Lk.must==='pala'?0.09:0.072;
      const tube=new THREE.TubeGeometry(curve,24,ew*thick,8,false);
      const pz=tube.attributes.position; const cc=curve.getSpacedPoints(24); // uçlara doğru incelt
      for(let i=0;i<pz.count;i++){ const seg=Math.floor(i/9); const t=seg/24; const s=0.45+0.55*Math.sin(Math.PI*t); const c=cc[Math.min(24,seg)]; pz.setXYZ(i, c.x+(pz.getX(i)-c.x)*s, c.y+(pz.getY(i)-c.y)*s, c.z+(pz.getZ(i)-c.z)*s); }
      tube.computeVertexNormals(); attach(new THREE.Mesh(tube, hm));
    }
    if(Lk.beard){ const bm=new THREE.MeshStandardMaterial({ color:new THREE.Color(Lk.beard), roughness:1 }); mats.push(bm);
      // çene altını saran kısa sakal: alt yarım küre, yüzün ön yüzeyine yakın
      const g=new THREE.SphereGeometry(ew*0.62,18,12,0,Math.PI*2,Math.PI*0.5,Math.PI*0.5); const b=new THREE.Mesh(g,bm); b.scale.set(1.15,1.05,0.75); b.position.set(E.x, E.y-ew*1.02, fz-ew*0.42); attach(b); }
    // kafa ölçüleri (göz hizasının üstündeki deri noktalarından)
    let top=-1e9, mnx=1e9, mxx=-1e9, mnz=1e9, mxz=-1e9; const v=new THREE.Vector3();
    for(const o of bodySkin){ const pos=o.geometry.attributes.position; for(let k=0;k<pos.count;k++){ v.fromBufferAttribute(pos,k).applyMatrix4(o.matrixWorld); if(v.y<E.y+ew*0.15 || Math.abs(v.x-E.x)>0.16 || Math.abs(v.z-(fz-0.09))>0.16) continue; if(v.y>top) top=v.y; mnx=Math.min(mnx,v.x); mxx=Math.max(mxx,v.x); mnz=Math.min(mnz,v.z); mxz=Math.max(mxz,v.z); } }
    if(top<0){ top=E.y+ew*1.6; mnx=E.x-0.08; mxx=E.x+0.08; mnz=fz-0.18; mxz=fz; }
    const hr=Math.max(0.065,(mxx-mnx)/2), cx=(mnx+mxx)/2, cz=(mnz+mxz)/2; headTop=top;
    const hatM=new THREE.MeshStandardMaterial({ color:new THREE.Color(Lk.hatC||'#222'), roughness:1 }); mats.push(hatM);
    if(Lk.hat==='kasket'){ const r=hr*1.14; const crown=new THREE.Mesh(new THREE.SphereGeometry(r,24,12,0,Math.PI*2,0,Math.PI*0.5), hatM); crown.scale.set(1.06,0.5,1.16); crown.position.set(cx,top-hr*0.36,cz-hr*0.04); crown.rotation.x=-0.12; attach(crown,true);
      const brim=new THREE.Mesh(new THREE.CylinderGeometry(r*0.92,r*0.92,hr*0.07,24,1,false,-Math.PI*0.34,Math.PI*0.68), hatM); brim.position.set(cx,top-hr*0.44,cz+hr*0.32); brim.rotation.x=0.16; attach(brim,true);
      const band=new THREE.Mesh(new THREE.CylinderGeometry(r*1.0,r*1.0,hr*0.22,24,1,true), hatM); band.position.set(cx,top-hr*0.47,cz-hr*0.04); attach(band,true); }
    if(Lk.hat==='takke'){ const t=new THREE.Mesh(new THREE.SphereGeometry(hr*1.07,20,10,0,Math.PI*2,0,Math.PI*0.36), hatM); t.position.set(cx,top-hr*1.0,cz-hr*0.05); attach(t,true); }
    if(Lk.hat==='kalpak'){ const k=new THREE.Mesh(new THREE.CylinderGeometry(hr*1.08,hr*1.02,hr*1.25,20), hatM); k.position.set(cx,top+hr*0.12,cz-hr*0.05); attach(k,true); }
    if(Lk.hat==='bekci'){ const c=new THREE.Mesh(new THREE.CylinderGeometry(hr*1.16,hr*1.05,hr*0.72,20), hatM); c.position.set(cx,top-hr*0.02,cz-hr*0.04); attach(c,true);
      const vm=new THREE.MeshStandardMaterial({ color:0x08080a, roughness:.4 }); mats.push(vm); const vz=new THREE.Mesh(new THREE.CylinderGeometry(hr*1.0,hr*1.0,hr*0.06,20,1,false,-Math.PI*0.32,Math.PI*0.64), vm); vz.position.set(cx,top-hr*0.36,cz+hr*0.3); attach(vz,true); }
    if(Lk.hat==='hood'){ const hm2=new THREE.MeshStandardMaterial({ color:new THREE.Color(Lk.hatC||'#08080b'), roughness:1, side:THREE.DoubleSide }); mats.push(hm2);
      const hood=new THREE.Mesh(new THREE.SphereGeometry(hr*1.32,24,16,0,Math.PI*2,0,Math.PI*0.72), hm2); hood.scale.set(1.0,1.18,1.12); hood.position.set(cx,top-hr*0.95,cz-hr*0.22); attach(hood);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(hr*0.7,hr*0.9,16), hm2); tip.position.set(cx,top+hr*0.45,cz-hr*0.45); tip.rotation.x=-0.5; attach(tip); }
    if(fem && Lk.scarf){ const sm=new THREE.MeshStandardMaterial({ color:new THREE.Color(Lk.scarf), roughness:.95, side:THREE.DoubleSide }); mats.push(sm); const s=new THREE.Mesh(new THREE.SphereGeometry(hr*1.18,24,14,0,Math.PI*2,0,Math.PI*0.66), sm); s.scale.set(1.02,1.08,1.1); s.position.set(cx,top-hr*1.0,cz-hr*0.1); attach(s); }
    // kızıl gözler (vampir) — başlangıçta görünmez
    const gm=new THREE.MeshBasicMaterial({ color:0xff2a1a, transparent:true, opacity:0, depthWrite:false, fog:false });
    for(const s of [-1,1]){ const e=new THREE.Mesh(new THREE.SphereGeometry(ew*0.14,10,8), gm); e.position.set(E.x+s*ew*0.3, E.y+ew*0.02, fz+ew*0.03); root.add(e); headB.attach(e); eyeGlow.push(e); }
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex(), color:0xff2010, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, fog:false })); halo.scale.setScalar(ew*3.2); halo.position.set(E.x,E.y,fz+ew*0.2); root.add(halo); headB.attach(halo); eyeGlow.push(halo);
  }
  let lantern=null;
  if(Lk.lantern){ const hand=bones.get('hand_l')||bones.get('hand_r'); if(hand){ const lg=new THREE.Group(); const lm=new THREE.MeshStandardMaterial({ color:0x221a10, emissive:0xffa040, emissiveIntensity:2.4, roughness:.5 }); mats.push(lm); const box=new THREE.Mesh(new THREE.BoxGeometry(0.11,0.17,0.11), lm); lg.add(box); const cap=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.07,4), new THREE.MeshStandardMaterial({ color:0x1a1612, metalness:.6, roughness:.5 })); cap.position.y=0.12; lg.add(cap); lg.position.set(0,-0.18,0.02); hand.add(lg); lantern=lm; } }

  const holder=new THREE.Group(); holder.add(root); holder.name='villager:'+key;
  const sc=(Lk.h||1.78)/1.8; holder.scale.set(sc*(Lk.w||1), sc, sc*(Lk.w||1));
  // seçim için görünmez kapsül
  const hit=new THREE.Mesh(new THREE.CapsuleGeometry(0.32,1.1,4,8), new THREE.MeshBasicMaterial({ visible:false })); hit.position.y=0.9; holder.add(hit);
  const mixer=new THREE.AnimationMixer(root);
  const V={ key, cfg:Lk, holder, root, bones, mixer, mats, eyeGlow, hatParts, lantern, hit, scale:sc, headTop:headTop*sc,
    cur:null, curName:null, yaw:0, faceYaw:null, target:null, spd:0, onArrive:null, walkClip:Lk.walk||'Walk_Loop', idleClip:Lk.idle||'Idle_Loop',
    pose:null, poseW:0, poseTo:0, look:null, lookYaw:0, lookPitch:0, kickT:0, vamp:0, alpha:1, talk:false, fixed:false, frozen:false, ext:{} };
  V.headPos=(out=new THREE.Vector3())=>{ const hb=bones.get('Head'); if(hb){ hb.getWorldPosition(out); out.y+=0.12*sc; return out; } return out.copy(holder.position).setY(holder.position.y+V.headTop); };
  V.play=(name,{ fade=.3, once=false, speed=1, restart=false, at=null }={})=>{
    const c=LIB.clips.get(name); if(!c) return null;
    if(V.curName===name && !restart && !once && V.cur){ V.cur.timeScale=speed; V.cur.paused=false; return V.cur; }
    const a=mixer.clipAction(c); a.reset(); a.paused=false; a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat, once?1:Infinity); a.clampWhenFinished=once; a.timeScale=speed; if(at!=null) a.time=at; a.play();
    if(V.cur && V.cur!==a && fade>0) a.crossFadeFrom(V.cur, fade, false); else if(V.cur && V.cur!==a) V.cur.stop();
    V.cur=a; V.curName=name; return a;
  };
  V.idle=(fade=.35)=>{ if(V.fixed) return; V.play(V.talk?'Idle_Talking_Loop':V.idleClip, { speed:Lk.slow?0.85:1, fade }); };
  V.once=(name,{ speed=1, then=null }={})=>new Promise(res=>{ const a=V.play(name,{ once:true, restart:true, speed }); if(!a){ res(); return; } const d=(a.getClip().duration/speed)*1000; setTimeout(()=>{ if(V.curName===name && !V.fixed){ if(then) V.play(then); else V.idle(); } res(); }, Math.max(200,d-120)); });
  V.freeze=(name,t=0)=>{ const a=V.play(name,{ fade:0, restart:true }); if(a){ a.time=t; a.paused=true; mixer.update(0); } V.frozen=true; };
  V.unfreeze=()=>{ V.frozen=false; if(V.cur) V.cur.paused=false; };
  V.setTalking=(on)=>{ if(V.talk===on) return; V.talk=on; if(!V.target && !V.fixed) V.idle(.4); };
  V.setVampire=(v)=>{ V.vamp=v; for(const e of eyeGlow) e.material.opacity=v*(e.isSprite?0.95:1); };
  V.setOpacity=(a)=>{ V.alpha=a; for(const m of mats){ m.transparent=a<0.999; m.opacity=a; m.depthWrite=a>0.4; } for(const e of eyeGlow) e.material.opacity=V.vamp*a*(e.isSprite?0.95:1); holder.visible=a>0.01; };
  V.setPose=(name,{ instant=false }={})=>{ if(name){ V.pose=POSES[name]||null; V.poseTo=1; if(instant) V.poseW=1; } else { V.poseTo=0; if(instant){ V.poseW=0; V.pose=null; } } };
  V.lookAt=(p)=>{ V.look=p?(p.isVector3?p.clone():p):null; };
  /** anında yerleştir */
  V.place=(x,z,yaw=V.yaw,y=0)=>{ endRM(); holder.position.set(x,y,z); V.yaw=yaw; holder.rotation.set(0,yaw,0); V.target=null; V.faceYaw=null; const f=V.onArrive; V.onArrive=null; if(f) f(); if(!V.fixed) V.idle(0); };
  /** Gerçek hareket klibi + kök yörüngesi. anchor: {x,z,yaw} (iki kişilik kliplerde ikisine de aynı çapa verilir).
      Söz klip bitince (ya da başka klip araya girince) çözülür. */
  const endRM=()=>{ const r=V.rm; if(!r) return; V.rm=null; const f=r.res; r.res=null; if(f) f(); };
  V.mocap=(name,{ anchor=null, fade=.25, speed=1, loop=false, inPlace=false, lockYaw=false, at=0, then=null }={})=>new Promise(res=>{
    const c=LIB.clips.get(name), m=LIB.meta[name]; if(!c||!m){ res(); return; }
    endRM(); V.target=null; const f=V.onArrive; V.onArrive=null; if(f) f(); V.faceYaw=null; V.fixed=true;
    const a=V.play(name,{ fade, once:!loop, restart:true, speed, at });
    const anc=anchor?{ ...anchor }:{ x:holder.position.x, z:holder.position.z, yaw:V.yaw };
    V.rm={ a, m, anc, inPlace, lockYaw, loop, then, x0:holder.position.x, z0:holder.position.z, y0:V.yaw, k:fade>0?0:1, fade:Math.max(1e-3,fade), res, dur:c.duration };
  });
  /** el hedefi (iki kemikli IK): side 'l'|'r', target: (v)=>Vector3|null, pole: (v)=>Vector3 dirsek yönü */
  V.ik={};
  V.setIK=(side,target,{ pole=null, w=1, rate=6 }={})=>{ const o=V.ik[side]; if(!target){ if(o) o.wTo=0; return; } V.ik[side]={ target, pole, w:o?o.w:0, wTo:w, rate }; };
  /** her karede çalışan kemik değiştiriciler: fn(dt, rot, bones, V) → kaldırmak için dönen fonksiyonu çağır */
  V.mods=new Set(); V.mod=(fn)=>{ V.mods.add(fn); return ()=>V.mods.delete(fn); };
  V.face=(a,{ instant=false }={})=>{ const y=(typeof a==='number')?a:Math.atan2(a.x-holder.position.x, a.z-holder.position.z); if(instant){ V.yaw=y; holder.rotation.y=y; V.faceYaw=null; } else V.faceYaw=y; };
  /** yürü / koş → varınca çözülen söz */
  V.walkTo=(x,z,{ run=false, speed=null, face=null, clip=null }={})=>new Promise(res=>{
    endRM(); const prev=V.onArrive; V.onArrive=null; if(prev) prev();
    const dx=x-holder.position.x, dz=z-holder.position.z; if(Math.hypot(dx,dz)<0.05){ if(face!=null) V.face(face); res(); return; }
    V.target=new THREE.Vector3(x,holder.position.y,z); V.spd=speed||(run?JOG_V:WALK_V)*(Lk.slow?0.85:1)*sc; V.afterFace=face;
    V.moveClip=clip||(run?'Jog_Fwd_Loop':V.walkClip); V.fixed=false;
    const nat=LIB.meta[V.moveClip]?.ev?.speed; V.play(V.moveClip,{ speed:V.spd/((nat||(run?JOG_V:WALK_V))*sc), fade:.25 });
    V.onArrive=res;
  });
  V.stop=()=>{ if(V.target){ V.target=null; const f=V.onArrive; V.onArrive=null; if(f) f(); V.idle(.25); } };
  V.kick=()=>{ V.kickT=0.0001; };

  // Kemik eklemeleri: karıştırıcı değişmeyen değerleri yeniden yazmadığı için her karede önce eski hâle döndür
  const orig=new Map(), touched=new Set();
  const rot=(b,ax,ang)=>{ if(!b||!ang) return; if(!touched.has(b)){ let q=orig.get(b); if(!q){ q=new THREE.Quaternion(); orig.set(b,q); } q.copy(b.quaternion); touched.add(b); } b.quaternion.multiply(_q.setFromAxisAngle(ax,ang)); };
  V.update=(dt)=>{
    for(const b of touched) b.quaternion.copy(orig.get(b)); touched.clear();
    // hareket
    if(V.target && !V.rm){ const p=holder.position; const dx=V.target.x-p.x, dz=V.target.z-p.z; const d=Math.hypot(dx,dz);
      if(d<0.06){ p.x=V.target.x; p.z=V.target.z; V.target=null; if(V.afterFace!=null) V.face(V.afterFace); const f=V.onArrive; V.onArrive=null; V.idle(.3); if(f) f(); }
      else { const want=Math.atan2(dx,dz); const dy=wrap(want-V.yaw); V.yaw+=Math.sign(dy)*Math.min(Math.abs(dy),dt*7); const step=Math.min(d, V.spd*dt*(Math.abs(dy)>1.4?0.35:1)); p.x+=dx/d*step; p.z+=dz/d*step; } }
    else if(V.faceYaw!=null && !V.rm){ const dy=wrap(V.faceYaw-V.yaw); if(Math.abs(dy)<0.01){ V.yaw=V.faceYaw; V.faceYaw=null; } else V.yaw+=Math.sign(dy)*Math.min(Math.abs(dy),dt*4.5); }
    if(!V.rm) holder.rotation.y=V.yaw;
    mixer.update(dt);
    // kök yörüngesi (gerçek hareket klibi)
    if(V.rm){ const r=V.rm, a=r.a;
      if(V.cur!==a){ endRM(); }
      else { const m=r.m, T=m.traj; const fi=Math.min(m.n-1, Math.max(0,a.time*m.fps)); const i=Math.floor(fi), k=fi-i, j=Math.min(m.n-1,i+1);
        let x=T[i*3]+(T[j*3]-T[i*3])*k, z=T[i*3+1]+(T[j*3+1]-T[i*3+1])*k, y=T[i*3+2]+(T[j*3+2]-T[i*3+2])*k;
        if(r.inPlace){ x=0; z=0; } if(r.lockYaw) y=0;
        const cy=Math.cos(r.anc.yaw), sy=Math.sin(r.anc.yaw);
        let wx=r.anc.x+(x*cy+z*sy)*sc, wz=r.anc.z+(-x*sy+z*cy)*sc, wy=r.anc.yaw+y;
        if(r.k<1){ r.k=Math.min(1,r.k+dt/r.fade); const b=r.k*r.k*(3-2*r.k); wx=r.x0+(wx-r.x0)*b; wz=r.z0+(wz-r.z0)*b; wy=r.y0+wrap(wy-r.y0)*b; }
        holder.position.x=wx; holder.position.z=wz; V.yaw=wy; holder.rotation.y=wy;
        if(!r.loop && a.time>=r.dur-1e-4){ const th=r.then; endRM(); if(th){ V.fixed=false; if(th==='idle') V.idle(.35); else V.play(th,{ fade:.35 }); } }
      } }
    // poz eklemeleri
    if(V.poseW!==V.poseTo){ V.poseW+= (V.poseTo-V.poseW)*Math.min(1,dt*5); if(Math.abs(V.poseW-V.poseTo)<0.01){ V.poseW=V.poseTo; if(V.poseW===0) V.pose=null; } }
    if(V.pose && V.poseW>0){ for(const bn in V.pose){ const b=bones.get(bn); if(!b) continue; for(const [ax,ang] of V.pose[bn]) rot(b,ax,ang*V.poseW); } }
    // başını çevir
    let ly=0, lp=0;
    if(V.look && !V.frozen){ const lp3=(typeof V.look==='function')?V.look(_w):V.look; if(lp3){ V.headPos(_v); const dx=lp3.x-_v.x, dz=lp3.z-_v.z, dy=lp3.y-_v.y; ly=Math.max(-1.15,Math.min(1.15,wrap(Math.atan2(dx,dz)-V.yaw))); lp=Math.max(-0.45,Math.min(0.5,Math.atan2(dy,Math.hypot(dx,dz)))); } }
    V.lookYaw+=(ly-V.lookYaw)*Math.min(1,dt*5); V.lookPitch+=(lp-V.lookPitch)*Math.min(1,dt*5);
    if(Math.abs(V.lookYaw)>0.002 || Math.abs(V.lookPitch)>0.002){ const nb=bones.get('neck_01'), hb=bones.get('Head');
      rot(nb,HEAD_YAW,V.lookYaw*0.4); rot(hb,HEAD_YAW,V.lookYaw*0.6); rot(hb,AX,-V.lookPitch*0.8); }
    // tekme
    if(V.kickT>0){ V.kickT+=dt/0.6; const k=Math.sin(Math.min(1,V.kickT)*Math.PI); const th=bones.get('thigh_r'), ca=bones.get('calf_r'), sp=bones.get('spine_01');
      rot(th,AX,1.5*k); rot(ca,AX,-1.1*k*(1-Math.min(1,V.kickT)*0.6)); rot(sp,AX,-0.22*k); if(V.kickT>=1) V.kickT=0; }
    // sahne değiştiricileri (çırpınma, eğilme…)
    for(const fn of V.mods) fn(dt,rot,bones,V);
    // el hedefleri
    let needIK=false; for(const sd in V.ik){ const o=V.ik[sd]; o.w+=(o.wTo-o.w)*Math.min(1,dt*o.rate); if(o.wTo===0 && o.w<0.01){ delete V.ik[sd]; continue; } needIK=true; }
    if(needIK){ holder.updateMatrixWorld(true); for(const sd in V.ik) solveArm(sd,V.ik[sd]); }
    if(V.afterUpdate) V.afterUpdate(dt);
  };
  /* ---- iki kemikli kol IK ---- */
  const _S=new THREE.Vector3(), _E=new THREE.Vector3(), _H=new THREE.Vector3(), _T=new THREE.Vector3(), _P=new THREE.Vector3(), _D=new THREE.Vector3(), _E2=new THREE.Vector3(), _v1=new THREE.Vector3(), _v2=new THREE.Vector3();
  const _qd=new THREE.Quaternion(), _qw=new THREE.Quaternion(), _qp=new THREE.Quaternion(), _qi=new THREE.Quaternion();
  const setQ=(b,q)=>{ if(!touched.has(b)){ let o=orig.get(b); if(!o){ o=new THREE.Quaternion(); orig.set(b,o); } o.copy(b.quaternion); touched.add(b); } b.quaternion.copy(q); };
  function turnBone(b,from,to,w){ _qd.setFromUnitVectors(from,to); if(w<0.999) _qd.slerp(_qi.identity(),1-w); b.getWorldQuaternion(_qw); b.parent.getWorldQuaternion(_qp);
    _qw.premultiply(_qd); _qp.invert().multiply(_qw); setQ(b,_qp); b.updateMatrixWorld(true); }
  function solveArm(sd,o){
    const ua=bones.get('upperarm_'+sd), la=bones.get('lowerarm_'+sd), ha=bones.get('hand_'+sd); if(!ua||!la||!ha) return;
    const T=o.target(_T); if(!T) return;
    ua.getWorldPosition(_S); la.getWorldPosition(_E); ha.getWorldPosition(_H);
    const a=_S.distanceTo(_E), b=_E.distanceTo(_H); _D.subVectors(T,_S); let c=_D.length(); if(c<1e-4) return; _D.divideScalar(c); c=Math.max(Math.abs(a-b)+1e-3,Math.min(a+b-1e-3,c));
    if(o.pole){ o.pole(_P); _P.sub(_S); } else _P.subVectors(_E,_S);
    _P.addScaledVector(_D,-_P.dot(_D)); if(_P.lengthSq()<1e-8){ _P.set(0,-1,0).addScaledVector(_D,_D.y); } _P.normalize();
    const ca=(a*a+c*c-b*b)/(2*a*c), sa=Math.sqrt(Math.max(0,1-ca*ca));
    _E2.copy(_S).addScaledVector(_D,a*ca).addScaledVector(_P,a*sa);
    turnBone(ua,_v1.subVectors(_E,_S).normalize(),_v2.subVectors(_E2,_S).normalize(),o.w);
    la.getWorldPosition(_E); ha.getWorldPosition(_H);
    _v2.copy(_S).addScaledVector(_D,c); // ulaşılabilir hedef
    turnBone(la,_v1.subVectors(_H,_E).normalize(),_v2.sub(_E).normalize(),o.w);
  }
  V.play(V.idleClip); mixer.update(Math.random()*4);
  return V;
}
/** başı sağa-sola çeviren yerel eksen (iskelete göre) */
export let HEAD_YAW=AY;
export function setHeadYawAxis(ax){ HEAD_YAW=ax; }
