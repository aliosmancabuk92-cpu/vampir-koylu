/* =====================================================================
   VAMPİR KÖYLÜ — 3B KÖY DÜNYASI
   Gökyüzü + ışık evreleri (gündüz/akşam/gece/şafak/kıyamet), zemin,
   Anadolu evleri halkası, meydan, çeşme, dar ağacı, kazıklar, meşaleler,
   ağaçlar, tepeler, parçacıklar (kıvılcım, ateş böceği, baca dumanı),
   sinematik kamera, ekrandaki etiketler, dokunarak seçme, kalite ayarı.
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildHouse, buildRibbon, HOUSE_TYPES, uvBox } from './houses.js';

/* ---------------- kalite ---------------- */
export const QUALITY = {
  high:   { dpr:2,   shadow:2048, bloom:true,  msaa:4, torchLights:4, aniso:8, particles:1,   env:true,  label:'Yüksek' },
  medium: { dpr:1.5, shadow:1024, bloom:false, msaa:0, torchLights:2, aniso:4, particles:.6,  env:true,  label:'Orta' },
  low:    { dpr:1,   shadow:0,    bloom:false, msaa:0, torchLights:1, aniso:1, particles:.3,  env:false, label:'Düşük' },
};
export function webglOK(){ try{ const c=document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2')||c.getContext('webgl'))); }catch(e){ return false; } }
export function detectQuality(){
  let saved=null; try{ saved=localStorage.getItem('vk_quality'); }catch(e){}
  if(saved && QUALITY[saved]) return saved;
  let gpu='';
  try{ const c=document.createElement('canvas'); const gl=c.getContext('webgl2')||c.getContext('webgl'); const ext=gl&&gl.getExtension('WEBGL_debug_renderer_info'); if(ext) gpu=String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)||''); const lose=gl&&gl.getExtension('WEBGL_lose_context'); lose&&lose.loseContext(); }catch(e){}
  const mem=navigator.deviceMemory||4, cores=navigator.hardwareConcurrency||4;
  if(/SwiftShader|llvmpipe|Software|Mali-[4T]|Adreno \(TM\) [345]\d\d|PowerVR|GE8/i.test(gpu) || mem<=2) return 'low';
  if(/Apple/i.test(gpu)) return 'high';
  if(mem<4 || cores<=4 || /Mali-G(5\d|6[0-8])\b|Adreno \(TM\) 6[0-3]\d/i.test(gpu)) return 'medium';
  return 'high';
}

/* ---------------- ışık evreleri ---------------- */
export const PHASES = {
  day:    { top:'#4a78b8', mid:'#8fb1d6', hor:'#e6d2ae', glow:'#ffd9a0', glowAmt:.75, cel:'#fff4dc', celDir:[-.85,.42,.12], celSize:.024, moon:0, stars:0,   cloud:.38, cloudCol:'#f4e9dc',
            sunDir:[-.85,.48,.12], sunCol:'#ffe0b4', sunI:2.5, hemiS:'#b7cbe8', hemiG:'#6e5a3c', hemiI:.85, fog:'#cdbfa6', fogD:.0085, exp:1.0,  torch:0,   win:0,  env:.5,  smoke:.55, fire:0 },
  dusk:   { top:'#1c2452', mid:'#6b4f80', hor:'#f39552', glow:'#ff9a55', glowAmt:1.15,cel:'#ffd2a0', celDir:[-.86,.06,-.5], celSize:.034, moon:0, stars:.25, cloud:.5,  cloudCol:'#7a5a78',
            sunDir:[-.86,.2,-.48], sunCol:'#ff9c5c', sunI:1.8, hemiS:'#7d78b0', hemiG:'#3a2620', hemiI:.6,  fog:'#7d5a6a', fogD:.012,  exp:1.06, torch:1,   win:1,  env:.4,  smoke:.7,  fire:.6 },
  night:  { top:'#02040b', mid:'#0a1230', hor:'#232642', glow:'#8a9cd8', glowAmt:.6,  cel:'#f3ecd6', celDir:[-.36,.26,-.9], celSize:.05,  moon:1, stars:1,   cloud:.28, cloudCol:'#141a30',
            sunDir:[-.72,.6,-.25], sunCol:'#a8b9ff', sunI:1.05, hemiS:'#34437a', hemiG:'#120d08', hemiI:.55, fog:'#0c1124', fogD:.02,   exp:1.14, torch:1,   win:1,  env:.25, smoke:.6,  fire:1 },
  dawn:   { top:'#2a3a6a', mid:'#a78ba8', hor:'#ffbe8e', glow:'#ffc79a', glowAmt:.95, cel:'#ffe6c8', celDir:[.82,.08,-.55], celSize:.032, moon:0, stars:.08, cloud:.42, cloudCol:'#c9a2a8',
            sunDir:[.82,.22,-.55], sunCol:'#ffbf8a', sunI:1.55, hemiS:'#9097c2', hemiG:'#4c3c34', hemiI:.7,  fog:'#b39aa0', fogD:.011,  exp:1.0,  torch:.3,  win:.35,env:.45, smoke:.5,  fire:.2 },
  doom:   { top:'#0e0205', mid:'#3d0b14', hor:'#8a1f1a', glow:'#ff3a2a', glowAmt:1.0, cel:'#ff6a48', celDir:[-.36,.26,-.9], celSize:.06,  moon:1, stars:.45, cloud:.45, cloudCol:'#2a0508',
            sunDir:[-.6,.55,-.4], sunCol:'#ff5a4a', sunI:1.35, hemiS:'#5a1a28', hemiG:'#160404', hemiI:.55, fog:'#2a0609', fogD:.02,   exp:1.14, torch:1,   win:0,  env:.3,  smoke:.4,  fire:1 },
  festive:{ top:'#3f7cc4', mid:'#9cc2e6', hor:'#f2dcb4', glow:'#ffe2a8', glowAmt:.8,  cel:'#fff6e0', celDir:[-.5,.62,.4], celSize:.024, moon:0, stars:0,   cloud:.22, cloudCol:'#fbf3e8',
            sunDir:[-.5,.62,.4], sunCol:'#fff0d0', sunI:2.7, hemiS:'#c2d6f0', hemiG:'#7a6440', hemiI:.95, fog:'#d8ccb2', fogD:.007,  exp:1.03, torch:0,   win:0,  env:.55, smoke:.5,  fire:0 },
};
const COLOR_KEYS=['top','mid','hor','glow','cel','cloudCol','sunCol','hemiS','hemiG','fog'];
const NUM_KEYS=['glowAmt','celSize','moon','stars','cloud','sunI','hemiI','fogD','exp','torch','win','env','smoke','fire'];
const VEC_KEYS=['celDir','sunDir'];
function phaseState(p){ const s={}; for(const k of COLOR_KEYS) s[k]=new THREE.Color(p[k]); for(const k of NUM_KEYS) s[k]=p[k]; for(const k of VEC_KEYS) s[k]=new THREE.Vector3(...p[k]).normalize(); return s; }
function lerpPhase(out,a,b,t){ for(const k of COLOR_KEYS) out[k].copy(a[k]).lerp(b[k],t); for(const k of NUM_KEYS) out[k]=a[k]+(b[k]-a[k])*t; for(const k of VEC_KEYS) out[k].copy(a[k]).lerp(b[k],t).normalize(); }

/* ---------------- yerleşim sabitleri ---------------- */
export const LAYOUT = {
  SQ_R: 9.6,                              // meydan yarıçapı
  GALLOWS: { x:-5.7, z:-4.9, rot:0.33 },  // dar ağacı
  STAKES:  { x: 5.7, z:-4.9, rot:-0.33 }, // kazıklar
  FOUNTAIN:{ x: 0,   z:-9.2 },
  ACCUSED: { x: 0,   z: 1.2 },            // sanığın durduğu yer
  CROWD_R: 4.6,
};

