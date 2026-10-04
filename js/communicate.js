/* ---------- Communicate ---------- */
$('f_sev').oninput=e=>$('sevv').textContent=e.target.value;
let summaryText='';
function localSummary(){
  const g=id=>$(id).value.trim();
  const lines=[`Visit summary (${new Date().toLocaleDateString('en-CA')})`,
   `Seeing: ${g('f_where')||'not stated'}`,`Problem: ${g('f_story')||'not stated'}`,
   `Started: ${$('f_start').value}`,`Severity: ${$('f_sev').value}/10`,
   `Medications/allergies: ${g('f_meds')||'none stated'}`,`Questions: ${g('f_q')||'none'}`];
  if(g('f_int'))lines.push(`Interpreter needed: ${g('f_int')}`);
  summaryText=lines.join('\n'); $('sum').textContent=summaryText;
  $('say').textContent=`"Hello. ${g('f_story')||'I need help.'} It started ${$('f_start').value.toLowerCase()}. On a scale of 1 to 10 it is a ${$('f_sev').value}. ${g('f_q')?'My question is: '+g('f_q'):''}"`;
  $('qr').innerHTML='';
  if(window.QRCode){try{new QRCode($('qr'),{text:summaryText.slice(0,900),width:150,height:150})}catch{}}
  store.set('summary',summaryText); log('Summary created');
}
const SUM_URL='/.netlify/functions/summarize';
function drawQR(){$('qr').innerHTML='';if(window.QRCode){try{new QRCode($('qr'),{text:summaryText.slice(0,900),width:150,height:150})}catch{}}}
$('mk').onclick=async()=>{
  const g=id=>$(id).value.trim();
  localSummary(); // instant basic version, replaced if the AI answers
  if(!g('f_story'))return;
  const btn=$('mk');btn.disabled=true;btn.textContent='Writing your summary…';
  try{
    const r=await fetch(SUM_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      lang,fields:{where:g('f_where'),story:g('f_story'),start:$('f_start').value,severity:$('f_sev').value,meds:g('f_meds'),questions:g('f_q'),interpreter:g('f_int')}})});
    if(!r.ok)throw new Error(r.status);
    const d=await r.json();
    summaryText=d.summary_en;$('sum').textContent=summaryText;
    $('say').innerHTML='<strong>Say in English:</strong><br>"'+esc(d.say_en)+'"'+
      (d.say_native?'<br><br><strong>'+esc(d.label_native||'In your language:')+'</strong><br>'+esc(d.say_native):'');
    drawQR();store.set('summary',summaryText);log('AI summary created');
  }catch(e){
    $('say').textContent+='\n(The AI summary is not available right now. This is a basic version of what you typed.)';
  }finally{btn.disabled=false;btn.textContent='Make my summary'}
};
$('cp').onclick=()=>{if(summaryText)navigator.clipboard?.writeText(summaryText).then(()=>$('cp').textContent='Copied')};
$('pr').onclick=()=>window.print();
