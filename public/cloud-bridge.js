'use strict';

const cfg=window.FRP_CLOUD_CONFIG||{};
let client=null;
let session=null;
let membership=null;
let currentRecordKey='';
let saveTimer=null;
let saving=false;
const recordKeyStorage=`${cfg.appKey||'fluchtplan'}-cloud-record-key`;

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const parseLocal=()=>{try{return JSON.parse(localStorage.getItem(cfg.storageKey)||'null');}catch{return null;}};
const titleOf=payload=>{
  const meta=payload?.meta||{};
  return [meta.planNumber,meta.company,meta.building,meta.floor].filter(Boolean).join(' · ')||'Flucht- und Rettungsplan';
};

function renderBlocked(){
  document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;padding:32px;background:#f4f7f8;font-family:Arial,sans-serif;color:#17343d"><section style="max-width:720px;background:#fff;border:1px solid #d8e1e4;border-radius:18px;padding:34px;box-shadow:0 18px 48px rgba(23,52,61,.12)"><p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;color:#657b82">PRODUKTIVBETRIEB</p><h1 style="margin:0 0 14px;font-size:30px">Fluchtplan Studio ist noch nicht verbunden</h1><p style="margin:0 0 18px;line-height:1.55">Der lokale Demo-Betrieb ist deaktiviert. Für Anmeldung und dauerhafte Speicherung müssen die gemeinsame Supabase-Konfiguration sowie die Migration <code>020_app_records.sql</code> eingerichtet sein.</p><strong>Ohne Verbindung werden keine Projektdaten gespeichert.</strong></section></main>`;
}

function renderAuth(message=''){
  document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;padding:28px;background:#f4f7f8;font-family:Arial,sans-serif;color:#17343d"><section style="width:min(760px,100%);background:#fff;border:1px solid #d8e1e4;border-radius:18px;padding:32px;box-shadow:0 18px 48px rgba(23,52,61,.12)"><p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;color:#657b82">GESCHÜTZTER FIRMENBEREICH</p><h1 style="margin:0 0 8px">Fluchtplan Studio</h1><p style="margin:0 0 22px;line-height:1.5">Bitte anmelden. Pläne werden anschließend dauerhaft dem Benutzerkonto und dessen Organisation zugeordnet.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px"><form id="cloudLogin" style="display:grid;gap:12px"><h2 style="margin:0">Anmelden</h2><label>E-Mail<input name="email" type="email" required autocomplete="username" style="display:block;width:100%;box-sizing:border-box;padding:11px;margin-top:5px"></label><label>Passwort<input name="password" type="password" required autocomplete="current-password" style="display:block;width:100%;box-sizing:border-box;padding:11px;margin-top:5px"></label><button style="padding:12px;border:0;border-radius:8px;background:#0b5968;color:#fff;font-weight:700">Anmelden</button></form><form id="cloudSignup" style="display:grid;gap:12px"><h2 style="margin:0">Registrieren</h2><label>Name<input name="fullName" required autocomplete="name" style="display:block;width:100%;box-sizing:border-box;padding:11px;margin-top:5px"></label><label>Unternehmen<input name="company" required autocomplete="organization" style="display:block;width:100%;box-sizing:border-box;padding:11px;margin-top:5px"></label><label>E-Mail<input name="email" type="email" required autocomplete="email" style="display:block;width:100%;box-sizing:border-box;padding:11px;margin-top:5px"></label><label>Passwort<input name="password" type="password" minlength="10" required autocomplete="new-password" style="display:block;width:100%;box-sizing:border-box;padding:11px;margin-top:5px"></label><button style="padding:12px;border:0;border-radius:8px;background:#17343d;color:#fff;font-weight:700">Konto anlegen</button></form></div><p id="cloudAuthMessage" style="min-height:22px;margin:18px 0 0;color:#b42318">${escapeHtml(message)}</p></section></main>`;
  const output=document.querySelector('#cloudAuthMessage');
  document.querySelector('#cloudLogin')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    output.textContent='Anmeldung wird geprüft …';
    const {error}=await client.auth.signInWithPassword({email:String(form.get('email')||'').trim(),password:String(form.get('password')||'')});
    if(error){output.textContent=error.message;return;}
    location.reload();
  });
  document.querySelector('#cloudSignup')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    output.textContent='Benutzerkonto wird angelegt …';
    const company=String(form.get('company')||'').trim();
    const {data,error}=await client.auth.signUp({
      email:String(form.get('email')||'').trim(),
      password:String(form.get('password')||''),
      options:{emailRedirectTo:location.href,data:{full_name:String(form.get('fullName')||'').trim(),company_name:company,organization_name:company}}
    });
    if(error){output.textContent=error.message;return;}
    output.style.color='#176b3a';
    output.textContent=data.session?'Konto angelegt. Seite wird geöffnet …':'Konto angelegt. Bitte Bestätigungs-E-Mail öffnen.';
    if(data.session)location.reload();
  });
}

