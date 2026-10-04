/* ---------- Navigate: data-driven triage ---------- */
function getGlobalFlags() {
  return [
    t("flagChest"),
    t("flagStroke"),
    t("flagBreathing"),
    t("flagBleeding"),
    t("flagSeizure"),
    t("flagHarm")
  ];
}/* NOTE: door names/availability vary by region. Have a BC clinician review all clinical content before launch. */
const CATS={
 eye:{icon:"👁️",name:"Eye problem",hint:"Red, swollen, painful, crusty eye",
  flags:["Sudden loss of vision","Chemical splashed in the eye","Something stuck in the eye or an eye injury","Severe eye pain with nausea or vomiting"],
  best:"Optometrist (same-day, call first)",why:"BC optometrists examine urgent eye problems such as infections and scratches. Many take same-day visits. Coverage varies, so ask when you call.",
  alt:["Pharmacist: can assess pink eye (conjunctivitis) as a minor ailment","Urgent & Primary Care Centre (UPCC) if no optometrist is available","Call 8-1-1 to talk to a nurse"],
  worse:["Your vision becomes blurry or drops","Pain gets worse","The eyelid swells shut or the redness spreads to the face"]},
 cold:{icon:"🤧",name:"Cough, cold, fever",hint:"Sore throat, congestion, mild fever",
  flags:["Struggling to breathe or blue lips","Baby under 3 months with a fever","Confusion or very hard to wake","Fever over 3 days or not coming down"],
  best:"Pharmacist or family doctor / walk-in clinic",why:"Most colds and sore throats can be assessed in the community. A pharmacist can advise on symptom relief and when to see a doctor.",
  alt:["Call 8-1-1 for nurse advice","UPCC or walk-in clinic for a same-day exam","Virtual care visit (phone or video)"],
  worse:["Breathing becomes difficult","Chest pain with breathing","You cannot keep fluids down for a day"]},
 injury:{icon:"🩹",name:"Sprain, fall, or cut",hint:"Swelling, limping, cut that may need stitches",
  flags:["Bone visible or limb looks badly out of shape","Limb is numb, pale or cold","Head injury with vomiting, confusion or drowsiness","Cut will not stop bleeding after 10 minutes of pressure"],
  best:"Urgent & Primary Care Centre (UPCC) or urgent care clinic",why:"Many UPCCs can do X-rays, stitches and splints the same day, usually with shorter lines than an ER. Not every community has one, so check what is near you.",
  alt:["Walk-in clinic for minor sprains and small cuts","Call 8-1-1 if unsure"],
  worse:["Numbness or colour change in the limb","Pain becomes severe","A cut shows spreading redness, pus or fever"]},
 skin:{icon:"💊",name:"Rash, urinary burning, minor infection",hint:"Uncomplicated UTI, eczema, cold sore",
  flags:["Swelling of the face, lips or throat","Fever with shaking chills and back or side pain","Red streaks spreading from a wound","Rash with trouble breathing"],
  best:"Pharmacist (minor ailments service)",why:"In BC, pharmacists can assess and prescribe for a list of minor ailments, including uncomplicated urinary infections, cold sores and some rashes. Bring your BC Services Card or ask about coverage.",
  alt:["Walk-in clinic or virtual visit if the pharmacist refers you","Call 8-1-1"],
  worse:["Fever or back pain starts","Symptoms do not improve in 2–3 days","The rash spreads quickly"]},
 dental:{icon:"🦷",name:"Tooth or mouth pain",hint:"Toothache, broken tooth, swollen gum",
  flags:["Swelling spreading to the eye, jaw or neck","Trouble swallowing or breathing","Heavy bleeding after an injury to the mouth"],
  best:"Dentist (call and say it is urgent)",why:"Many dental offices keep same-day emergency slots. Ask about the Canadian Dental Care Plan if you do not have insurance.",
  alt:["Pharmacist for temporary pain relief advice","Call 8-1-1","Hospital ER only if swelling is spreading or you have a fever"],
  worse:["Face swelling grows","Fever starts","You cannot open your mouth or swallow"]},
 stomach:{icon:"🤢",name:"Stomach / abdominal problem",hint:"Stomach pain, vomiting, diarrhea, constipation",
  flags:["Severe or worsening abdominal pain","Vomiting blood or black stools","Cannot keep fluids down and feel faint","Pregnant with severe abdominal pain or heavy bleeding"],
  best:"Family doctor / walk-in clinic or UPCC",why:"Most non-emergency stomach problems can start with primary or urgent care. Severe pain, dehydration or bleeding needs urgent assessment.",
  alt:["Pharmacist for mild symptom advice","Call 8-1-1 if unsure","ER if pain is severe, sudden or associated with bleeding or fainting"],
  worse:["Pain becomes severe or localized","You become dehydrated or faint","You see blood in vomit or stool"]},
 neuro:{icon:"🤕",name:"Headache / dizziness",hint:"Headache, vertigo, lightheadedness, faint feeling",
  flags:["Sudden worst headache of your life","New weakness, facial droop or trouble speaking","Headache after a major head injury","Fainting with chest pain or ongoing confusion"],
  best:"Family doctor / walk-in clinic or UPCC",why:"Most headaches and dizziness can be assessed in primary care, but sudden neurological symptoms need emergency care.",
  alt:["Call 8-1-1 for nurse advice","Pharmacist for medication-related dizziness","ER for sudden severe neurological symptoms"],
  worse:["You develop weakness or trouble speaking","The headache becomes sudden and severe","You pass out or cannot walk safely"]},
 ent:{icon:"👂",name:"Ear / nose / throat",hint:"Ear pain, nosebleed, sore throat, sinus pressure",
  flags:["Trouble breathing or swallowing","Heavy nosebleed that will not stop","Severe swelling of the throat or neck","High fever with severe neck stiffness"],
  best:"Pharmacist or family doctor / walk-in clinic",why:"Many common ear, nose and throat problems can be assessed in the community. Severe bleeding, breathing or swallowing problems need urgent care.",
  alt:["Call 8-1-1","UPCC for same-day assessment if symptoms are worsening","ER for severe airway or bleeding concerns"],
  worse:["Swelling spreads","You cannot swallow fluids","Bleeding does not stop"]},
 musculoskeletal:{icon:"🦴",name:"Back / muscle / joint pain",hint:"Back pain, muscle strain, sore joint, stiffness",
  flags:["New loss of bladder or bowel control","Numbness in the groin area","Limb is cold, pale or suddenly weak","Severe pain after a major fall or accident"],
  best:"Family doctor / walk-in clinic or physiotherapy",why:"Most non-emergency muscle, joint and back problems can begin with primary care or a musculoskeletal provider.",
  alt:["UPCC if pain is severe or you cannot move safely","Pharmacist for pain-relief advice","Call 8-1-1 if unsure"],
  worse:["You develop weakness or numbness","You cannot walk safely","Pain follows a major injury"]},
 breathing:{icon:"🫁",name:"Breathing / asthma problem",hint:"Wheezing, shortness of breath, asthma flare",
  flags:["Severe trouble breathing","Blue lips or face","Cannot speak in full sentences because of breathlessness","Breathing trouble with chest pain or fainting"],
  best:"UPCC or family doctor / walk-in clinic",why:"Mild breathing problems can be assessed urgently in the community, but severe breathing difficulty is an emergency.",
  alt:["Call 8-1-1","Use your prescribed rescue inhaler as directed if you have one","ER for severe breathing trouble"],
  worse:["Breathing gets harder","You need your rescue inhaler more often","You feel faint or develop chest pain"]},
 pregnancy:{icon:"🤰",name:"Pregnancy / sexual health",hint:"Pregnancy concerns, bleeding, contraception, STI questions",
  flags:["Heavy vaginal bleeding","Severe one-sided abdominal pain in pregnancy","Fainting during pregnancy","Possible pregnancy with severe pain and bleeding"],
  best:"Family doctor, sexual health clinic or maternity care provider",why:"Pregnancy and sexual health concerns are usually handled by primary care, sexual health clinics or maternity providers unless there are emergency warning signs.",
  alt:["Pharmacist for contraception or medication questions","Call 8-1-1","ER for heavy bleeding, severe pain or fainting"],
  worse:["Bleeding increases","Pain becomes severe","You become dizzy or faint"]},
 mental:{icon:"💬",name:"Stress, low mood, crisis",hint:"Feeling overwhelmed, anxious or unsafe",
  flags:["You are thinking about ending your life right now","You are in danger of harming someone"],
  best:"Call or text 9-8-8 (Suicide Crisis Helpline, any time)",why:"Trained responders are available 24/7. You do not need a diagnosis to call. Interpreters may be available.",
  alt:["Family doctor or walk-in clinic for a longer-term plan","Call 8-1-1 for help finding services","Community or settlement organizations"],
  worse:["You feel unsafe","You have a plan to hurt yourself"]},
 meds:{icon:"📋",name:"Prescription refill or medicine question",hint:"Running out, side effects, how to take it",
  flags:["Swelling of the face or throat after a medicine","Trouble breathing after a medicine","Possible overdose (call Poison Control 1-800-567-8911 and 9-1-1)"],
  best:"Your pharmacist",why:"Pharmacists can answer medicine questions and, in many cases, renew or adjust ongoing prescriptions in BC.",
  alt:["Call 8-1-1 and ask for a pharmacist","Your doctor or walk-in clinic for a new prescription"],
  worse:["You have a bad reaction","You cannot keep your medicine down"]}
};
let st={step:'g',cat:null,res:null};

