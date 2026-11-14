// Sanal saat: zaman yalnızca window.__advance(ms) çağrılınca ilerler (kare kare video çekimi için)
(()=>{
  let now=0, id=1; const timers=new Map(); let rafs=[];
  const P=performance; P.now=()=>now; const D0=1.7e12; Date.now=()=>D0+now;
  window.setTimeout=(fn,ms=0,...a)=>{ const i=id++; timers.set(i,{ t:now+Math.max(0,+ms||0), fn, a }); return i; };
  window.clearTimeout=(i)=>{ timers.delete(i); };
  window.setInterval=(fn,ms=0,...a)=>{ const i=id++; const arm=()=>timers.set(i,{ t:now+Math.max(1,+ms||0), fn:()=>{ arm(); fn(...a); }, a:[] }); arm(); return i; };
  window.clearInterval=(i)=>{ timers.delete(i); };
  window.requestAnimationFrame=(fn)=>{ rafs.push(fn); return rafs.length; };
  window.cancelAnimationFrame=()=>{};
  const runDue=(end)=>{ for(let guard=0;guard<100000;guard++){ let bi=0, bt=null; for(const [i,t] of timers){ if(t.t<=end && (!bt||t.t<bt.t)){ bi=i; bt=t; } } if(!bt) break; timers.delete(bi); now=Math.max(now,bt.t); try{ bt.fn(...bt.a); }catch(e){ console.error(e); } } };
  window.__vnow=()=>now;
  // mikro görevlerin (Promise) arada çalışması için adımı küçük parçalara böl
  window.__advance=async(ms)=>{ const end=now+ms; const step=Math.min(ms,8);
    while(now<end){ const t=Math.min(end,now+step); runDue(t); now=t; await Promise.resolve(); await new Promise(r=>queueMicrotask(r)); }
    const fs=rafs; rafs=[]; for(const f of fs){ try{ f(now); }catch(e){ console.error(e); } } };
})();
