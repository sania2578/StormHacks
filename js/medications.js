/* ---------- Manage ---------- */
function renderMeds(){
  const m=store.get('meds',[]);
  $('meds').innerHTML=m.length?m.map((x,i)=>`<div class="med"><strong>${esc(x.n)}</strong><div>${esc(x.d)}</div>
   <button class="btn" data-a="Taken" data-i="${i}" style="padding:.35rem .8rem">Taken</button><button class="btn g" data-a="Skipped" data-i="${i}" style="padding:.35rem .8rem">Skip</button><button class="btn g" data-a="Later" data-i="${i}" style="padding:.35rem .8rem">Later</button>
   <div class="log">${x.l?esc(x.l):''}</div></div>`).join(''):'<p class="sub">No medications yet.</p>';
  $('meds').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const arr=store.get('meds',[]);arr[b.dataset.i].l=`${b.dataset.a} at ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
    store.set('meds',arr);log(`${arr[b.dataset.i].n}: ${b.dataset.a}`);renderMeds()}); }
$('m_add').onclick=()=>{const n=$('m_name').value.trim(),d=$('m_dose').value.trim();if(!n)return;
  const a=store.get('meds',[]);a.push({n,d});store.set('meds',a);$('m_name').value=$('m_dose').value='';renderMeds()};