/* ---------------- yardımcılar ---------------- */
const rngOf=(seed)=>{ let a=seed>>>0||1; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };
const smooth=(t)=>t*t*(3-2*t);
const ease={ inOut:(t)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, out:(t)=>1-Math.pow(1-t,3), in:(t)=>t*t*t, lin:(t)=>t, sine:(t)=>-(Math.cos(Math.PI*t)-1)/2 };
function canvasTex(w,h,draw,srgb=true){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); if(srgb) t.colorSpace=THREE.SRGBColorSpace; return t; }
function softDot(){ return canvasTex(64,64,(x)=>{ const g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.3,'rgba(255,255,255,.6)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); }); }
function puffTex(){ return canvasTex(128,128,(x)=>{ const r=rngOf(7); for(let i=0;i<14;i++){ const cx=40+r()*48, cy=40+r()*48, rr=18+r()*26; const g=x.createRadialGradient(cx,cy,0,cx,cy,rr); g.addColorStop(0,'rgba(255,255,255,.35)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,128,128); } }); }
function flameTex(){ return canvasTex(64,128,(x,w,h)=>{ const g=x.createRadialGradient(32,92,2,32,80,58); g.addColorStop(0,'rgba(255,250,220,1)'); g.addColorStop(.25,'rgba(255,200,90,.95)'); g.addColorStop(.55,'rgba(255,110,30,.55)'); g.addColorStop(1,'rgba(200,40,10,0)'); x.fillStyle=g; x.beginPath(); x.moveTo(32,4); x.bezierCurveTo(58,52,60,96,32,124); x.bezierCurveTo(4,96,6,52,32,4); x.fill(); }); }

/** Sabit (hareketsiz) parçaları malzemeye göre birleştir → çok daha az çizim çağrısı */
export function bakeStatic(root, skip=new Set()){
  root.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets=new Map(); const remove=[];
  root.traverse(o=>{
    if(!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) return;
    for(let p=o; p && p!==root; p=p.parent) if(skip.has(p)) return;
    if(Array.isArray(o.material) || o.material.visible===false || o.userData.keep) return;
    let g=o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    if(!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    if(!g.attributes.normal) g.computeVertexNormals();
    for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal'&&k!=='uv') g.deleteAttribute(k);
    g.clearGroups();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key=o.material.uuid+(o.castShadow?'|s':'|n')+(o.receiveShadow?'r':'');
    if(!buckets.has(key)) buckets.set(key,{ mat:o.material, cast:o.castShadow, recv:o.receiveShadow, geos:[] });
    buckets.get(key).geos.push(g); remove.push(o);
  });
  for(const o of remove) o.removeFromParent();
  const out=[];
  for(const b of buckets.values()){ const mg=mergeGeometries(b.geos,false); if(!mg) continue; const m=new THREE.Mesh(mg,b.mat); m.castShadow=b.cast; m.receiveShadow=true; m.matrixAutoUpdate=false; root.add(m); out.push(m); b.geos.forEach(g=>g.dispose()); }
  return out;
}

/* ===================================================================== */
export async function createWorld(container, { base='./assets/3d/', quality=detectQuality(), onProgress=null, debug=false, maxDt=0.05 }={}){
  let Q={ ...(QUALITY[quality]||QUALITY.medium) }; let qName=QUALITY[quality]?quality:'medium';
  container.classList.add('w3d');
  const canvas=document.createElement('canvas'); canvas.className='w3d-canvas'; container.appendChild(canvas);
  const overlay=document.createElement('div'); overlay.className='w3d-ov'; container.appendChild(overlay);

  const renderer=new THREE.WebGLRenderer({ canvas, antialias:!Q.bloom && qName!=='low', powerPreference:'high-performance', stencil:false, preserveDrawingBuffer:debug });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, Q.dpr));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=Q.shadow>0; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const maxAniso=Math.min(Q.aniso, renderer.capabilities.getMaxAnisotropy());

  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x0b1022, 0.02);
  const camera=new THREE.PerspectiveCamera(50, 1, 0.1, 600);
  camera.position.set(0,6,16);

  /* ---------- yükleme yöneticisi ---------- */
  const manager=new THREE.LoadingManager();
  let allLoaded=false; manager.onLoad=()=>{ allLoaded=true; };
  manager.onProgress=(_u,done,total)=>{ onProgress&&onProgress(Math.min(0.99,done/Math.max(1,total))); };
  const tl=new THREE.TextureLoader(manager);
  const gltfL=new GLTFLoader(manager); gltfL.setMeshoptDecoder(MeshoptDecoder);
  const texCache=new Map();
  const tex=(name,kind,rep=1)=>{ const key=name+kind+rep; if(texCache.has(key)) return texCache.get(key); const t=tl.load(`${base}tex/${name}_${kind}.jpg`); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep,rep); t.anisotropy=maxAniso; if(kind==='diff') t.colorSpace=THREE.SRGBColorSpace; texCache.set(key,t); return t; };
  const pbr=(name,opts={},rep=1,nScale=1)=>{ const m=new THREE.MeshStandardMaterial({ map:tex(name,'diff',rep), normalMap:tex(name,'nor',rep), roughnessMap:tex(name,'rough',rep), ...opts }); m.normalScale.set(nScale,nScale); return m; };

  /* ---------- malzemeler ---------- */
  const winTex=canvasTex(64,64,(x)=>{ const g=x.createRadialGradient(32,40,4,32,36,40); g.addColorStop(0,'#fff2c8'); g.addColorStop(.5,'#ffb455'); g.addColorStop(1,'#a8501a'); x.fillStyle=g; x.fillRect(0,0,64,64); x.fillStyle='rgba(90,30,10,.55)'; x.fillRect(0,0,13,64); x.fillRect(51,0,13,64); x.fillStyle='rgba(60,20,8,.35)'; x.fillRect(0,0,64,8); });
  const M={
    stone:   pbr('stone',{},1,1),
    stone2:  pbr('stone2',{},1,1),
    adobe:   pbr('wall',{ color:0xf2e2c8 },1,.8),
    plstone: new THREE.MeshStandardMaterial({ color:0xd9d0c2, normalMap:tex('stone2','nor'), roughnessMap:tex('stone2','rough'), roughness:1 }),
    white:   new THREE.MeshStandardMaterial({ color:0xeae3d4, normalMap:tex('wall','nor'), roughnessMap:tex('wall','rough'), roughness:1 }),
    roof:    pbr('roof',{},1,1),
    beam:    pbr('wood',{ color:0xb39a80 },1,1),
    door:    pbr('door',{ color:0xa88a66 },1,1),
    mud:     pbr('mud',{},1,1),
    planks:  pbr('wood',{ color:0xc0a888 },1,1),
    bark:    pbr('beam',{},1,1),
    cobble:  pbr('ground_sq',{},1,1),
    iron:    new THREE.MeshStandardMaterial({ color:0x2a2a2e, metalness:.85, roughness:.45 }),
    rope:    new THREE.MeshStandardMaterial({ color:0x9a8256, roughness:1 }),
    glassDark:new THREE.MeshStandardMaterial({ color:0x0b0d12, roughness:.12, metalness:.1, envMapIntensity:1.6 }),
    glassLit:new THREE.MeshStandardMaterial({ color:0x150a02, emissive:0xffffff, emissiveMap:winTex, emissiveIntensity:2.1, roughness:.35 }),
    doorway: new THREE.MeshStandardMaterial({ color:0x040302, roughness:1 }),
    pepper:  new THREE.MeshStandardMaterial({ color:0x8a1208, roughness:.5 }),
    clay:    new THREE.MeshStandardMaterial({ color:0x9a5a36, roughness:.85 }),
    hay:     new THREE.MeshStandardMaterial({ map:tex('white','diff',1), color:new THREE.Color(1.55,1.25,.62), roughness:1 }),
    blood:   new THREE.MeshStandardMaterial({ color:0x3a0204, roughness:.25, metalness:.1 }),
    flame:   new THREE.SpriteMaterial({ map:flameTex(), color:0xffffff, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, fog:false }),
  };
  const glowMap=softDot();

  /* ---------- gökyüzü ---------- */
  const skyU={ uTop:{value:new THREE.Color()}, uMid:{value:new THREE.Color()}, uHor:{value:new THREE.Color()}, uGlowCol:{value:new THREE.Color()}, uCelCol:{value:new THREE.Color()}, uCelDir:{value:new THREE.Vector3(0,1,0)}, uCloudCol:{value:new THREE.Color()},
    uStars:{value:0}, uGlow:{value:1}, uCelSize:{value:.03}, uMoon:{value:0}, uCloud:{value:.3}, uTime:{value:0} };
  const skyMat=new THREE.ShaderMaterial({ uniforms:skyU, side:THREE.BackSide, depthWrite:false, depthTest:false, fog:false,
    vertexShader:`varying vec3 vDir; void main(){ vDir=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`,
    fragmentShader:`
      uniform vec3 uTop,uMid,uHor,uGlowCol,uCelCol,uCelDir,uCloudCol; uniform float uStars,uGlow,uCelSize,uMoon,uCloud,uTime; varying vec3 vDir;
      float h3(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); float a=h3(vec3(i,1.)), b=h3(vec3(i+vec2(1.,0.),1.)), c=h3(vec3(i+vec2(0.,1.),1.)), d=h3(vec3(i+vec2(1.,1.),1.)); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*n2(p); p=p*2.07+vec2(1.7,9.2); a*=.5; } return s; }
      void main(){
        vec3 d=normalize(vDir); float y=d.y; float hy=max(y,0.);
        vec3 col=mix(uHor,uMid,smoothstep(0.,.32,hy)); col=mix(col,uTop,smoothstep(.3,1.,hy)); col=mix(col,uHor*.5,smoothstep(0.,-.25,y));
        vec3 cd=normalize(uCelDir); float c=max(dot(d,cd),0.);
        col+=uGlowCol*uGlow*(pow(c,4.)*.22+pow(c,24.)*.42+pow(c,220.)*.7);
        if(uStars>.01){ vec3 sp=d*240.; vec3 id=floor(sp); vec3 f=fract(sp)-.5; float r=h3(id);
          float st=step(.983,r)*smoothstep(.42,0.,length(f))*smoothstep(-.02,.22,y); st*=.55+.45*sin(uTime*(1.3+r*4.)+r*60.);
          float band=exp(-pow(dot(d,normalize(vec3(.42,.35,-.84)))*3.,2.)); float mw=band*fbm(d.xz*7.+d.y*3.)*.2*smoothstep(0.,.3,y);
          col+=(vec3(st*(.7+.7*r))+vec3(.55,.6,.85)*mw)*uStars; }
        float ang=acos(clamp(dot(d,cd),-1.,1.)); float disc=smoothstep(uCelSize*1.1,uCelSize,ang);
        if(disc>0.){ vec3 t1=normalize(cross(cd,vec3(0.001,1.,0.))); vec3 t2=cross(cd,t1); vec2 q=vec2(dot(d,t1),dot(d,t2))/uCelSize;
          float cr=fbm(q*2.6+7.)*.55+fbm(q*7.)*.3; vec3 mc=uCelCol*mix(1.3,.55+cr*.75,uMoon); col=mix(col,mc,disc); }
        if(uCloud>.01 && y>-.05){ vec2 cp=d.xz/(y+.16)*1.25+vec2(uTime*.005,uTime*.0018);
          float cl=smoothstep(.48,.88,fbm(cp))*uCloud*smoothstep(-.04,.14,y); vec3 cc=uCloudCol+uGlowCol*pow(c,3.)*.55*uGlow; col=mix(col,cc,cl*.85); }
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(400,48,24), skyMat); sky.frustumCulled=false; sky.renderOrder=-10; scene.add(sky);

  /* ---------- ışıklar ---------- */
  const hemi=new THREE.HemisphereLight(0xffffff,0x000000,.6); scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffffff,1.5); sun.castShadow=Q.shadow>0; scene.add(sun); scene.add(sun.target);
  if(Q.shadow){ sun.shadow.mapSize.set(Q.shadow,Q.shadow); Object.assign(sun.shadow.camera,{ left:-24,right:24,top:24,bottom:-24,near:1,far:120 }); sun.shadow.bias=-0.0005; sun.shadow.normalBias=0.035; sun.shadow.radius=3; }
  const SUN_DIST=60;
  // yakın planlarda yüzleri aydınlatan, kamerayla gezen yumuşak dolgu ışığı
  const fill=new THREE.PointLight(0xffd2a0, 0, 9, 2); scene.add(fill);

  /* ---------- ortam yansıması (gökyüzünden) ---------- */
  let pmrem=null, envRT=null; const envScene=new THREE.Scene(); const envSky=new THREE.Mesh(new THREE.SphereGeometry(10,32,16), skyMat); envScene.add(envSky);
  function updateEnv(){ if(!Q.env) return; try{ pmrem=pmrem||new THREE.PMREMGenerator(renderer); const rt=pmrem.fromScene(envScene,0.02); if(envRT) envRT.dispose(); envRT=rt; scene.environment=rt.texture; }catch(e){ Q.env=false; } }

  /* ---------- zemin ---------- */
  const MASK_R=48; const maskCanvas=document.createElement('canvas'); maskCanvas.width=maskCanvas.height=512;
  const maskTex=new THREE.CanvasTexture(maskCanvas); maskTex.colorSpace=THREE.NoColorSpace;
  const groundMat=new THREE.MeshStandardMaterial({ map:tex('white','diff',1), normalMap:tex('ground','nor',1), roughnessMap:tex('ground','rough',1), color:0xffffff });
  groundMat.onBeforeCompile=(sh)=>{
    sh.uniforms.uDirt={ value:tex('ground','diff',1) }; sh.uniforms.uMask={ value:maskTex }; sh.uniforms.uMaskR={ value:MASK_R };
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vGW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGW=(modelMatrix*vec4(transformed,1.)).xz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D uDirt; uniform sampler2D uMask; uniform float uMaskR; varying vec2 vGW;')
      .replace('#include <map_fragment>',`
        vec4 gGrass=texture2D(map,vMapUv); vec4 gDirt=texture2D(uDirt,vMapUv*.9);
        float gm=texture2D(uMask,vGW/(uMaskR*2.)+.5).r;
        float gn=texture2D(uDirt,vMapUv*.11).g; gm=smoothstep(.32,.68,gm+(gn-.45)*.55);
        vec3 grassC=gGrass.rgb*vec3(1.05,1.0,.72); vec3 dirtC=gDirt.rgb*vec3(1.02,.96,.9);
        diffuseColor.rgb*=mix(grassC,dirtC,gm);`);
  };
  const ground=new THREE.Mesh(new THREE.CircleGeometry(180,96), groundMat); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true;
  { const uv=ground.geometry.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*360/3.2,uv.getY(i)*360/3.2); }
  scene.add(ground);
  // arnavut kaldırımlı meydan
  const sqGeo=new THREE.CircleGeometry(LAYOUT.SQ_R,72); { const uv=sqGeo.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*LAYOUT.SQ_R*2/2.4,uv.getY(i)*LAYOUT.SQ_R*2/2.4); }
  const square=new THREE.Mesh(sqGeo, M.cobble); square.rotation.x=-Math.PI/2; square.position.y=0.025; square.receiveShadow=true; scene.add(square);
  { const curb=new THREE.Group(); const n=84; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; const s=new THREE.Mesh(uvBox(0.72,0.16,0.34,0.8), M.stone); s.position.set(Math.cos(a)*(LAYOUT.SQ_R+0.1),0.07,Math.sin(a)*(LAYOUT.SQ_R+0.1)); s.rotation.y=-a+Math.PI/2; s.castShadow=false; s.receiveShadow=true; curb.add(s); } scene.add(curb); bakeStatic(curb); }

  /* ---------- tepeler ---------- */
  { const segA=220, rings=[[100,0],[118,1],[140,2],[175,3],[230,4]]; const pos=[], col=[], idx=[]; const c=new THREE.Color();
    const nz=(a,f)=>0.5+0.5*(0.5*Math.sin(a*3*f+1.3)+0.28*Math.sin(a*7.1*f+.4)+0.14*Math.sin(a*17.3*f+2.)+0.08*Math.sin(a*41.*f+.7));
    for(const [R,k] of rings) for(let i=0;i<=segA;i++){ const a=i/segA*Math.PI*2; const n=nz(a,1), m=nz(a+1.7,1.6);
      const h = k===0?-1 : k===1? 2+n*5 : k===2? 6+n*12+m*4 : k===3? 10+m*20+n*6 : 2;
      pos.push(Math.cos(a)*R,h,Math.sin(a)*R); c.set(k>=3?0x39402f:0x4a5236).multiplyScalar(0.78+0.3*n); col.push(c.r,c.g,c.b); }
    for(let r=0;r<rings.length-1;r++) for(let i=0;i<segA;i++){ const a=r*(segA+1)+i, b=a+segA+1; idx.push(a,b,a+1, a+1,b,b+1); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals();
    const hills=new THREE.Mesh(g,new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1 })); scene.add(hills); }

  /* ---------- ağaçlar (örneklenmiş) ---------- */
  const treeU={ uTime:{ value:0 } };
  function blob(r,detail,seed,sy=1,base=new THREE.Color(0x3a5a2a)){
    let g=new THREE.IcosahedronGeometry(r,detail); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g=mergeVertices(g);
    const p=g.attributes.position; const v=new THREE.Vector3(); const col=[]; const c=new THREE.Color();
    for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const n=Math.sin(v.x*3.1+seed)*Math.sin(v.y*2.7+seed*1.7)*Math.sin(v.z*3.3+seed*.7); v.multiplyScalar(1+0.2*n+0.08*Math.sin(v.x*9+v.z*7+seed)); v.y*=sy; p.setXYZ(i,v.x,v.y,v.z);
      const shade=0.62+0.42*Math.max(0,(v.y/(r*sy))*0.5+0.5); c.copy(base).multiplyScalar(shade*(0.92+0.16*Math.sin(i*1.7+seed))); col.push(c.r,c.g,c.b); }
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.computeVertexNormals(); return g;
  }
  function trunk(r0,r1,h){ let g=new THREE.CylinderGeometry(r1,r0,h,7,1); g.translate(0,h/2,0); g.deleteAttribute('uv'); const col=[]; const c=new THREE.Color(0x4a3a2c); for(let i=0;i<g.attributes.position.count;i++) col.push(c.r,c.g,c.b); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); return g; }
  const nonIdx=(g)=>g.index?g.toNonIndexed():g;
  const TREE_KINDS=[];
  for(let k=0;k<2;k++){ const parts=[trunk(.14,.09,2.6)]; const b1=blob(1.15,2,k*5+1,3.3,new THREE.Color(0x56772f)); b1.translate(0,4.6,0); parts.push(b1); const b2=blob(.8,1,k*5+3,2.2,new THREE.Color(0x4d6e2c)); b2.translate(.15,7.4,.1); parts.push(b2); TREE_KINDS.push(mergeGeometries(parts.map(nonIdx))); } // kavak
  for(let k=0;k<2;k++){ const parts=[trunk(.26,.16,2.4)]; const r=rngOf(91+k); for(let i=0;i<6;i++){ const b=blob(1.1+r()*.7,1,k*7+i,0.85,new THREE.Color(0x3a5a2a)); b.translate((r()-.5)*2.6,3.2+r()*1.8,(r()-.5)*2.6); parts.push(b); } TREE_KINDS.push(mergeGeometries(parts.map(nonIdx))); } // ceviz
  { const parts=[trunk(.2,.12,1.6)]; for(let i=0;i<4;i++){ let c=new THREE.ConeGeometry(2.0-i*.42,2.4,9,2); c.deleteAttribute('uv'); c.deleteAttribute('normal'); c=mergeVertices(c); const p=c.attributes.position; const col=[]; const cc=new THREE.Color(0x24402c); for(let j=0;j<p.count;j++){ const x=p.getX(j),y=p.getY(j),z=p.getZ(j); const n=1+0.12*Math.sin(x*5+z*4+i); p.setXYZ(j,x*n,y,z*n); const s=.75+.35*(y/2.4+.5); col.push(cc.r*s,cc.g*s,cc.b*s); } c.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); c.computeVertexNormals(); c.translate(0,2.4+i*1.25,0); parts.push(c); } TREE_KINDS.push(mergeGeometries(parts.map(nonIdx))); } // çam
  const treeMat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.9 });
  treeMat.onBeforeCompile=(sh)=>{ sh.uniforms.uTime=treeU.uTime; sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
    #ifdef USE_INSTANCING
      vec3 ip=instanceMatrix[3].xyz; float sw=max(position.y-1.8,0.); transformed.x+=sin(uTime*1.25+ip.x*.37+ip.z*.21)*.035*sw; transformed.z+=cos(uTime*1.05+ip.z*.31)*.025*sw;
    #endif`); };
  const treeMeshes=[];
  function plantTrees(houseSpots, R){
    for(const m of treeMeshes){ scene.remove(m); } treeMeshes.length=0;
    const r=rngOf(1234); const per=TREE_KINDS.map(()=>[]); const dummy=new THREE.Object3D();
    const clear=(x,z)=>{ if(Math.hypot(x,z)<R+5) { for(const h of houseSpots){ if(Math.hypot(x-h.x,z-h.z)<6.2) return false; } if(Math.hypot(x,z)<LAYOUT.SQ_R+3) return false; } return true; };
    // kavak sıraları evlerin arkasında
    let tries=0, placed=0; while(placed<70 && tries<900){ tries++; const a=r()*Math.PI*2; const rr=R+4+r()*34; const x=Math.sin(a)*rr, z=-Math.cos(a)*rr; if(!clear(x,z)) continue;
      if(Math.abs(a-Math.PI)<0.32 && rr<R+16) continue; // yol ağzı açık kalsın
      let kind= rr>R+22 ? (r()<.55?4:(r()<.5?2:3)) : (r()<.45?(r()<.5?0:1):(r()<.5?2:3)); if(kind<2 && rr<R+7) kind=2+(placed%2);
      dummy.position.set(x,0,z); dummy.rotation.set(0,r()*6.28,0); const s=(kind<2?0.7+r()*0.3:0.8+r()*0.5); dummy.scale.set(s,s*(0.9+r()*.25),s); dummy.updateMatrix(); per[kind].push(dummy.matrix.clone()); placed++; }
    TREE_KINDS.forEach((g,k)=>{ if(!per[k].length) return; const im=new THREE.InstancedMesh(g,treeMat,per[k].length); per[k].forEach((m,i)=>im.setMatrixAt(i,m)); im.castShadow=true; im.receiveShadow=false; im.computeBoundingSphere(); scene.add(im); treeMeshes.push(im); });
  }

  /* ---------- meydan: çeşme ---------- */
  { const g=new THREE.Group(); g.position.set(LAYOUT.FOUNTAIN.x,0,LAYOUT.FOUNTAIN.z);
    const body=new THREE.Mesh(uvBox(2.3,2.5,0.9,1.1), M.stone); body.position.y=1.25; g.add(body);
    const top=new THREE.Mesh(uvBox(2.6,0.22,1.1,1), M.stone2); top.position.y=2.6; g.add(top);
    const crown=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,1.1,16,1,false,0,Math.PI), M.stone); crown.rotation.z=Math.PI/2; crown.rotation.y=Math.PI/2; crown.position.set(0,2.72,0); g.add(crown);
    const niche=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.35), new THREE.MeshStandardMaterial({ color:0x1d1a17, roughness:1 })); niche.position.set(0,1.45,0.452); g.add(niche);
    const arch=new THREE.Mesh(new THREE.CircleGeometry(0.55,20,0,Math.PI), niche.material); arch.position.set(0,2.12,0.452); g.add(arch);
    const plate=new THREE.Mesh(uvBox(0.8,0.34,0.05,1), M.white); plate.position.set(0,2.32,0.47); g.add(plate);
    const tap=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.28,8), new THREE.MeshStandardMaterial({ color:0xb08a3a, metalness:.9, roughness:.35 })); tap.rotation.x=Math.PI/2; tap.position.set(0,1.05,0.58); g.add(tap);
    const basin=new THREE.Mesh(uvBox(2.0,0.5,0.75,1), M.stone2); basin.position.set(0,0.25,0.82); g.add(basin);
    const water=new THREE.Mesh(new THREE.PlaneGeometry(1.8,0.6), new THREE.MeshStandardMaterial({ color:0x1a2a30, roughness:.05, metalness:.2, envMapIntensity:2 })); water.rotation.x=-Math.PI/2; water.position.set(0,0.47,0.82); water.userData.keep=true; g.add(water);
    g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); scene.add(g); bakeStatic(g); }
  // banklar
  for(const [x,z,ry] of [[-3.0,-8.1,0.05],[3.0,-8.1,-0.05]]){ const b=new THREE.Group(); b.position.set(x,0,z); b.rotation.y=ry;
    const seat=new THREE.Mesh(uvBox(2.0,0.09,0.42,1), M.planks); seat.position.y=0.46; b.add(seat); for(const s of [-0.8,0.8]){ const l=new THREE.Mesh(uvBox(0.1,0.46,0.38,1), M.planks); l.position.set(s,0.23,0); b.add(l); }
    b.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); scene.add(b); bakeStatic(b); }

  /* ---------- köy yolu: çit, araba tekerleği, saman, kilometre taşı ---------- */
  { const g=new THREE.Group();
    const post=(x,z,h=1.05)=>{ const p=new THREE.Mesh(uvBox(0.1,h,0.1,1),M.planks); p.position.set(x,h/2,z); p.rotation.y=(Math.sin(x*7+z)*0.1); g.add(p); };
    const rail=(x0,z0,x1,z1,y)=>{ const L=Math.hypot(x1-x0,z1-z0); const r=new THREE.Mesh(uvBox(0.06,0.09,L,1),M.planks); r.position.set((x0+x1)/2,y,(z0+z1)/2); r.rotation.y=Math.atan2(x1-x0,z1-z0); g.add(r); };
    for(const side of [-1,1]){ let px=null,pz=null; for(let i=0;i<9;i++){ const z=13.2+i*2.1; const x=side*(2.9+i*0.16+Math.sin(i*1.7)*0.12); post(x,z); if(px!==null){ rail(px,pz,x,z,0.45); rail(px,pz,x,z,0.88); } px=x; pz=z; } }
    const stone=new THREE.Mesh(uvBox(0.42,0.9,0.22,0.6),M.stone); stone.position.set(-3.6,0.45,12.2); stone.rotation.y=0.2; g.add(stone);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.21,0.22,12,1,false,0,Math.PI),M.stone); cap.rotation.z=Math.PI/2; cap.rotation.y=Math.PI/2+0.2; cap.position.set(-3.6,0.9,12.2); g.add(cap);
    const hay=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,1.1,16),M.hay); hay.rotation.z=Math.PI/2; hay.rotation.y=0.4; hay.position.set(4.6,0.55,15.6); g.add(hay);
    const hay2=hay.clone(); hay2.position.set(5.4,0.55,16.9); hay2.rotation.y=-0.3; g.add(hay2); const hay3=hay.clone(); hay3.position.set(5.0,1.45,16.2); g.add(hay3);
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(0.5,0.055,6,18),M.planks); wheel.position.set(-4.4,0.5,17.2); wheel.rotation.y=1.3; wheel.rotation.z=0.25; g.add(wheel);
    for(let i=0;i<6;i++){ const sp=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.98,0.035),M.planks); sp.rotation.z=i/6*Math.PI; wheel.add(sp); }
    g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); scene.add(g); bakeStatic(g); }

  /* ---------- dar ağacı ---------- */
  const GAL={ group:new THREE.Group(), platformY:0.78, beamY:4.42, noose:[], ropes:[], stools:[], hangX:[-1.25,0,1.25], z:-0.55 };
  { const g=GAL.group; g.position.set(LAYOUT.GALLOWS.x,0,LAYOUT.GALLOWS.z); g.rotation.y=LAYOUT.GALLOWS.rot;
    const PY=GAL.platformY; const st=new THREE.Group();
    const plat=new THREE.Mesh(uvBox(4.6,0.16,2.7,1.4), M.planks); plat.position.y=PY-0.08; st.add(plat);
    const skirt=new THREE.Mesh(uvBox(4.5,PY-0.16,2.6,1.4), M.beam); skirt.position.y=(PY-0.16)/2; st.add(skirt);
    for(let i=0;i<4;i++){ const s=new THREE.Mesh(uvBox(1.0,0.19,0.34,1), M.planks); s.position.set(-1.55,PY-0.19*(i+1)+0.095,1.35+0.17+i*0.34); st.add(s); }
    for(const x of [-2.05,2.05]){ const p=new THREE.Mesh(uvBox(0.26,GAL.beamY-PY+0.25,0.26,1), M.beam); p.position.set(x,PY+(GAL.beamY-PY+0.25)/2-0.05,GAL.z); st.add(p);
      const br=new THREE.Mesh(uvBox(0.16,1.1,0.16,1), M.beam); br.position.set(x*0.82,GAL.beamY-0.42,GAL.z); br.rotation.z=x>0?0.72:-0.72; st.add(br); }
    const beam=new THREE.Mesh(uvBox(4.7,0.28,0.28,1), M.beam); beam.position.set(0,GAL.beamY+0.14,GAL.z); st.add(beam);
    // arka korkuluk
    const rail=new THREE.Mesh(uvBox(4.4,0.08,0.08,1), M.beam); rail.position.set(0,PY+0.95,-1.25); st.add(rail); for(let i=0;i<7;i++){ const p=new THREE.Mesh(uvBox(0.07,0.95,0.07,1), M.beam); p.position.set(-2.1+i*0.7,PY+0.47,-1.25); st.add(p); }
    st.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); g.add(st); bakeStatic(st);
    for(const x of GAL.hangX){ const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,1,6), M.rope); rope.geometry.translate(0,-0.5,0); rope.position.set(x,GAL.beamY,GAL.z); rope.castShadow=true; g.add(rope); GAL.ropes.push(rope);
      const noose=new THREE.Mesh(new THREE.TorusGeometry(0.075,0.02,6,16), M.rope); noose.castShadow=true; g.add(noose); GAL.noose.push(noose); }
    scene.add(g); }
  function setRope(i, lenOrNull){ const r=GAL.ropes[i], n=GAL.noose[i]; if(!r) return; const L=lenOrNull==null?1.55:lenOrNull; r.scale.y=L; n.position.set(GAL.hangX[i],GAL.beamY-L-0.1,GAL.z); n.rotation.set(Math.PI/2,0,0); r.visible=n.visible=true; }
  [0,1,2].forEach(i=>setRope(i,null));

  /* ---------- kazıklar ---------- */
  const STK={ group:new THREE.Group(), x:[-1.45,0,1.45], top:3.15, blood:[] };
  { const g=STK.group; g.position.set(LAYOUT.STAKES.x,0,LAYOUT.STAKES.z); g.rotation.y=LAYOUT.STAKES.rot; const st=new THREE.Group();
    for(const x of STK.x){ const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.13,STK.top-0.3,10), M.bark); pole.position.set(x,(STK.top-0.3)/2,0); st.add(pole);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(0.075,0.42,10), M.bark); tip.position.set(x,STK.top-0.3+0.21,0); st.add(tip);
      const mound=new THREE.Mesh(new THREE.SphereGeometry(0.55,12,6,0,Math.PI*2,0,Math.PI/2), M.mud); mound.scale.y=0.35; mound.position.set(x,0,0); st.add(mound);
      for(let k=0;k<5;k++){ const s=new THREE.Mesh(new THREE.DodecahedronGeometry(0.1+Math.random()*0.06,0), M.stone2); s.position.set(x+Math.cos(k*1.3)*0.5,0.05,Math.sin(k*1.3)*0.45); st.add(s); }
      const bl=new THREE.Mesh(new THREE.CylinderGeometry(0.083,0.105,1.1,10,1,true), M.blood); bl.position.set(x,STK.top-0.95,0); bl.visible=false; g.add(bl); STK.blood.push(bl); }
    st.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); g.add(st); bakeStatic(st); scene.add(g); }

  /* ---------- meşaleler ---------- */
  const torches=[]; const TORCH_POS=[[-4.3,-8.4],[4.3,-8.4],[-8.9,2.6],[8.9,2.6],[-6.6,7.6],[6.6,7.6]];
  const flameMeshes=[];
  TORCH_POS.forEach(([x,z],i)=>{ const g=new THREE.Group(); g.position.set(x,0,z);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.075,2.3,8), M.bark); pole.position.y=1.15; pole.castShadow=true; g.add(pole);
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.08,0.26,10,1,true), M.iron); cup.position.y=2.36; g.add(cup);
    const coal=new THREE.Mesh(new THREE.SphereGeometry(0.13,8,6), new THREE.MeshStandardMaterial({ color:0x220800, emissive:0xff5a10, emissiveIntensity:2 })); coal.position.y=2.42; g.add(coal);
    const f1=new THREE.Sprite(M.flame.clone()); f1.scale.set(0.42,0.78,1); f1.position.y=2.78; g.add(f1);
    const f2=new THREE.Sprite(M.flame.clone()); f2.scale.set(0.3,0.55,1); f2.position.set(0.04,2.7,0.02); g.add(f2);
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowMap, color:0xff8a30, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, opacity:.5, fog:false })); glow.scale.set(2.4,2.4,1); glow.position.y=2.7; g.add(glow);
    let L=null; if(i<Q.torchLights){ L=new THREE.PointLight(0xff8f3a, 30, 18, 2); L.position.y=2.85; g.add(L); }
    scene.add(g); torches.push({ g, f1, f2, glow, coal, L, seed:i*1.7 }); flameMeshes.push(f1,f2);
  });

  /* ---------- sahne objeleri (modeller) ---------- */
  const propsLoaded={};
  async function loadProp(name){ if(propsLoaded[name]) return propsLoaded[name]; propsLoaded[name]=gltfL.loadAsync(`${base}props/${name}.glb`).then(g=>{ g.scene.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); return g.scene; }).catch(()=>null); return propsLoaded[name]; }
  const propSpots=[ ['barrel_03',-8.2,-5.6,1.05,.3],['barrel_03',-8.9,-4.7,1.05,1.2],['barrel_03',8.4,-6.3,1.0,.7],['rock_moss_set_01',11.5,-4,0.6,1],['rock_moss_set_01',-11.2,5.2,0.55,2.4],
    ['shrub_02',-10.2,-1.0,1.5,0],['shrub_02',10.6,-1.4,1.3,1],['shrub_02',-3,12.5,1.3,2],['shrub_02',3.6,12.2,1.2,.6],['dead_tree_trunk',12.6,-9.5,1.4,.4],['dead_tree_trunk',-13,9,1.2,2.1] ];
  const propsP=Promise.all(propSpots.map(async ([n,x,z,s,r])=>{ const o=await loadProp(n); if(!o) return; const c=o.clone(); c.position.set(x,0,z); c.scale.setScalar(s); c.rotation.y=r; scene.add(c); }));
  const stoolProto=await loadProp('folding_wooden_stool');
  let stoolH=0.5; if(stoolProto){ const bb=new THREE.Box3().setFromObject(stoolProto); stoolH=bb.max.y-bb.min.y; }
  const STOOL_H=0.5;
  for(let i=0;i<3;i++){ let s; if(stoolProto){ s=stoolProto.clone(); s.scale.setScalar(STOOL_H/stoolH); } else { s=new THREE.Mesh(uvBox(0.4,STOOL_H,0.4,1),M.planks); s.geometry.translate(0,STOOL_H/2,0); } const piv=new THREE.Group(); piv.add(s); piv.visible=false; GAL.group.add(piv); GAL.stools.push(piv); }

  /* ---------- parçacıklar ---------- */
  const partU={ uTime:{value:0}, uFire:{value:0}, uNight:{value:0}, uSmoke:{value:.5}, uPR:{value:renderer.getPixelRatio()}, uSmokeCol:{value:new THREE.Color(0x8a8a90)} };
  function points(count, attrs, vsh, fsh, map, blending=THREE.AdditiveBlending){ const g=new THREE.BufferGeometry(); for(const [k,a] of Object.entries(attrs)) g.setAttribute(k,a); g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),300);
    const m=new THREE.ShaderMaterial({ uniforms:{ ...partU, uMap:{value:map} }, vertexShader:vsh, fragmentShader:fsh, transparent:true, depthWrite:false, blending, fog:false }); const p=new THREE.Points(g,m); p.frustumCulled=false; scene.add(p); return p; }
  // kıvılcımlar
  { const n=Math.round(14*Q.particles)*TORCH_POS.length; const pos=new Float32Array(n*3), sd=new Float32Array(n); for(let i=0;i<n;i++){ const t=TORCH_POS[i%TORCH_POS.length]; pos.set([t[0],2.75,t[1]],i*3); sd[i]=Math.random(); }
    points(n,{ position:new THREE.BufferAttribute(pos,3), aSeed:new THREE.BufferAttribute(sd,1) },
      `uniform float uTime,uPR,uFire; attribute float aSeed; varying float vA; void main(){ float t=fract(uTime*(.35+aSeed*.4)+aSeed*7.); vec3 p=position+vec3(sin(aSeed*40.+uTime*2.)*.25*t, t*2.6, cos(aSeed*31.+uTime*1.7)*.25*t);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(1.-t)*uPR*30./max(1.,-mv.z); vA=(1.-t)*uFire; }`,
      `uniform sampler2D uMap; varying float vA; void main(){ vec4 c=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(vec3(1.,.55,.18)*c.a*vA*1.6,1.); }`, glowMap); }
  // ateş böcekleri
  { const n=Math.round(70*Q.particles); const pos=new Float32Array(n*3), sd=new Float32Array(n); for(let i=0;i<n;i++){ const a=Math.random()*6.283, r=10.5+Math.random()*20; pos.set([Math.cos(a)*r,0.4+Math.random()*2.4,Math.sin(a)*r],i*3); sd[i]=Math.random(); }
    points(n,{ position:new THREE.BufferAttribute(pos,3), aSeed:new THREE.BufferAttribute(sd,1) },
      `uniform float uTime,uPR,uNight; attribute float aSeed; varying float vA; void main(){ vec3 p=position+vec3(sin(uTime*.4+aSeed*20.)*1.4, sin(uTime*.7+aSeed*9.)*.45, cos(uTime*.33+aSeed*13.)*1.4);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; float bl=pow(max(0.,sin(uTime*(1.2+aSeed)+aSeed*30.)),6.); gl_PointSize=uPR*70./max(1.,-mv.z); vA=bl*uNight; }`,
      `uniform sampler2D uMap; varying float vA; void main(){ vec4 c=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(vec3(.75,1.,.35)*c.a*vA*1.4,1.); }`, glowMap); }
  // baca dumanı (evler kurulunca doldurulur)
  let smoke=null;
  function buildSmoke(chimneys){
    if(smoke){ scene.remove(smoke); smoke.geometry.dispose(); smoke=null; }
    const per=Math.max(4,Math.round(9*Q.particles)); const n=chimneys.length*per; if(!n) return;
    const pos=new Float32Array(n*3), sd=new Float32Array(n), on=new Float32Array(n);
    chimneys.forEach((c,ci)=>{ for(let k=0;k<per;k++){ const i=ci*per+k; pos.set([c.x,c.y,c.z],i*3); sd[i]=k/per+Math.random()*0.05; on[i]=1; } });
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('aSeed',new THREE.BufferAttribute(sd,1)); g.setAttribute('aOn',new THREE.BufferAttribute(on,1)); g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),300);
    const m=new THREE.ShaderMaterial({ uniforms:{ ...partU, uMap:{ value:puffTex() } }, transparent:true, depthWrite:false, fog:false,
      vertexShader:`uniform float uTime,uPR,uSmoke; attribute float aSeed,aOn; varying float vA; varying float vT; void main(){ float t=fract(uTime*.07+aSeed); vec3 p=position+vec3(t*t*2.6+sin(t*6.+aSeed*30.)*.25, t*5.2, t*t*.8);
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=uPR*(70.+t*260.)/max(1.,-mv.z); vA=smoothstep(0.,.12,t)*(1.-t)*uSmoke*aOn; vT=t; }`,
      fragmentShader:`uniform sampler2D uMap; uniform vec3 uSmokeCol; varying float vA; varying float vT; void main(){ vec4 c=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(uSmokeCol, c.a*vA*.85); }` });
    smoke=new THREE.Points(g,m); smoke.frustumCulled=false; smoke.userData.per=per; scene.add(smoke);
  }
  function smokeOn(houseIdx, on){ if(!smoke) return; const per=smoke.userData.per; const a=smoke.geometry.attributes.aOn; for(let k=0;k<per;k++) a.setX(houseIdx*per+k, on?1:0); a.needsUpdate=true; }

  /* ---------- köy (evler) ---------- */
  const village={ houses:[], byId:new Map(), R:16, group:new THREE.Group(), decor:[] }; scene.add(village.group);
  const ribbonProto=buildRibbon();
  function clearVillage(){
    for(const h of [...village.houses, ...village.decor]){ village.group.remove(h.group); h.group.traverse(o=>{ if(o.isMesh){ o.geometry.dispose(); } }); for(const m of h.mats||[]) m.dispose(); }
    village.houses=[]; village.decor=[]; village.byId.clear();
  }
  /** Oyuncu listesine göre ev halkasını kur. players: [{id,name}] */
  function setupVillage(players, seed=7){
    clearVillage();
    const n=players.length; const gap=1.1; const spacing=8.4; const R0=16.2;
    let R=Math.max(R0, n*spacing/(Math.PI*2-gap)); let span=Math.min(Math.PI*2-gap, (n-1)*spacing/R);
    village.R=R; const r=rngOf(seed);
    const order=[0,1,2,3,4,5].sort(()=>r()-.5);
    players.forEach((p,i)=>{
      const th = n===1?0 : -span/2 + span*i/(n-1);
      const rr=R+(i%2?0.8:-0.4);
      const x=Math.sin(th)*rr, z=-Math.cos(th)*rr;
      const type=order[i%6]; const H=buildHouse(type, M, seed*13+i);
      H.group.position.set(x,0,z); H.group.rotation.y=-th;
      // pencere camlarını birleştir (ışık açıp kapamak için tek parça)
      const glassGeos=H.windows.map(w=>{ w.updateMatrix(); const g=w.geometry.clone(); g.applyMatrix4(w.matrix); return g; });
      H.windows.forEach(w=>w.removeFromParent());
      const glass=new THREE.Mesh(mergeGeometries(glassGeos), M.glassDark); glass.matrixAutoUpdate=false; H.group.add(glass);
      H.setLights=(lv)=>{ glass.material = lv>0.05 ? M.glassLit : M.glassDark; };
      bakeStatic(H.group, new Set([H.doorPivot, glass, H.hit]));
      H.group.updateMatrixWorld(true);
      const door=H.group.localToWorld(H.doorPos.clone());
      const rec={ pid:p.id, idx:i, H, group:H.group, theta:th, pos:new THREE.Vector3(x,0,z), door, inside:H.group.localToWorld(new THREE.Vector3(H.doorPos.x,0,H.depth/2-0.3)),
        chimney:H.group.localToWorld(H.chimneyTop.clone()), ribbon:null, mourning:0, doorOpen:0, doorTarget:0, lit:1 };
      H.hit.userData.pid=p.id;
      village.group.add(H.group); village.houses.push(rec); village.byId.set(p.id,rec);
    });
    // boşluklara dekor evler (arka sıra)
    const free=Math.PI*2-gap-span; const nd=Math.max(0,Math.min(6,Math.floor(free/(spacing/(R+9)))));
    for(let k=0;k<nd;k++){ const side=k%2?1:-1; const off=(Math.floor(k/2)+0.5)*(free/2)/Math.max(1,Math.ceil(nd/2));
      const th=side*(span/2+off+0.12); const rr=R+2+(k%3)*1.2; const x=Math.sin(th)*rr, z=-Math.cos(th)*rr; if(Math.abs(Math.abs(th)-Math.PI)<0.45) continue;
      const H=buildHouse((order[(n+k)%6]), M, seed*17+k+50); H.group.position.set(x,0,z); H.group.rotation.y=-th; H.windows.forEach(w=>{ w.material=M.glassDark; });
      bakeStatic(H.group,new Set([H.hit])); H.hit.removeFromParent(); village.group.add(H.group); village.decor.push({ H, group:H.group, pos:new THREE.Vector3(x,0,z) }); }
    buildSmoke(village.houses.map(h=>h.chimney));
    drawGroundMask(); plantTrees([...village.houses.map(h=>h.pos), ...village.decor.map(h=>h.pos)], R);
    applyLights();
    return village;
  }
  function drawGroundMask(){
    const x=maskCanvas.getContext('2d'); const S=512, k=S/(MASK_R*2); const P=(wx,wz)=>[S/2+wx*k, S/2+wz*k];
    x.fillStyle='#000'; x.fillRect(0,0,S,S);
    const soft=(fn,w,col='255,255,255')=>{ for(const [mul,al] of [[2.0,.12],[1.55,.2],[1.2,.35],[0.85,.6]]){ x.strokeStyle=`rgba(${col},${al})`; x.fillStyle=`rgba(${col},${al})`; x.lineWidth=w*mul*k; x.lineCap='round'; fn(mul); } };
    // meydan çevresi
    soft((m)=>{ x.beginPath(); const [cx,cy]=P(0,0); x.arc(cx,cy,(LAYOUT.SQ_R+1.4*m)*k,0,Math.PI*2); x.fill(); },1);
    // ev önleri ve patikalar
    for(const h of village.houses){ const d=h.door; soft((m)=>{ x.beginPath(); const [a,b]=P(d.x,d.z); x.arc(a,b,2.3*m*k,0,Math.PI*2); x.fill(); },1);
      soft(()=>{ x.beginPath(); const [a,b]=P(d.x,d.z); const t=(LAYOUT.SQ_R)/Math.hypot(d.x,d.z); const [c,e]=P(d.x*t,d.z*t); x.moveTo(a,b); x.lineTo(c,e); x.stroke(); },1.7); }
    // köye giren yol
    soft(()=>{ x.beginPath(); const [a,b]=P(0,LAYOUT.SQ_R); const [c,e]=P(0,MASK_R); x.moveTo(a,b); x.quadraticCurveTo(...P(3,30),c,e); x.stroke(); },3.2);
    // rastgele toprak lekeleri
    const r=rngOf(5); for(let i=0;i<40;i++){ const a=r()*6.28, rr=r()*MASK_R; const [px,py]=P(Math.cos(a)*rr,Math.sin(a)*rr); const g=x.createRadialGradient(px,py,0,px,py,(1+r()*3)*k); g.addColorStop(0,'rgba(255,255,255,.4)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(px-40,py-40,80,80); }
    maskTex.needsUpdate=true;
  }
  function houseOf(pid){ return village.byId.get(pid)||null; }
  function setMourning(pid, on, ribbon=true){ const h=houseOf(pid); if(!h) return; h.mourning=on?1:0; h.H.setMourning(on?1:0); smokeOn(h.idx,!on);
    if(on && ribbon && !h.ribbon){ const rb=ribbonProto.clone(); rb.position.copy(h.H.ribbonAt); h.group.add(rb); h.ribbon=rb; } if(!on && h.ribbon){ h.group.remove(h.ribbon); h.ribbon=null; } applyLights(); }
  function openDoor(pid, open=true){ const h=houseOf(pid); if(h) h.doorTarget=open?1:0; }

  /* ---------- ışık evresi geçişleri ---------- */
  let phaseName='night'; const cur=phaseState(PHASES.night); let from=phaseState(PHASES.night), to=phaseState(PHASES.night); let pt=1, pdur=1;
  function setPhase(name, dur=2.5){ if(!PHASES[name]) return; phaseName=name; from=phaseState(PHASES.night); lerpPhase(from,cur,cur,0); to=phaseState(PHASES[name]); pt=0; pdur=Math.max(0.001,dur); if(dur<=0){ pt=1; lerpPhase(cur,to,to,0); applyPhase(); updateEnv(); } }
  function applyLights(){ const w=cur.win; for(const h of village.houses){ h.H.setLights(h.mourning?0:(w>0.5?1:0)); } }
  let lastWin=-1; let fillBase=3;
  function applyPhase(){
    skyU.uTop.value.copy(cur.top); skyU.uMid.value.copy(cur.mid); skyU.uHor.value.copy(cur.hor); skyU.uGlowCol.value.copy(cur.glow); skyU.uGlow.value=cur.glowAmt;
    skyU.uCelCol.value.copy(cur.cel); skyU.uCelDir.value.copy(cur.celDir); skyU.uCelSize.value=cur.celSize; skyU.uMoon.value=cur.moon; skyU.uStars.value=cur.stars; skyU.uCloud.value=cur.cloud; skyU.uCloudCol.value.copy(cur.cloudCol);
    sun.color.copy(cur.sunCol); sun.intensity=cur.sunI; fill.color.copy(cur.torch>0.5?new THREE.Color(0xffb878):cur.sunCol); fillBase=cur.torch>0.5?5.5:2.2; hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity=cur.hemiI*(Q.env?0.75:1);
    scene.fog.color.copy(cur.fog); scene.fog.density=cur.fogD; renderer.toneMappingExposure=cur.exp; scene.environmentIntensity=cur.env;
    partU.uFire.value=cur.fire; partU.uNight.value=Math.max(0,cur.stars-.3)/.7; partU.uSmoke.value=cur.smoke; partU.uSmokeCol.value.copy(cur.hemiS).lerp(new THREE.Color(0x9a948c),.5).multiplyScalar(0.55+cur.sunI*0.18);
    for(const t of torches){ t.g.visible=cur.torch>0.02; }
    const w=cur.win>0.5?1:0; if(w!==lastWin){ lastWin=w; applyLights(); }
  }

  /* ---------- kamera yönetmeni ---------- */
  const CAM={ pos:new THREE.Vector3(0,6,16), tgt:new THREE.Vector3(0,1.4,0), fov:50, a:null, b:null, t:1, dur:1, ease:ease.inOut, mode:'fixed',
    orbit:{ center:new THREE.Vector3(0,0,0), r:24, h:16, ang:0, speed:0.05, lookY:0, vel:0, pitch:0 }, pan:{ ang:0, speed:0.06, vel:0, h:8.5, R:16, lookY:1.8, back:3.5 }, follow:null, shake:0, hand:1, drift:0, shift:0.2 };
  const portrait=()=>camera.aspect<1;
  function fovFor(f){ return portrait()? f : f*0.74; }
  function camCut(pos,tgt,fov=CAM.fov){ CAM.mode='fixed'; CAM.pos.copy(pos); CAM.tgt.copy(tgt); CAM.fov=fov; CAM.t=1; CAM.a=null; CAM.drift=0; }
  function camMove(pos,tgt,{ dur=2.2, fov=CAM.fov, ease:e='inOut' }={}){ if(dur<=0.01) return camCut(pos,tgt,fov); CAM.mode='fixed'; CAM.a={ pos:CAM.pos.clone(), tgt:CAM.tgt.clone(), fov:CAM.fov }; CAM.b={ pos:pos.clone(), tgt:tgt.clone(), fov }; CAM.t=0; CAM.dur=dur; CAM.ease=ease[e]||ease.inOut; CAM.drift=0; }
  function camOrbit(o={}){ Object.assign(CAM.orbit,o); CAM.mode='orbit'; }
  function camFollow(obj, off=new THREE.Vector3(0,2.2,4), look=new THREE.Vector3(0,1.4,0)){ CAM.mode='follow'; CAM.follow={ obj, off, look }; }
  /** meydanın ortasından evlere doğru yavaşça dönen bakış (sürükleyerek çevrilir) */
  function camPan(o={}){ Object.assign(CAM.pan,o); CAM.mode='pan'; }
  const _p=new THREE.Vector3(), _t=new THREE.Vector3();
  function updateCamera(dt,t){
    if(CAM.mode==='orbit'){ const o=CAM.orbit; o.ang+=(o.speed+o.vel)*dt; o.vel*=Math.pow(0.04,dt);
      _p.set(o.center.x+Math.sin(o.ang)*o.r, o.h, o.center.z+Math.cos(o.ang)*o.r); _t.set(o.center.x,o.lookY,o.center.z);
      CAM.pos.lerp(_p,1-Math.pow(0.02,dt)); CAM.tgt.lerp(_t,1-Math.pow(0.02,dt)); }
    else if(CAM.mode==='pan'){ const o=CAM.pan; o.ang+=(o.speed+o.vel)*dt; o.vel*=Math.pow(0.05,dt); const sx=Math.sin(o.ang), sz=-Math.cos(o.ang);
      _t.set(sx*o.R, o.lookY, sz*o.R); _p.set(-sx*o.back, o.h, -sz*o.back); CAM.pos.lerp(_p,1-Math.pow(0.03,dt)); CAM.tgt.lerp(_t,1-Math.pow(0.03,dt)); }
    else if(CAM.mode==='follow' && CAM.follow){ const f=CAM.follow; const o=f.obj; _t.copy(o.position).add(f.look); _p.copy(o.position).add(f.off); CAM.pos.lerp(_p,1-Math.pow(0.05,dt)); CAM.tgt.lerp(_t,1-Math.pow(0.02,dt)); }
    else if(CAM.a){ CAM.t=Math.min(1,CAM.t+dt/CAM.dur); const k=CAM.ease(CAM.t); CAM.pos.lerpVectors(CAM.a.pos,CAM.b.pos,k); CAM.tgt.lerpVectors(CAM.a.tgt,CAM.b.tgt,k); CAM.fov=CAM.a.fov+(CAM.b.fov-CAM.a.fov)*k; if(CAM.t>=1) CAM.a=null; }
    else { CAM.drift+=dt; }
    // elde çekim hissi + yavaş yaklaşma
    const hh=CAM.hand*0.035, dr=Math.min(CAM.drift,30)*0.012;
    _p.copy(CAM.pos); const dir=_t.copy(CAM.tgt).sub(CAM.pos); const dl=dir.length(); if(dl>0.01) _p.addScaledVector(dir.normalize(), Math.min(dr, dl*0.08));
    _p.x+=Math.sin(t*0.71)*hh+Math.sin(t*1.93)*hh*.35; _p.y+=Math.sin(t*0.53+1.)*hh*.7;
    if(CAM.shake>0){ _p.x+=(Math.random()-.5)*CAM.shake; _p.y+=(Math.random()-.5)*CAM.shake; CAM.shake*=Math.pow(0.02,dt); if(CAM.shake<0.002) CAM.shake=0; }
    // dolgu ışığı: kameranın sol üstünde, hedefe yakınken güçlü
    { const dTo=CAM.pos.distanceTo(CAM.tgt); fill.position.copy(camera.position).lerp(CAM.tgt,0.35); fill.position.y+=0.9; fill.position.x+=0.6; fill.intensity=fillBase*THREE.MathUtils.clamp(1.6-dTo/9,0,1); }
    camera.position.copy(_p); camera.lookAt(CAM.tgt.x+Math.sin(t*0.6)*hh*.5, CAM.tgt.y+Math.sin(t*0.45)*hh*.4, CAM.tgt.z);
    const f=fovFor(CAM.fov); if(Math.abs(camera.fov-f)>0.01){ camera.fov=f; camera.updateProjectionMatrix(); lensShift(); }
  }
  // dikey ekranda konu, alt paneller yüzünden biraz yukarıda dursun
  function lensShift(){ const s=portrait()?CAM.shift:CAM.shift*0.5; camera.projectionMatrix.elements[9]=-s; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }
  function setFrameShift(s){ CAM.shift=s; camera.updateProjectionMatrix(); lensShift(); }

  /* ---------- ekran etiketleri ---------- */
  const labels=new Map(); const _v=new THREE.Vector3();
  function label(key, html, getPos, cls=''){ let L=labels.get(key); if(!L){ const el=document.createElement('div'); el.className='w3d-lb '+cls; overlay.appendChild(el); L={ el, getPos, html:null }; labels.set(key,L); } L.getPos=getPos; if(cls) L.el.className='w3d-lb '+cls; if(L.html!==html){ L.el.innerHTML=html; L.html=html; } return L.el; }
  function unlabel(key){ const L=labels.get(key); if(L){ L.el.remove(); labels.delete(key); } }
  function unlabelAll(prefix=''){ for(const k of [...labels.keys()]) if(k.startsWith(prefix)) unlabel(k); }
  function updateLabels(){ const w=W, h=H; for(const L of labels.values()){ const p=L.getPos(_v); if(!p){ L.el.style.display='none'; continue; } p.project(camera); if(p.z>1||p.z<-1||Math.abs(p.x)>1.2||Math.abs(p.y)>1.2){ L.el.style.display='none'; continue; } L.el.style.display=''; L.el.style.transform=`translate(${((p.x+1)/2*w).toFixed(1)}px,${((1-p.y)/2*h).toFixed(1)}px)`; } }

  /* ---------- dokunarak seçme ---------- */
  const ray=new THREE.Raycaster(); const ndc=new THREE.Vector2(); let pickCb=null; let pickables=()=>[]; let down=null;
  function pickAt(cx,cy){ const r=canvas.getBoundingClientRect(); ndc.set(((cx-r.left)/r.width)*2-1, -((cy-r.top)/r.height)*2+1); ray.setFromCamera(ndc,camera);
    const objs=[...village.houses.map(h=>h.H.hit), ...pickables()]; const hit=ray.intersectObjects(objs,false)[0]; return hit?hit.object.userData.pid:null; }
  canvas.addEventListener('pointerdown',(e)=>{ down={ x:e.clientX, y:e.clientY, t:performance.now(), lx:e.clientX }; });
  canvas.addEventListener('pointermove',(e)=>{ if(!down) return; const dx=e.clientX-down.lx; down.lx=e.clientX; if(CAM.mode==='orbit' && Math.abs(e.clientX-down.x)>6){ CAM.orbit.ang-=dx*0.006; CAM.orbit.vel=-dx*0.25; } if(CAM.mode==='pan' && Math.abs(e.clientX-down.x)>6){ CAM.pan.ang-=dx*0.0045; CAM.pan.vel=-dx*0.2; } });
  canvas.addEventListener('pointerup',(e)=>{ if(!down) return; const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y); const dt=performance.now()-down.t; down=null; if(moved<10 && dt<600 && pickCb){ const id=pickAt(e.clientX,e.clientY); if(id!=null) pickCb(id); } });
  canvas.addEventListener('pointercancel',()=>{ down=null; });

  /* ---------- seçim halkası (ev önü / kişi ayağı) ---------- */
  const ringMat=new THREE.MeshBasicMaterial({ color:0xffc457, transparent:true, opacity:.85, depthWrite:false, blending:THREE.AdditiveBlending, fog:false, side:THREE.DoubleSide });
  const ringGeo=new THREE.RingGeometry(0.62,0.82,40); ringGeo.rotateX(-Math.PI/2);
  const rings=new Map();
  function ringAt(key, getPos, color=0xffc457, scale=1){ let r=rings.get(key); if(!r){ r=new THREE.Mesh(ringGeo, ringMat.clone()); r.renderOrder=5; scene.add(r); rings.set(key,r); } r.material.color.set(color); r.userData.getPos=getPos; r.userData.scale=scale; return r; }
  function unring(key){ const r=rings.get(key); if(r){ scene.remove(r); r.material.dispose(); rings.delete(key); } }
  function unringAll(prefix=''){ for(const k of [...rings.keys()]) if(k.startsWith(prefix)) unring(k); }

  /* ---------- son işlem ---------- */
  let composer=null, bloom=null;
  function buildComposer(){ if(!Q.bloom){ composer=null; return; } const rt=new THREE.WebGLRenderTarget(1,1,{ type:THREE.HalfFloatType, samples:Q.msaa||0 }); composer=new EffectComposer(renderer,rt); composer.addPass(new RenderPass(scene,camera)); bloom=new UnrealBloomPass(new THREE.Vector2(256,256),0.42,0.55,0.86); composer.addPass(bloom); composer.addPass(new OutputPass()); }
  buildComposer();

  /* ---------- boyut ---------- */
  let W=1,H=1;
  function resize(){ const r=container.getBoundingClientRect(); W=Math.max(1,Math.round(r.width)); H=Math.max(1,Math.round(r.height)); renderer.setSize(W,H,false); if(composer) composer.setSize(W,H); camera.aspect=W/H; camera.fov=fovFor(CAM.fov); camera.updateProjectionMatrix(); lensShift(); partU.uPR.value=renderer.getPixelRatio(); }
  const ro=('ResizeObserver' in window)? new ResizeObserver(resize):null; ro?ro.observe(container):window.addEventListener('resize',resize); resize();

  /* ---------- döngü ---------- */
  const actors=new Set(); const tickers=new Set();
  const clock=new THREE.Clock(); let running=true, paused=false; let fpsAcc=0, fpsN=0, slowFor=0;
  function frame(){
    if(!running) return; requestAnimationFrame(frame);
    if(paused || document.hidden) { clock.getDelta(); return; }
    const dt=Math.min(clock.getDelta(),maxDt), t=clock.elapsedTime;
    if(pt<1){ pt=Math.min(1,pt+dt/pdur); lerpPhase(cur,from,to,smooth(pt)); applyPhase(); if(pt>=1) updateEnv(); }
    skyU.uTime.value=t; partU.uTime.value=t; treeU.uTime.value=t;
    for(const tc of torches){ if(!tc.g.visible) continue; const f=0.78+0.22*Math.sin(t*12.7+tc.seed)*Math.sin(t*7.3+tc.seed*2)+0.07*Math.sin(t*29+tc.seed); const k=cur.torch;
      if(tc.L) tc.L.intensity=30*f*k; tc.f1.scale.set(0.42*(0.9+0.15*f),0.78*(0.8+0.3*f),1); tc.f2.scale.set(0.3,0.55*(0.85+0.3*Math.sin(t*17+tc.seed)),1); tc.f1.material.opacity=k; tc.f2.material.opacity=k*.9; tc.glow.material.opacity=(.35+.2*f)*k; }
    for(const h of village.houses){ if(Math.abs(h.doorOpen-h.doorTarget)>0.001){ h.doorOpen+= (h.doorTarget-h.doorOpen)*Math.min(1,dt*5); h.H.doorPivot.rotation.y=-1.45*h.doorOpen; } }
    for(const a of actors) a.update(dt,t);
    for(const f of tickers) f(dt,t);
    for(const r of rings.values()){ const p=r.userData.getPos(_v); if(p){ r.visible=true; r.position.set(p.x,0.06,p.z); const s=r.userData.scale*(1+0.08*Math.sin(t*5)); r.scale.set(s,1,s); r.material.opacity=.55+.3*Math.sin(t*5); } else r.visible=false; }
    updateCamera(dt,t);
    sky.position.copy(camera.position);
    // gölge kamerası kameranın baktığı yeri takip etsin
    _t.copy(CAM.tgt); _t.y=0; _t.clampLength(0,14); sun.target.position.copy(_t); sun.position.copy(_t).addScaledVector(cur.sunDir,SUN_DIST);
    if(composer) composer.render(dt); else renderer.render(scene,camera);
    updateLabels();
    // yavaşsa kaliteyi düşür
    fpsAcc+=dt; fpsN++; if(fpsAcc>2){ const fps=fpsN/fpsAcc; fpsAcc=0; fpsN=0; if(fps<24){ slowFor++; if(slowFor>=2) degrade(); } else slowFor=0; }
  }
  function degrade(){ slowFor=0; if(composer){ composer=null; Q.bloom=false; return; } const pr=renderer.getPixelRatio(); if(pr>1.01){ renderer.setPixelRatio(Math.max(1,pr-0.5)); resize(); return; } if(renderer.shadowMap.enabled && Q.shadow>1024){ Q.shadow=1024; sun.shadow.mapSize.set(1024,1024); sun.shadow.map?.dispose(); sun.shadow.map=null; } }

  await Promise.race([propsP, new Promise(r=>setTimeout(r,4000))]);
  await new Promise(res=>{ if(allLoaded) return res(); const t0=performance.now(); const iv=setInterval(()=>{ if(allLoaded||performance.now()-t0>9000){ clearInterval(iv); res(); } },60); });
  setPhase('night',0); applyPhase(); updateEnv();
  onProgress&&onProgress(1);
  frame();

  return {
    THREE, scene, camera, renderer, canvas, overlay, M, LAYOUT, GAL, STK, village, quality:qName,
    setupVillage, houseOf, setMourning, openDoor, setRope, setPhase, get phase(){ return phaseName; },
    camCut, camMove, camOrbit, camFollow, camPan, CAM, setFrameShift, shake(a=0.15){ CAM.shake=a; },
    label, unlabel, unlabelAll, ringAt, unring, unringAll,
    onPick(cb, extra){ pickCb=cb; if(extra) pickables=extra; },
    addActor(a){ actors.add(a); scene.add(a.holder); }, removeActor(a){ actors.delete(a); scene.remove(a.holder); }, actors,
    tick(f){ tickers.add(f); return ()=>tickers.delete(f); },
    pause(v=true){ paused=v; }, resize,
    dispose(){ running=false; ro&&ro.disconnect(); clearVillage(); renderer.dispose(); envRT&&envRT.dispose(); pmrem&&pmrem.dispose(); try{ renderer.forceContextLoss(); }catch(e){} canvas.remove(); overlay.remove(); },
    snapshot(){ return canvas.toDataURL('image/jpeg',0.9); },
  };
}

