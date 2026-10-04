/* ---------- Follow up ---------- */
function log(msg){const a=store.get('timeline',[]);a.unshift({m:msg,t:new Date().toLocaleString()});store.set('timeline',a.slice(0,50))}
function renderTL(){const a=store.get('timeline',[]);
  $('tl').innerHTML=a.length?a.map(x=>`<div class="tl"><strong>${esc(x.m)}</strong><small>${esc(x.t)}</small></div>`).join(''):'<p class="sub">Nothing yet. Start with Navigate.</p>'}
document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{
  const s=b.dataset.s;log('Check-in: '+s);renderTL();
  const box=$('fuMsg');
  if(s==='Better')box.innerHTML='<div class="res ok"><strong>Good. Keep finishing your treatment as prescribed.</strong></div>';
  else if(s==='Same')box.innerHTML='<div class="res" style="border-color:#d97706;background:var(--ambbg)"><strong>No change.</strong> If nothing improves in 48 hours, contact your provider or call 8-1-1.</div>';
  else{box.innerHTML='<div class="res urgent"><strong>Getting worse. Re-check where to go.</strong><br><button class="btn" id="rr">Re-route me</button> <a class="btn g" href="tel:811" style="text-decoration:none;display:inline-block">Call 8-1-1</a></div>';
    $('rr').onclick=()=>{st={step:'g'};openTab('navigate');navRender()}}});