function checklist(title,items,onYes,onNo){
  $('flow').innerHTML=`<h2>${esc(title)}</h2><p class="sub">${esc(t("chooseAny"))}</p>`+
   items.map((x,i)=>`<label class="chk"><input type="checkbox" value="${i}"><span>${esc(x)}</span></label>`).join('')+
   `<button class="btn" id="yes" style="background:var(--red)">${esc(t('anyflag'))}</button><button class="btn" id="no">${esc(t('none'))}</button>`;
  $('yes').onclick=()=>{ if(document.querySelector('#flow input:checked'))onYes(); else $('yes').textContent=t("selectOneFirst"); };
  $('no').onclick=onNo; }

function emergency(){
  st.res={urgent:true};
  $('flow').innerHTML=`<div class="res urgent" role="alert">
    <h3>🚨 Call 9-1-1 or go to the nearest ER now</h3>
    <p>Do not drive yourself. Tell the operator your location and what is happening.</p>
    <p style="margin-top:.6rem"><strong>If you are thinking about suicide:</strong> call or text <strong>9-8-8</strong> any time, or 9-1-1 if you are in immediate danger.</p>
    <a class="btn" href="tel:911" style="display:inline-block;text-decoration:none">Call 9-1-1</a>
    <button class="btn g" id="rs">${esc(t('back'))}</button>
    ${nearbyShell('Emergency department',true)}
  </div>`;
  $('findCare').onclick=()=>findNearbyCare('Emergency department');
  $('rs').onclick=()=>{st={step:'g'};navRender()};
}

