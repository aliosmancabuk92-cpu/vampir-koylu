/* 3B tercihleri — three.js yüklemeden okunabilir (hafif) */
export function webglOK(){ try{ const c=document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2')||c.getContext('webgl'))); }catch(e){ return false; } }
export function stageWanted(){ let pref=null; try{ pref=localStorage.getItem('vk_render'); }catch(e){} return pref!=='2d' && webglOK(); }
export function setRenderPref(v){ try{ localStorage.setItem('vk_render',v); }catch(e){} }
export function setQualityPref(q){ try{ if(q) localStorage.setItem('vk_quality',q); else localStorage.removeItem('vk_quality'); }catch(e){} }
export function loadingHTML(){ return `<div class="load3d" id="gLoad"><div class="t">Köy hazırlanıyor…</div><div class="bar"><div id="gLoadBar"></div></div><div class="s" id="gLoadTx">Evler, köylüler, meşaleler…</div></div>`; }
/** 3B modülünü yalnızca gerektiğinde indir */
let modP=null; export function stage3d(){ if(!modP) modP=import('./stage3d.js'); return modP; }
/** 3B kapalıyken çağrılan güvenli kapatma */
export function hideStage(){ if(modP) modP.then(m=>m.showStage(false)).catch(()=>{}); else document.body.classList.remove('in3d'); }
