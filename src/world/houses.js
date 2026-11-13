/* =====================================================================
   3B ANADOLU KÖY EVLERİ — prosedürel, gerçek PBR dokulu
   Yerel eksen: cephe +Z'ye bakar, taban merkezi orijinde.
   ===================================================================== */
import * as THREE from 'three';

/** Kutuya yüz boyutuna göre UV ölçekle (tek malzeme, tekrar eden doku) */
export function uvBox(w, h, d, tile=1.5){
  const g=new THREE.BoxGeometry(w,h,d); const uv=g.attributes.uv;
  // yüz sırası: px, nx, py, ny, pz, nz (her biri 4 köşe)
  const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++) for(let i=0;i<4;i++){ const k=f*4+i; uv.setXY(k, uv.getX(k)*dims[f][0]/tile, uv.getY(k)*dims[f][1]/tile); }
  uv.needsUpdate=true; return g;
}
function scaleUV(g, s){ const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*s, uv.getY(i)*s); uv.needsUpdate=true; return g; }
const mesh=(g,m,cast=true,recv=true)=>{ const o=new THREE.Mesh(g,m); o.castShadow=cast; o.receiveShadow=recv; return o; };

/** Kırma (dört eğimli) çatı */
function hipRoofGeometry(a, b, h, tile){
  const ridge = Math.max(0.15, a-b);
  const A=[-a,0,b], B=[a,0,b], C=[a,0,-b], Dd=[-a,0,-b], R1=[-ridge,h,0], R2=[ridge,h,0];
  const faces=[[A,B,R2,R1],[C,Dd,R1,R2],[B,C,R2],[Dd,A,R1]];
  const pos=[], uv=[];
  for(const f of faces){
    const p0=new THREE.Vector3(...f[0]), p1=new THREE.Vector3(...f[1]); const ex=p1.clone().sub(p0).normalize();
    const n=new THREE.Vector3().subVectors(new THREE.Vector3(...f[2]),p0).cross(ex).normalize().negate(); const ey=n.clone().cross(ex).normalize();
    const U=(v)=>{ const d=new THREE.Vector3(...v).sub(p0); return [d.dot(ex)/tile, d.dot(ey)/tile]; };
    const tris = f.length===4 ? [[0,1,2],[0,2,3]] : [[0,1,2]];
    for(const t of tris) for(const i of t){ pos.push(...f[i]); uv.push(...U(f[i])); }
  }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.computeVertexNormals(); return g;
}
/** Beşik (iki eğimli) çatı: sırt X ekseninde */
function gableRoofGeometry(a, b, h){
  const s=new THREE.Shape(); s.moveTo(-b,0); s.lineTo(0,h); s.lineTo(b,0); s.lineTo(-b,0);
  const g=new THREE.ExtrudeGeometry(s,{ depth:a*2, bevelEnabled:false });
  g.rotateY(Math.PI/2); g.translate(-a,0,0); return g;
}

export const HOUSE_TYPES = [
  { name:'Taş damlı ev',  W:5.6, D:4.6, H:2.7, wall:'stone',  roof:'flat',  wins:[-1.55,1.55], door:-0.1, extras:['firewood','peppers','roller'] },
  { name:'Cumbalı konak', W:6.2, D:5.0, H:2.6, wall:'stone',  upper:'white', H2:2.5, cumba:true, roof:'hip', wins:[-1.9,1.9], door:0, extras:['peppers'] },
  { name:'Kerpiç ev',     W:5.8, D:4.6, H:2.8, wall:'adobe',  roof:'gable', wins:[-1.6,1.6], door:0, extras:['pots','bench'] },
  { name:'Taş kiremitli', W:5.4, D:4.4, H:2.9, wall:'stone2', roof:'gable', wins:[-1.5,1.45], door:-0.05, shutters:true, extras:['hay'] },
  { name:'İki katlı ev',  W:6.4, D:5.0, H:2.6, wall:'plstone',upper:'white', H2:2.4, balcony:true, roof:'hip', wins:[-1.95,1.85], door:-0.1, shutters:true, extras:['firewood'] },
  { name:'Ahırlı ev',     W:6.0, D:4.6, H:2.6, wall:'adobe',  roof:'flat',  wins:[1.7], door:-1.1, barn:true, extras:['ladder','cart'] },
];

