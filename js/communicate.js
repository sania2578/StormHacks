/* ===================================
   Communicate (summary feature)
   ===================================

   When the person presses "Make my summary":
     1. The form answers are sent to the AI (netlify/functions/summarize.js)
     2. The page shows:
          - Provider summary          (English, for the doctor)
          - Summary in your language  (for the patient to check)
          - Say in English            (polished paragraph, always English)
          - the same paragraph in the patient's language
*/


/* -----------------------------------
   Settings
   ----------------------------------- */

// On GitHub Pages the functions live on Netlify, so we need the full address.
// On Netlify itself, the short address works.
const SUM_SITE = 'https://legendary-licorice-2161a7.netlify.app';

// Relative address only works when the page itself is served by Netlify
// (or by "netlify dev" on port 8888). Anywhere else, use the full address.
const SUM_ON_NETLIFY =
  location.hostname.endsWith('.netlify.app') || location.port === '8888';

const SUM_URL = (SUM_ON_NETLIFY ? '' : SUM_SITE) + '/.netlify/functions/summarize';

// The "When did it start?" options show translated text, but the AI needs the
// English wording. These are in the same order as the <option> list.
const START_EN = ['Today', '1–2 days ago', '3–7 days ago', 'More than a week ago'];

const STORY_MAX_LENGTH = 3000;

// The latest results, used by the Copy button
let summaryText = '';
let sayText = '';


/* -----------------------------------
   Small helper: read a form field
   ----------------------------------- */

function commVal(id) {

  return $(id).value.trim();
}


/* ===================================
   Small additions that need no HTML changes
   =================================== */

// Limit and counter for the "What is happening?" box
$('f_story').maxLength = STORY_MAX_LENGTH;

$('f_story').insertAdjacentHTML(
  'afterend',
  '<div class="note" id="storyCount" style="margin-top:.25rem">0 / ' + STORY_MAX_LENGTH + '</div>'
);

$('f_story').addEventListener('input', () => {

  $('storyCount').textContent =
    $('f_story').value.length + ' / ' + STORY_MAX_LENGTH;
});


// Show the slider number (for example "5/10")
$('f_sev').oninput = event => {

  $('sevv').textContent = event.target.value;
};


// A second box for the summary in the patient's own language
$('sum').insertAdjacentHTML(
  'afterend',
  '<label id="sumNativeLabel" style="display:none"></label>'
  + '<div class="paper" id="sumNative" style="display:none"></div>'
);


/* ===================================
   Display helpers
   =================================== */

// Draw the QR code from the English summary
function drawQR() {

  $('qr').innerHTML = '';

  if (window.QRCode && summaryText) {

    try {

      new QRCode($('qr'), {
        text: summaryText.slice(0, 900),
        width: 150,
        height: 150
      });

    } catch {
      // The QR code is optional, so ignore errors
    }
  }
}


// Show or hide the "summary in your language" box
function commShowNative(show) {

  $('sumNative').style.display = show ? '' : 'none';

  $('sumNativeLabel').style.display = show ? '' : 'none';
}


// Show a clear message and clear old results,
// so stale or half-translated text is never left on screen
function commError(message) {

  summaryText = '';
  sayText = '';
  lastResult = null;

  $('sum').textContent = message;

  commShowNative(false);

  $('say').textContent = '';

  $('qr').innerHTML = '';
}


// Basic English-only version.
// Only used if the AI is down AND everything typed is plain English.
function basicSummary() {

  function orNotProvided(value) {

    return value || 'Not provided';
  }

  const lines = [

    'Visit summary (' + new Date().toLocaleDateString('en-CA') + ') - basic version, not checked by AI',

    'Seeing: ' + orNotProvided(commVal('f_where')),

    'Problem: ' + orNotProvided(commVal('f_story')),

    'Started: ' + $('f_start').value,

    'Severity: ' + $('f_sev').value + '/10',

    'Medications/allergies: ' + orNotProvided(commVal('f_meds')),

    'Questions: ' + orNotProvided(commVal('f_q')),

    'Interpreter: ' + orNotProvided(commVal('f_int'))
  ];

  return lines.join('\n');
}


// The latest AI answer, kept so a language switch can redraw it
let lastResult = null;

