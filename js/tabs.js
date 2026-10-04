/* ---------- Tabs ---------- */
function openTab(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id===id));
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===id));
  curTab=id; $('cin').placeholder = getHint(id);
  if(id==='manage')renderMeds(); if(id==='followup')renderTL(); }
$('tabs').onclick = e => {
  const btn = e.target.closest('button[data-tab]');

  if (!btn) return;

  openTab(btn.dataset.tab);
};