function setStatus(text,error=false){
  const badge=document.querySelector('.header-status');
  if(!badge)return;
  badge.innerHTML=`<span class="status-dot"></span>${escapeHtml(text)}`;
  badge.style.color=error?'#b42318':'';
}

async function listRecords(){
  const {data,error}=await client.from('app_records')
    .select('record_key,title,payload,updated_at')
    .eq('organization_id',membership.organization_id)
    .eq('app_key',cfg.appKey)
    .eq('owner_user_id',session.user.id)
    .order('updated_at',{ascending:false});
  if(error)throw error;
  return data||[];
}

function renderProjectPicker(records){
  const actions=document.querySelector('.header-actions');
  if(!actions)return;
  document.querySelector('#cloudProjectSelect')?.remove();
  const select=document.createElement('select');
  select.id='cloudProjectSelect';
  select.className='button ghost';
  select.title='Gespeicherten Plan öffnen';
  select.innerHTML='<option value="">Meine Pläne</option>'+records.map(row=>`<option value="${escapeHtml(row.record_key)}" ${row.record_key===currentRecordKey?'selected':''}>${escapeHtml(row.title||'Flucht- und Rettungsplan')}</option>`).join('');
  select.addEventListener('change',()=>{
    const selected=records.find(row=>row.record_key===select.value);
    if(!selected)return;
    localStorage.setItem(recordKeyStorage,selected.record_key);
    localStorage.setItem(cfg.storageKey,JSON.stringify(selected.payload||{}));
    location.reload();
  });
  actions.insertBefore(select,actions.firstChild);
}

async function saveCloud(force=false){
  if((saving&&!force)||!membership||!session)return;
  const payload=parseLocal();
  if(!payload)return;
  saving=true;
  setStatus('Wird online gespeichert …');
  try{
    const row={
      organization_id:membership.organization_id,
      app_key:cfg.appKey,
      record_key:currentRecordKey,
      title:titleOf(payload),
      payload,
      owner_user_id:session.user.id,
      updated_by:session.user.id
    };
    const {error}=await client.from('app_records').upsert(row,{onConflict:'organization_id,app_key,owner_user_id,record_key'});
    if(error)throw error;
    setStatus('Online gespeichert ✓');
  }catch(error){
    console.error(error);
    setStatus('Online-Speicherung fehlgeschlagen',true);
  }finally{saving=false;}
}

function hookStorage(){
  const original=Storage.prototype.setItem;
  if(original.__frpCloudWrapped)return;
  function wrapped(key,value){
    original.call(this,key,value);
    if(this===localStorage&&key===cfg.storageKey){
      clearTimeout(saveTimer);
      saveTimer=setTimeout(()=>saveCloud(false),700);
    }
  }
  wrapped.__frpCloudWrapped=true;
  Storage.prototype.setItem=wrapped;
}

export async function prepare(){
  if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){renderBlocked();return false;}
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.45.4');
  client=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  session=data.session;
  if(!session){renderAuth();return false;}
  const {data:member,error:memberError}=await client.from('organization_members')
    .select('organization_id,role,organizations(name)')
    .eq('user_id',session.user.id).eq('status','active').limit(1).maybeSingle();
  if(memberError)throw memberError;
  if(!member){renderAuth('Für dieses Konto ist kein aktiver Firmenbereich vorhanden.');return false;}
  membership=member;

  const records=await listRecords();
  const storedKey=localStorage.getItem(recordKeyStorage);
  const selected=records.find(row=>row.record_key===storedKey)||records[0]||null;
  if(selected){
    currentRecordKey=selected.record_key;
    localStorage.setItem(recordKeyStorage,currentRecordKey);
    localStorage.setItem(cfg.storageKey,JSON.stringify(selected.payload||{}));
  }else{
    currentRecordKey=crypto.randomUUID();
    localStorage.setItem(recordKeyStorage,currentRecordKey);
  }

  hookStorage();
  document.querySelector('#demoBtn')?.remove();
  document.querySelector('#newPlanBtn')?.addEventListener('click',()=>{
    currentRecordKey=crypto.randomUUID();
    localStorage.setItem(recordKeyStorage,currentRecordKey);
  },{capture:true});
  document.querySelector('#projectUpload')?.addEventListener('change',()=>{
    currentRecordKey=crypto.randomUUID();
    localStorage.setItem(recordKeyStorage,currentRecordKey);
  },{capture:true});
  document.querySelector('#saveBtn')?.addEventListener('click',()=>setTimeout(()=>saveCloud(true),0));

  setStatus(`Online · ${member.organizations?.name||'Organisation'}`);
  renderProjectPicker(records);
  const actions=document.querySelector('.header-actions');
  if(actions){
    const logout=document.createElement('button');
    logout.className='button ghost';logout.textContent='Abmelden';
    logout.addEventListener('click',async()=>{await client.auth.signOut({scope:'local'});location.reload();});
    actions.appendChild(logout);
  }
  if(!selected&&parseLocal())setTimeout(()=>saveCloud(true),0);
  return true;
}