// Show the AI's answer on screen (no saving, no logging)
function commShow(data) {

  const summaryText = data.summary_en;

  // 1. English summary (for the doctor)
  $('sum').textContent = summaryText;


  // 2. Summary in the patient's language (only if they are not using English)
  const hasNative = !!data.summary_native;

  $('sumNativeLabel').textContent =
    data.summary_label_native || 'Your summary, in your language:';

  $('sumNative').textContent =
    hasNative ? data.summary_native : '';

  commShowNative(hasNative);


  // 3. Always English first, then the patient's language,
  //    so they know what they are showing
  let sayHtml =
    '<strong>Say in English:</strong><br>'
    + esc(data.say_en).replace(/\n/g, '<br>');

  if (data.say_native) {

    sayHtml +=
      '<br><br><strong>'
      + esc(data.label_native || 'In your language:')
      + '</strong><br>'
      + esc(data.say_native).replace(/\n/g, '<br>');
  }

  $('say').innerHTML = sayHtml;
}


// Show the AI's answer, then save it
function commRender(data) {

  summaryText = data.summary_en;

  sayText = data.say_en;

  lastResult = data;

  commShow(data);


  // QR code and saving
  drawQR();

  store.set('summary', summaryText);

  if (typeof log === 'function') {
    log('AI summary created');
  }
}


/* ===================================
   "Make my summary" button
   =================================== */

$('mk').onclick = async () => {

  // -----------------------------------
  // The main story is required
  // -----------------------------------

  const story = commVal('f_story');

  if (!story) {

    commError('Please describe what is happening first, then press "Make my summary".');

    $('f_story').focus();

    return;
  }


  // -----------------------------------
  // Show that we are working
  // -----------------------------------

  const button = $('mk');

  button.disabled = true;

  button.textContent = 'Writing your summary…';

  commError('Writing your summary…');


  try {

    // -----------------------------------
    // Send the form to the AI
    // -----------------------------------

    const response = await fetch(SUM_URL, {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({

        lang: lang,

        fields: {
          where: commVal('f_where'),
          story: story,
          start: START_EN[$('f_start').selectedIndex] || '',
          severity: $('f_sev').value,
          meds: commVal('f_meds'),
          questions: commVal('f_q'),
          interpreter: commVal('f_int')
        }
      })
    });


    // -----------------------------------
    // Read the answer
    // -----------------------------------

    let data = {};

    try {

      data = await response.json();

    } catch {
      // The server did not send JSON (for example a login page)
    }

    if (!response.ok) {

      const error = new Error(data.error || String(response.status));

      error.status = response.status;

      throw error;
    }

    if (!data.summary_en || !data.say_en) {

      throw new Error('The AI answer was empty');
    }


    // -----------------------------------
    // Show it
    // -----------------------------------

    commRender(data);

    button.textContent = 'Make my summary';


  } catch (error) {

    // Details for developers (browser console)
    console.error('Summary failed:', error.status || '', error.message);

    button.textContent = 'Try again';


    // -----------------------------------
    // Pick a clear message for the person
    // -----------------------------------

    let message;

    if (error.status === 429) {

      message = 'Too many requests. Please wait a minute, then press "Try again".';

    } else if (error.status === 400 && error.message) {

      message = error.message;

    } else if (error instanceof TypeError) {

      message = 'Could not reach the server. Check your internet connection, then press "Try again".';

    } else {

      message = 'The AI summary is not available right now. Please press "Try again" in a moment.';
    }

    commError(message);


    // -----------------------------------
    // English only: also show a basic version.
    // Other languages never get a half-translated mix.
    // -----------------------------------

    const allText = [
      story,
      commVal('f_where'),
      commVal('f_meds'),
      commVal('f_q'),
      commVal('f_int')
    ].join(' ');

    const isPlainEnglish =
      lang === 'en'
      && !/[^\x00-\x7F]/.test(allText);

    if (isPlainEnglish && error.status !== 400) {

      summaryText = basicSummary();

      $('sum').textContent = message + '\n\n' + summaryText;
    }


  } finally {

    button.disabled = false;
  }
};


/* ===================================
   Language switch
   ===================================

   i18n.js rewrites every data-i element when the language changes, which
   would wipe the summary box. Wrap applyLang() to draw the answer again.
*/

const applyLangForSummary = applyLang;

applyLang = function () {

  applyLangForSummary();

  if (lastResult) {

    commShow(lastResult);
  }
};


/* ===================================
   Copy and Print buttons
   =================================== */

$('cp').onclick = () => {

  // Copy the English summary and the English paragraph
  const textToCopy =
    [summaryText, sayText]
      .filter(Boolean)
      .join('\n\n');

  if (!textToCopy || !navigator.clipboard) {
    return;
  }

  navigator.clipboard.writeText(textToCopy).then(() => {

    $('cp').textContent = 'Copied';

    setTimeout(() => {

      $('cp').textContent = 'Copy';

    }, 1500);
  });
};


$('pr').onclick = () => window.print();