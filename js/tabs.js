/* ---------- Tabs ---------- */
function openTab(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id===id));
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===id));
  curTab=id; $('cin').placeholder=HINT[id]||HINT.navigate;
  if(id==='manage')renderMeds(); if(id==='followup')renderTL(); }
$('tabs').onclick=e=>{if(e.target.dataset.tab)openTab(e.target.dataset.tab)};
