/* ---------- Communicate ---------- */

$('f_sev').oninput = e =>
  $('sevv').textContent =
    e.target.value;


let summaryText = '';


function localSummary() {

  const g =
    id =>
      $(id).value.trim();


  const lines = [

    `${t("commVisitSummary")} (${new Date().toLocaleDateString('en-CA')})`,

    `${t("commSeeing")}: ${g('f_where') || t("commNotStated")}`,

    `${t("commProblem")}: ${g('f_story') || t("commNotStated")}`,

    `${t("commStarted")}: ${$('f_start').value}`,

    `${t("commSeverityLabel")}: ${$('f_sev').value}/10`,

    `${t("commMedsAllergies")}: ${g('f_meds') || t("commNoneStated")}`,

    `${t("commQuestionsLabel")}: ${g('f_q') || t("commNone")}`
  ];


  if (g('f_int')) {

    lines.push(
      `${t("commInterpreterNeeded")}: ${g('f_int')}`
    );
  }


  summaryText =
    lines.join('\n');


  $('sum').textContent =
    summaryText;


  $('say').textContent =
    `"${t("commHello")} ` +
    `${g('f_story') || t("commNeedHelp")} ` +
    `${t("commItStarted")} ${$('f_start').value.toLowerCase()}. ` +
    `${t("commScale")} ${$('f_sev').value}. ` +
    `${g('f_q') ? `${t("commMyQuestion")}: ${g('f_q')}` : ''}"`;


  $('qr').innerHTML = '';


  if (window.QRCode) {

    try {

      new QRCode(
        $('qr'),
        {
          text:
            summaryText.slice(
              0,
              900
            ),

          width: 150,

          height: 150
        }
      );

    } catch {}
  }


  store.set(
    'summary',
    summaryText
  );


  log(
    'Summary created'
  );
}
const SUM_URL =
  (location.hostname.endsWith('github.io')
    ? 'https://legendary-licorice-2161a7.netlify.app'
    : '') +
  '/.netlify/functions/summarize';


function drawQR() {

  $('qr').innerHTML = '';


  if (window.QRCode) {

    try {

      new QRCode(
        $('qr'),
        {
          text:
            summaryText.slice(
              0,
              900
            ),

          width: 150,

          height: 150
        }
      );

    } catch {}
  }
}


$('mk').onclick =
  async () => {

    const g =
      id =>
        $(id).value.trim();


    // Instant basic version
    localSummary();


    if (!g('f_story')) {
      return;
    }


    const btn =
      $('mk');


    btn.disabled =
      true;


    btn.textContent =
      t("commWritingSummary");


    try {

      const r =
        await fetch(
          SUM_URL,
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({

                lang,

                fields: {
                  where:
                    g('f_where'),

                  story:
                    g('f_story'),

                  start:
                    $('f_start').value,

                  severity:
                    $('f_sev').value,

                  meds:
                    g('f_meds'),

                  questions:
                    g('f_q'),

                  interpreter:
                    g('f_int')
                }
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


      summaryText =
        d.summary_en;


      $('sum').textContent =
        summaryText;


      $('say').innerHTML =

        `<strong>${esc(t("commSayInEnglish"))}</strong>` +

        `<br>"${esc(d.script_en || '')}"` +

        (
          d.script_user_lang

            ? `<br><br><strong>${esc(t("commInYourLanguage"))}</strong><br>${esc(d.script_user_lang)}`

            : ''
        );


      drawQR();


      store.set(
        'summary',
        summaryText
      );


      log(
        'AI summary created'
      );

    } catch (e) {

      $('say').textContent +=
        `\n${t("commAiUnavailable")}`;

    } finally {

      btn.disabled =
        false;


      btn.textContent =
        t("commMakeSummary");
    }
  };


$('cp').onclick =
  () => {

    if (!summaryText) {
      return;
    }


    navigator
      .clipboard
      ?.writeText(
        summaryText
      )
      .then(
        () =>
          $('cp').textContent =
            t("commCopied")
      );
  };


$('pr').onclick =
  () =>
    window.print();
