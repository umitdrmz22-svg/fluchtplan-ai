'use strict';
(async()=>{
  const demo=new URLSearchParams(location.search).get('demo')==='1';
  if(demo){
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='app-core.js?v=20260928';script.onload=resolve;script.onerror=()=>reject(new Error('Fluchtplan-Editor konnte nicht geladen werden.'));document.body.appendChild(script);});
    const status=document.querySelector('.header-status');if(status)status.innerHTML='<span class="status-dot"></span>BGN Demo · lokal · Verarbeitung im Browser';
    return;
  }

  await new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='cloud-config.js?v=1';
    script.onload=resolve;
    script.onerror=()=>reject(new Error('Cloudkonfiguration konnte nicht geladen werden.'));
    document.body.appendChild(script);
  });

  const cloud=await import('./cloud-bridge.js?v=1');
  const allowed=await cloud.prepare();
  if(!allowed)return;

  await new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='app-core.js?v=20260806';
    script.onload=resolve;
    script.onerror=()=>reject(new Error('Fluchtplan-Editor konnte nicht geladen werden.'));
    document.body.appendChild(script);
  });
})().catch(error=>{
  console.error(error);
  document.body.textContent='Anwendung konnte nicht geladen werden.';
});