function result(k){
  const c=CATS[k];
  $('flow').innerHTML=`<div class="res ok">
    <h3>${c.icon} ${esc(c.best)}</h3>
    <p>${esc(c.why)}</p>
    <h4>${esc(t('alt'))}</h4>
    <ul>${c.alt.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>
    <h4>${esc(t('worse'))}</h4>
    <ul>${c.worse.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>
    <p class="note">Wait times change by day and location. CarePath only links to verified wait-time information when available. Call 8-1-1 if you are unsure where to go. This tool does not diagnose.</p>
    ${nearbyShell(c.best)}
    <button class="btn" id="go">${esc(t('next'))}</button>
    <button class="btn g" id="rs">${esc(t('back'))}</button>
  </div>`;
  $('findCare').onclick=()=>findNearbyCare(c.best);
  $('go').onclick=()=>{
    $('f_where').value=c.best.split(' (')[0];
    $('f_story').placeholder=c.name+": ";
    store.set('episode',{cat:c.name,door:c.best,date:new Date().toISOString()});
    log('Triage: '+c.name+' → '+c.best);
    openTab('communicate');
  };
  $('rs').onclick=()=>{st={step:'g'};navRender()};
}

function navRender(){
  if(st.step==='g')return checklist(t('q0'),getGlobalFlags(),emergency,()=>{st.step=st.cat?'f':'c';navRender()});
  if(st.step==='c'){
    $('flow').innerHTML=`<h2>${esc(t('pick'))}</h2><p class="sub">${esc(t('chooseList'))}</p>
      <div class="nav-layout">
        <div>
          <div class="grid">`+
            Object.entries(CATS).map(([k,c])=>{const ct=catText(k,c);return `<button class="opt" data-k="${k}"><strong>${c.icon} ${esc(ct.name)}</strong><small>${esc(ct.hint)}</small></button>`}).join('')+
            `<button class="opt chat-start" id="startChat">
              <strong>💬 ${esc(t('notListed'))}</strong>
              <small>${esc(t('notListedSub'))}</small>
            </button>
          </div>
          <button class="btn g" id="rs">${esc(t('back'))}</button>
        </div>

        <aside class="body-widget" aria-label="Quick body navigator">
          <h3>🧍 ${esc(t('bodyTitle'))}</h3>
          <p>${esc(t('bodySub'))}</p>

          <div class="body-figure">
            <svg class="body-svg" viewBox="0 0 180 360" role="img" aria-label="Clickable body map">
              <title>Clickable body map</title>

              <!-- base human silhouette -->
              <circle class="body-silhouette" cx="90" cy="34" r="22"/>
              <rect class="body-silhouette" x="74" y="55" width="32" height="18" rx="10"/>
              <path class="body-silhouette" d="M62 72 Q90 60 118 72 L125 155 Q120 190 112 212 L108 340 H87 L82 220 H78 L73 340 H52 L57 212 Q50 190 55 155 Z"/>
              <path class="body-silhouette" d="M60 78 L39 105 L23 182 L35 186 L53 121 L67 102 Z"/>
              <path class="body-silhouette" d="M120 78 L141 105 L157 182 L145 186 L127 121 L113 102 Z"/>

              <!-- clickable hotspots -->
              <circle class="body-hotspot" data-body="head" tabindex="0" cx="90" cy="34" r="24"/>
              <text class="body-label" x="90" y="37">HEAD</text>

              <path class="body-hotspot" data-body="chest" tabindex="0"
                    d="M61 77 Q90 65 119 77 L121 132 Q90 145 59 132 Z"/>
              <text class="body-label" x="90" y="108">CHEST</text>

              <path class="body-hotspot" data-body="stomach" tabindex="0"
                    d="M59 133 Q90 145 121 133 L119 188 Q90 201 61 188 Z"/>
              <text class="body-label" x="90" y="165">ABDOMEN</text>

              <path class="body-hotspot" data-body="arm" tabindex="0"
                    d="M59 80 L39 106 L23 182 L36 186 L53 122 L68 101 Z"/>
              <path class="body-hotspot" data-body="arm" tabindex="0"
                    d="M121 80 L141 106 L157 182 L144 186 L127 122 L112 101 Z"/>
              <text class="body-label" x="30" y="142">ARM</text>
              <text class="body-label" x="150" y="142">ARM</text>

              <path class="body-hotspot" data-body="leg" tabindex="0"
                    d="M60 187 L86 190 L82 340 H52 L57 212 Z"/>
              <path class="body-hotspot" data-body="leg" tabindex="0"
                    d="M94 190 L120 187 L123 212 L128 340 H98 Z"/>
              <text class="body-label" x="68" y="275">LEG</text>
              <text class="body-label" x="112" y="275">LEG</text>
            </svg>
          </div>

          <div class="body-popover" id="bodyPopover" role="dialog" aria-live="polite"></div>

          <div class="body-map">
            <button class="body-btn" data-body="head"><strong>👁️ Head / face</strong><small>${esc(t('closestSub'))}</small></button>
            <button class="body-btn" data-body="chest"><strong>🫁 Chest / breathing</strong><small>${esc(t('closestSub'))}</small></button>
            <button class="body-btn" data-body="stomach"><strong>🤢 Stomach / pelvis</strong><small>${esc(t('closestSub'))}</small></button>
            <button class="body-btn" data-body="arm"><strong>🖐 Arms / hands</strong><small>${esc(t('closestSub'))}</small></button>
            <button class="body-btn" data-body="leg"><strong>🦵 Legs / feet</strong><small>${esc(t('closestSub'))}</small></button>
            <button class="body-btn" data-body="general"><strong>❓ Whole body / not sure</strong><small>${esc(t('notListedSub'))}</small></button>
          </div>
        </aside>
      </div>`;

    document.querySelectorAll('.opt[data-k]').forEach(b=>b.onclick=()=>{
      st.cat=b.dataset.k;
      st.step='f';
      navRender();
    });

    const bodyRoutes={
      head:["eye","ent","neuro","dental"],
      chest:["cold","breathing"],
      stomach:["stomach","skin","pregnancy"],
      arm:["injury","skin","musculoskeletal"],
      leg:["injury","skin","musculoskeletal"],
      general:["meds","mental","cold"]
    };

    const bodyNames={
      head:"Head / face",
      chest:"Chest / breathing",
      stomach:"Stomach / pelvis",
      arm:"Arm / hand",
      leg:"Leg / foot",
      general:"Whole body / not sure"
    };

    const popover=$('bodyPopover');

    function showBodyPopover(el,key){
      const keys=bodyRoutes[key]||[];
      const cards=keys.map(k=>{
        const c=CATS[k],ct=catText(k,c);
        return `<button type="button" data-body-k="${k}">${c.icon} ${esc(ct.name)}</button>`;
      }).join('');

      popover.innerHTML=`
        <strong>${esc(bodyNames[key]||'Choose a problem')}</strong>
        <small>${esc(t('closestSub'))}</small>
        <div class="mini-options">${cards}</div>
      `;

      popover.querySelectorAll('[data-body-k]').forEach(x=>x.onclick=()=>{
        st.cat=x.dataset.bodyK;
        st.step='f';
        navRender();
      });

      document.querySelectorAll('.body-hotspot').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll(`.body-hotspot[data-body="${key}"]`).forEach(x=>x.classList.add('active'));

      // Desktop: position beside the body part
      if(window.innerWidth>980 && el.classList.contains('body-hotspot')){
        const widget=$('bodyPopover').closest('.body-widget');
        const wr=widget.getBoundingClientRect();
        const er=el.getBoundingClientRect();

        let left=er.right-wr.left+10;
        let top=er.top-wr.top;

        if(left+230>wr.width){
          left=er.left-wr.left-240;
        }

        popover.style.left=Math.max(6,left)+'px';
        popover.style.top=Math.max(6,top)+'px';
      }else{
        popover.style.left='';
        popover.style.top='';
      }

      popover.classList.add('show');
    }

    function hideBodyPopoverSoon(){
      setTimeout(()=>{
        if(!popover.matches(':hover') && !document.activeElement?.closest?.('#bodyPopover')){
          popover.classList.remove('show');
          document.querySelectorAll('.body-hotspot').forEach(x=>x.classList.remove('active'));
        }
      },120);
    }

    document.querySelectorAll('.body-hotspot').forEach(b=>{
      const key=b.dataset.body;

      b.addEventListener('mouseenter',()=>showBodyPopover(b,key));
      b.addEventListener('focus',()=>showBodyPopover(b,key));
      b.addEventListener('mouseleave',hideBodyPopoverSoon);

      b.addEventListener('click',e=>{
        e.preventDefault();
        showBodyPopover(b,key);
      });

      b.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          showBodyPopover(b,key);
        }
      });
    });

    popover.addEventListener('mouseleave',hideBodyPopoverSoon);

    // Text fallback buttons still work, especially on mobile.
    document.querySelectorAll('.body-btn[data-body]').forEach(b=>{
      b.onclick=()=>showBodyPopover(b,b.dataset.body);
    });

    $('startChat').onclick=()=>{
      setDock(true);
      if(!$('chatbox').hidden)$('cin').focus();
    };

    $('rs').onclick=()=>{st={step:'g'};navRender()};
    return;
  }
  if(st.step==='f'){const c=CATS[st.cat];
    return checklist(c.name+": "+t('q0'),c.flags,()=>{c.flags.some(f=>/9-8-8|ending your life|overdose/i.test(f))?emergency():emergency()},()=>result(st.cat)); }
}
