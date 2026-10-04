/* ---------- Ask: AI chat (calls your backend, never the AI API directly) ---------- */

const API_URL =
  '/.netlify/functions/chat';


const URGENT_RE =
  /chest pain|can'?t breathe|cannot breathe|stroke|overdose|suicid|kill myself|end my life|unconscious|seizure/i;


let chat = [];
let busy = false;
let curTab = 'navigate';


function getHint(id) {

  const hints = {
    navigate:
      t("chatHintNavigate"),

    communicate:
      t("chatHintCommunicate"),

    manage:
      t("chatHintManage"),

    followup:
      t("chatHintFollowup")
  };


  return (
    hints[id] ||
    hints.navigate
  );
}


function setDock(open) {

  $('dockbody').hidden =
    !open;


  $('dockbar').setAttribute(
    'aria-expanded',
    open
  );


  $('chev').textContent =
    open
      ? '▼'
      : '▲';


  if (
    open &&
    !$('chatbox').hidden
  ) {

    $('cin').focus();
  }
}


$('dockbar').onclick =
  () =>
    setDock(
      $('dockbody').hidden
    );


function addMsg(
  cls,
  html
) {

  const d =
    document.createElement(
      'div'
    );


  d.className =
    'msg ' + cls;


  d.innerHTML =
    html;


  $('log').appendChild(
    d
  );


  $('log').scrollTop =
    1e9;


  return d;
}


$('ok').onclick =
  () => {

    $('consent').hidden =
      true;


    $('chatbox').hidden =
      false;


    addMsg(
      'bot',
      esc(
        t("chatGreeting")
      )
    );


    $('cin').focus();
  };


async function send() {

  const text =
    $('cin')
      .value
      .trim();


  if (
    !text ||
    busy
  ) {

    return;
  }


  $('cin').value =
    '';


  addMsg(
    'me',
    esc(text)
  );


  chat.push({
    role:
      'user',

    content:
      text
  });


  // -----------------------------------
  // Immediate emergency keyword check
  // -----------------------------------

  if (
    URGENT_RE.test(
      text
    )
  ) {

    addMsg(
      'bot sos',

      `${esc(t("chatEmergency"))} ` +

      `${esc(t("chatSuicideEmergency"))} ` +

      `<a
        class="btn"
        href="tel:911"
        style="
          display:inline-block;
          text-decoration:none;
          background:var(--red);
        "
      >
        ${esc(t("chatCall911"))}
      </a>`
    );
  }


  busy =
    true;


  const w =
    addMsg(
      'bot',
      '…'
    );


  try {

    const r =
      await fetch(
        API_URL,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({

              messages:
                chat.slice(
                  -10
                ),

              lang,

              tab:
                curTab
            })
        }
      );


    if (!r.ok) {

      throw new Error(
        r.status
      );
    }


    const d =
      await r.json();


    chat.push({
      role:
        'assistant',

      content:
        d.reply
    });


    w.innerHTML =
      esc(
        d.reply
      )
      .replace(
        /\n/g,
        '<br>'
      );


    // -----------------------------------
    // AI says emergency
    // -----------------------------------

    if (
      d.urgent &&
      !URGENT_RE.test(
        text
      )
    ) {

      addMsg(
        'bot sos',

        `${esc(t("chatEmergency"))} ` +

        `<a
          class="btn"
          href="tel:911"
          style="
            display:inline-block;
            text-decoration:none;
            background:var(--red);
          "
        >
          ${esc(t("chatCall911"))}
        </a>`
      );
    }


    // -----------------------------------
    // Suggested navigation category
    // -----------------------------------

    if (
      !d.urgent &&
      d.category &&
      CATS[d.category]
    ) {

      const b =
        document.createElement(
          'button'
        );


      b.className =
        'btn';


      const categoryText =
        catText(
          d.category,
          CATS[d.category]
        );


      b.textContent =
        `${t("chatCheckWhere")}: ${categoryText.name}`;


      b.onclick =
        () => {

          st = {
            step:
              'g',

            cat:
              d.category
          };


          setDock(
            false
          );


          openTab(
            'navigate'
          );


          navRender();


          window.scrollTo({
            top:
              0,

            behavior:
              'smooth'
          });
        };


      w.appendChild(
        document.createElement(
          'br'
        )
      );


      w.appendChild(
        b
      );
    }


    // -----------------------------------
    // Provider summary button
    // -----------------------------------

    if (
      d.summary_en
    ) {

      const b =
        document.createElement(
          'button'
        );


      b.className =
        'btn g';


      b.textContent =
        t(
          "chatUseProviderSummary"
        );


      b.onclick =
        () => {

          $('f_story').value =
            d.summary_en;


          setDock(
            false
          );


          openTab(
            'communicate'
          );


          window.scrollTo({
            top:
              0,

            behavior:
              'smooth'
          });
        };


      w.appendChild(
        b
      );
    }

  } catch (e) {

    w.textContent =
      t(
        "chatUnavailable"
      );

  } finally {

    busy =
      false;
  }
}


$('snd').onclick =
  send;


$('cin').onkeydown =
  e => {

    if (
      e.key ===
      'Enter'
    ) {

      send();
    }
  };