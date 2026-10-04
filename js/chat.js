/* ---------- Ask: AI chat (calls your backend, never the AI API directly) ---------- */
const API_URL=(location.hostname.endsWith('github.io')?'https://legendary-licorice-2161a7.netlify.app':'')+'/.netlify/functions/chat';const URGENT_RE=/chest pain|can'?t breathe|cannot breathe|stroke|overdose|suicid|kill myself|end my life|unconscious|seizure/i;
let chat=[],busy=false,curTab='navigate';
const HINT={navigate:"Describe your symptoms…",communicate:"Ask how to explain your problem…",manage:"Ask about your medication…",followup:"Tell me how you feel today…"};
function setDock(open){$('dockbody').hidden=!open;$('dockbar').setAttribute('aria-expanded',open);$('chev').textContent=open?'▼':'▲';
  if(open&&!$('chatbox').hidden)$('cin').focus()}
$('dockbar').onclick=()=>setDock($('dockbody').hidden);
function addMsg(cls,html){const d=document.createElement('div');d.className='msg '+cls;d.innerHTML=html;$('log').appendChild(d);$('log').scrollTop=1e9;return d}
$('ok').onclick=()=>{$('consent').hidden=true;$('chatbox').hidden=false;
  addMsg('bot','Hello. Tell me what is happening and how long it has been going on. You can write in any language.');$('cin').focus()};
async function send(){
  const text=$('cin').value.trim();if(!text||busy)return;
  $('cin').value='';addMsg('me',esc(text));chat.push({role:'user',content:text});
  if(URGENT_RE.test(text))addMsg('bot sos','This may be an emergency. Call 9-1-1 now. If you are thinking about suicide, call or text 9-8-8. <a class="btn" href="tel:911" style="display:inline-block;text-decoration:none;background:var(--red)">Call 9-1-1</a>');
  busy=true;const w=addMsg('bot','…');
  try{
    const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chat.slice(-10),lang,tab:curTab})});
    if(!r.ok)throw new Error(r.status);
    const d=await r.json();
    chat.push({role:'assistant',content:d.reply});
    w.innerHTML=esc(d.reply).replace(/\n/g,'<br>');
    if(d.urgent&&!URGENT_RE.test(text))addMsg('bot sos','This may be an emergency. Call 9-1-1 now. <a class="btn" href="tel:911" style="display:inline-block;text-decoration:none;background:var(--red)">Call 9-1-1</a>');
    if(!d.urgent&&d.category&&CATS[d.category]){
      const b=document.createElement('button');b.className='btn';b.textContent='Check where to go: '+CATS[d.category].name;
      b.onclick=()=>{st={step:'g',cat:d.category};setDock(false);openTab('navigate');navRender();window.scrollTo({top:0,behavior:'smooth'})};w.appendChild(document.createElement('br'));w.appendChild(b)}
    if(d.summary_en){
      const b=document.createElement('button');b.className='btn g';b.textContent='Use in my provider summary';
      b.onclick=()=>{$('f_story').value=d.summary_en;setDock(false);openTab('communicate');window.scrollTo({top:0,behavior:'smooth'})};w.appendChild(b)}
  }catch(e){
    w.textContent='The assistant is not available right now. Use the Navigate tab, or call 8-1-1 to talk to a nurse.';
  }finally{busy=false}
}
$('snd').onclick=send;
$('cin').onkeydown=e=>{if(e.key==='Enter')send()};