export const WORLD_CSS = `
.w3d{position:relative;overflow:hidden;background:#05060c}
.w3d-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.w3d-ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.w3d-lb{position:absolute;left:0;top:0;will-change:transform;pointer-events:none;white-space:nowrap}
.w3d-lb>div{transform:translate(-50%,-100%)}
.w3d-lb .nm{font:700 11px/1.1 system-ui,sans-serif;color:#f4ead6;background:rgba(10,8,12,.55);border:1px solid rgba(255,214,140,.25);padding:3px 7px;border-radius:9px;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);text-shadow:0 1px 2px #000}
.w3d-lb .nm.me{border-color:rgba(255,196,87,.8);color:#ffd58a}
.w3d-lb .nm.dead{opacity:.55;text-decoration:line-through}
.w3d-lb .nm.sel{background:rgba(160,30,20,.75);border-color:#ffc457;color:#fff}
.w3d-lb .spk{font:800 12px/1.1 system-ui,sans-serif;color:#1a1208;background:linear-gradient(#ffe0a0,#e8a948);padding:4px 9px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.5)}
.w3d-lb .bdg{font:900 15px/1 system-ui,sans-serif;color:#fff;background:#a3171b;border:2px solid #ffcf7a;min-width:26px;height:26px;border-radius:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(255,80,40,.6)}
.w3d-lb .lk{font:800 16px/1 system-ui,sans-serif;background:rgba(10,8,12,.7);border:1px solid rgba(255,214,140,.5);border-radius:10px;padding:3px 6px}
`;