/**
 * M: paylaşılan malzemeler. Dönüş: { group, door, windows, chimneyTop, ribbonAt, plaqueAt, hit, setLights(v), setMourning(on) }
 */
export function buildHouse(type, M, seed=1){
  const T=HOUSE_TYPES[type%HOUSE_TYPES.length]; const rnd=mulberry(seed*31+type);
  const g=new THREE.Group(); g.name='house';
  // her eve kendi duvar malzemesi (yasta kararabilsin)
  const own=(m)=>{ const c=m.clone(); c.userData.base=m.color.clone(); return c; };
  const wallM=own(M[T.wall]), upperM=T.upper?own(M[T.upper]):null, roofM=own(M.roof), woodM=own(M.beam), doorM=own(M.door), mudM=own(M.mud);
  const mats=[wallM,upperM,roofM,woodM,doorM,mudM].filter(Boolean);
  const W=T.W, D=T.D, H=T.H, H2=T.H2||0, top=H+H2;

  // taş temel
  const plinth=mesh(uvBox(W+0.16,0.42,D+0.16,1.2), M.stone); plinth.position.y=0.21; g.add(plinth);
  // duvarlar
  const lower=mesh(uvBox(W,H,D,T.wall==='adobe'?2.2:1.6), wallM); lower.position.y=H/2; g.add(lower);
  if(T.upper){ const up=mesh(uvBox(W+0.12,H2,D+0.12,2.2), upperM); up.position.y=H+H2/2; g.add(up);
    // bağdadi ahşap iskelet
    const fr=new THREE.Group(); const bw=0.11;
    const beamX=(y)=>{ const b=mesh(uvBox(W+0.2,bw*1.4,bw,1), woodM); b.position.set(0,y,D/2+0.07); fr.add(b); };
    beamX(H+0.02); beamX(top-0.05);
    const n=8; for(let i=0;i<=n;i++){ const x=-W/2+i*W/n; if(T.cumba && Math.abs(x)<1.3) continue; const p=mesh(uvBox(bw,H2,bw,1), woodM); p.position.set(x,H+H2/2,D/2+0.07); fr.add(p); }
    for(const i of [0,2,5,7]){ const x0=-W/2+i*W/n+W/n/2; if(T.cumba && Math.abs(x0)<1.6) continue; const b=mesh(uvBox(bw*0.8,Math.hypot(W/n,H2)*0.98,bw*0.8,1), woodM); b.position.set(x0,H+H2/2,D/2+0.07); b.rotation.z=Math.atan2(W/n,H2)*(i%2?1:-1); fr.add(b); }
    // yanlarda da kiriş
    for(const s of [-1,1]){ const b=mesh(uvBox(bw,bw*1.4,D+0.2,1), woodM); b.position.set(s*(W/2+0.07),H+0.02,0); fr.add(b); }
    g.add(fr);
  }
  // köşe taşları / ahşap dikmeler (tek katlılarda)
  if(!T.upper){ for(const sx of [-1,1]){ const c=mesh(uvBox(0.22,H,0.22,1), T.wall==='adobe'?woodM:M.stone2); c.position.set(sx*(W/2-0.02),H/2,D/2-0.02); g.add(c); } }
  // kapı
  const dw=T.barn?1.7:1.0, dh=T.barn?2.2:1.95;
  // kapı menteşede döner (dışarı açılır); arkasında karanlık iç mekân
  const doorway=new THREE.Mesh(new THREE.PlaneGeometry(dw-0.04,dh-0.02), M.doorway); doorway.position.set(T.door,dh/2+0.05,D/2+0.006); g.add(doorway);
  const doorPivot=new THREE.Group(); doorPivot.position.set(T.door-dw/2,0,D/2+0.05); g.add(doorPivot);
  const door=mesh(uvBox(dw,dh,0.1,1.2), doorM); door.position.set(dw/2,dh/2+0.05,0); doorPivot.add(door);
  const lintel=mesh(uvBox(dw+0.36,0.22,0.26,1), T.wall==='adobe'?woodM:M.stone2); lintel.position.set(T.door,dh+0.16,D/2+0.06); g.add(lintel);
  const step=mesh(uvBox(dw+0.5,0.16,0.55,1), M.stone2); step.position.set(T.door,0.08,D/2+0.28); g.add(step);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.012,6,14), M.iron); ring.position.set(dw*0.8,dh*0.5,0.07); doorPivot.add(ring);
  if(T.barn){ for(const s of [-1,1]){ const x=mesh(uvBox(0.09,Math.hypot(dw/2,dh)*0.95,0.04,1), woodM); x.position.set(dw/2+s*dw/4,dh/2+0.05,0.06); x.rotation.z=s*Math.atan2(dw/2,dh); doorPivot.add(x); } }
  // pencereler
  const windows=[];
  const addWin=(x,y,ww,wh,z=D/2, shutters=false)=>{
    const frame=mesh(uvBox(ww+0.16,wh+0.16,0.1,1), woodM); frame.position.set(x,y,z+0.03); g.add(frame);
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(ww,wh), M.glassDark); glass.position.set(x,y,z+0.085); g.add(glass); windows.push(glass);
    const mv=mesh(new THREE.BoxGeometry(0.045,wh,0.03), woodM,false); mv.position.set(x,y,z+0.1); g.add(mv);
    const mh=mesh(new THREE.BoxGeometry(ww,0.045,0.03), woodM,false); mh.position.set(x,y+wh*0.08,z+0.1); g.add(mh);
    const sill=mesh(uvBox(ww+0.3,0.07,0.22,1), M.stone2); sill.position.set(x,y-wh/2-0.1,z+0.1); g.add(sill);
    if(shutters){ for(const s of [-1,1]){ const sh=mesh(uvBox(ww/2,wh,0.04,1), woodM); const piv=new THREE.Group(); piv.position.set(x+s*(ww/2+0.08),y,z+0.1); sh.position.x=s*ww/4; piv.add(sh); piv.rotation.y=s*1.9; g.add(piv); } }
  };
  for(const wx of T.wins) addWin(wx, 1.55, 0.72, 0.82, D/2, T.shutters);
  if(T.upper && !T.cumba) for(const wx of [-2.2,-0.75,0.75,2.2]) addWin(wx, H+H2*0.52, 0.6, 0.78, D/2+0.06, T.shutters);
  if(T.cumba){ // çıkma
    const cw=2.6, ch=H2*0.82, cp=0.7; const cz=D/2+cp/2;
    const box=mesh(uvBox(cw,ch,cp,2), upperM); box.position.set(0,H+0.18+ch/2,cz); g.add(box);
    for(let i=0;i<3;i++) addWin(-0.82+i*0.82, H+0.18+ch*0.55, 0.52, ch*0.52, D/2+cp, false);
    for(const sx of [-1.1,0,1.1]){ const br=mesh(uvBox(0.1,0.5,cp,1), woodM); br.position.set(sx,H-0.05,cz); br.rotation.x=0.5; g.add(br); }
    const croof=mesh(uvBox(cw+0.3,0.12,cp+0.3,1), roofM); croof.position.set(0,H+0.18+ch+0.06,cz+0.05); croof.rotation.x=0.18; g.add(croof);
    for(const wx of [-2.4,2.4]) addWin(wx, H+H2*0.52, 0.55, 0.72, D/2+0.06, false);
  }
  if(T.balcony){ const by=H+0.05; const deck=mesh(uvBox(W*0.55,0.12,0.9,1), woodM); deck.position.set(0,by,D/2+0.45); g.add(deck);
    const rail=mesh(uvBox(W*0.55,0.07,0.07,1), woodM); rail.position.set(0,by+0.95,D/2+0.88); g.add(rail);
    for(let i=0;i<=12;i++){ const p=mesh(new THREE.BoxGeometry(0.05,0.95,0.05), woodM); p.position.set(-W*0.275+i*W*0.55/12,by+0.47,D/2+0.88); g.add(p); }
    const bdoor=mesh(uvBox(0.9,1.8,0.08,1.2), doorM); bdoor.position.set(0,H+0.95,D/2+0.1); g.add(bdoor); }
  // çatı
  let chimneyBase;
  if(T.roof==='flat'){
    const slab=mesh(uvBox(W+0.3,0.28,D+0.3,1.5), woodM); slab.position.y=top+0.14; g.add(slab);
    const earth=mesh(scaleUV(new THREE.BoxGeometry(W+0.26,0.12,D+0.26),1), mudM); earth.position.y=top+0.34; g.add(earth);
    for(let i=0;i<14;i++){ const b=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.085,0.42,8), woodM); b.rotation.x=Math.PI/2; b.position.set(-W/2+0.25+i*(W-0.5)/13, top+0.06, D/2+0.2); b.castShadow=true; g.add(b); }
    for(const [x,z,w,d] of [[0,D/2+0.1,W+0.3,0.12],[0,-D/2-0.1,W+0.3,0.12],[W/2+0.1,0,0.12,D+0.3],[-W/2-0.1,0,0.12,D+0.3]]){ const p=mesh(uvBox(w,0.22,d,1), mudM); p.position.set(x,top+0.45,z); g.add(p); }
    chimneyBase=new THREE.Vector3(-W*0.25,top+0.4,-D*0.15);
    if(T.extras.includes('roller')){ const r=new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.24,0.95,14), M.stone2); r.rotation.z=Math.PI/2; r.position.set(W*0.18,top+0.64,D*0.1); r.castShadow=true; g.add(r); }
  } else if(T.roof==='gable'){
    const ov=0.42, Hr=W*0.3; const a=W/2+ov, b=D/2+ov;
    const rg=gableRoofGeometry(a,b,Hr); scaleUV(rg,1/1.6);
    const roof=new THREE.Mesh(rg,[wallM,roofM]); roof.position.y=top; roof.castShadow=true; roof.receiveShadow=true; g.add(roof);
    const eave=mesh(uvBox(W+ov*2,0.12,0.12,1), woodM); eave.position.set(0,top-0.02,b); g.add(eave);
    chimneyBase=new THREE.Vector3(W*0.24,top+Hr*0.55,-D*0.12);
  } else {
    const ov=0.45, Hr=W*0.24; const rg=hipRoofGeometry(W/2+ov,D/2+ov,Hr,1.6);
    const roof=mesh(rg,roofM); roof.material.side=THREE.DoubleSide; roof.position.y=top; g.add(roof);
    chimneyBase=new THREE.Vector3(-W*0.22,top+Hr*0.45,-D*0.05);
  }
  const ch=mesh(uvBox(0.5,1.25,0.5,0.8), M.stone2); ch.position.copy(chimneyBase).add(new THREE.Vector3(0,0.5,0)); g.add(ch);
  const cap=mesh(uvBox(0.66,0.1,0.66,0.8), M.stone2); cap.position.copy(ch.position).add(new THREE.Vector3(0,0.67,0)); g.add(cap);
  const chimneyTop=ch.position.clone().add(new THREE.Vector3(0,0.75,0));
  // eklentiler
  for(const e of T.extras){
    if(e==='firewood'){ const fw=new THREE.Group(); for(let r=0;r<4;r++) for(let i=0;i<6-r;i++){ const l=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.9,8), woodM); l.rotation.x=Math.PI/2; l.position.set(-0.55+i*0.21+r*0.105, 0.1+r*0.18, 0); l.castShadow=true; fw.add(l); } fw.position.set(W/2+0.75,0,D*0.15); fw.rotation.y=Math.PI/2; g.add(fw); }
    if(e==='peppers'){ const pm=M.pepper; const x=T.door+0.82; for(let i=0;i<12;i++){ const p=new THREE.Mesh(new THREE.CapsuleGeometry(0.035,0.1,3,6), pm); p.position.set(x+(i%2?0.03:-0.03),1.9-i*0.085,D/2+0.12); p.rotation.z=(i%2?.3:-.3); g.add(p); } }
    if(e==='pots'){ for(const [px,s] of [[-W/2+0.5,1],[-W/2+0.95,0.8]]){ const pts=[]; for(let i=0;i<=10;i++){ const t=i/10; pts.push(new THREE.Vector2((0.05+Math.sin(t*Math.PI)*0.3)*s, t*0.75*s)); } const p=new THREE.Mesh(new THREE.LatheGeometry(pts,14), M.clay); p.position.set(px,0,D/2+0.35); p.castShadow=true; g.add(p); } }
    if(e==='bench'){ const b=mesh(uvBox(1.5,0.08,0.4,1), woodM); b.position.set(W*0.28,0.45,D/2+0.4); g.add(b); for(const s of [-1,1]){ const l=mesh(uvBox(0.08,0.45,0.35,1), woodM); l.position.set(W*0.28+s*0.6,0.22,D/2+0.4); g.add(l); } }
    if(e==='hay'){ const h=new THREE.Mesh(new THREE.SphereGeometry(1.0,14,10,0,Math.PI*2,0,Math.PI/2), M.hay); h.scale.set(1,0.75,1); h.position.set(W/2+1.0,0,D*0.1); h.castShadow=true; h.receiveShadow=true; g.add(h); }
    if(e==='ladder'){ const L=new THREE.Group(); for(const s of [-1,1]){ const r=mesh(uvBox(0.07,top+0.6,0.07,1), woodM); r.position.set(s*0.22,(top+0.6)/2,0); L.add(r); } for(let i=1;i<10;i++){ const r=mesh(new THREE.BoxGeometry(0.44,0.05,0.05), woodM); r.position.y=i*(top+0.6)/10; L.add(r); } L.position.set(W*0.2,0,D/2+0.35); L.rotation.x=-0.18; g.add(L); }
    if(e==='cart'){ const w=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.06,6,18), woodM); w.position.set(-W/2-0.5,0.55,D*0.2); w.rotation.y=1.2; w.castShadow=true; g.add(w); for(let i=0;i<6;i++){ const sp=mesh(new THREE.BoxGeometry(0.04,1.1,0.04), woodM); sp.rotation.z=i/6*Math.PI; w.add(sp); } }
  }
  // seçme için görünmez kutu
  const hit=new THREE.Mesh(new THREE.BoxGeometry(W+0.6, top+1.6, D+0.8), new THREE.MeshBasicMaterial({ visible:false })); hit.position.y=(top+1.6)/2; g.add(hit);
  const doorPos=new THREE.Vector3(T.door,0,D/2+0.9);
  const ribbonAt=new THREE.Vector3(T.door, dh+0.42, D/2+0.2);
  const plaqueAt=new THREE.Vector3(T.door, dh+0.7, D/2+0.2);
  let mourning=0;
  return {
    group:g, type:T, windows, chimneyTop, doorPos, ribbonAt, plaqueAt, hit, width:W, depth:D, height:top, doorPivot, doorway, mats,
    setLights(level){ for(const w of windows) w.material = level>0.05 ? M.glassLit : M.glassDark; },
    setMourning(v){ mourning=v; for(const m of mats){ if(!m.userData.base) continue; m.color.copy(m.userData.base).multiplyScalar(1-0.55*v); } },
  };
}
function mulberry(seed){ let a=(seed>>>0)||1; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/** Siyah yas kurdelesi (fiyonk + kuyruklar) */
export function buildRibbon(){
  const m=new THREE.MeshStandardMaterial({ color:0x060608, roughness:0.28, metalness:0.15, side:THREE.DoubleSide });
  const g=new THREE.Group();
  for(const s of [-1,1]){ const loop=new THREE.Mesh(new THREE.TorusGeometry(0.11,0.035,8,18), m); loop.scale.set(1.25,0.75,0.35); loop.position.x=s*0.12; g.add(loop);
    const tail=new THREE.Mesh(new THREE.PlaneGeometry(0.07,0.42,1,6), m); const p=tail.geometry.attributes.position; for(let i=0;i<p.count;i++){ const y=p.getY(i); p.setZ(i, Math.sin((y+0.21)*6)*0.02); } p.needsUpdate=true; tail.geometry.computeVertexNormals(); tail.position.set(s*0.05,-0.24,0.01); tail.rotation.z=s*0.18; g.add(tail); }
  const knot=new THREE.Mesh(new THREE.SphereGeometry(0.045,10,8), m); knot.scale.set(1,1.2,0.6); g.add(knot);
  g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  return g;
}
