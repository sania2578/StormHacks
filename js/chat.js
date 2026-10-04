/* ===================================
   Ask: AI chat
   ===================================

   The page talks to our own backend (netlify/functions/chat.js),
   never to the AI service directly.
*/


/* -----------------------------------
   Settings
   ----------------------------------- */

// On GitHub Pages the functions live on Netlify, so we need the full address.
// On Netlify itself, the short address works.
const API_URL =
  (location.hostname.endsWith('github.io')
    ? 'https://legendary-licorice-2161a7.netlify.app'
    : '')
  + '/.netlify/functions/chat';


// Backup emergency check on the person's own words
const URGENT_RE =
  /chest pain|can'?t breathe|cannot breathe|stroke|overdose|suicid|kill myself|end my life|unconscious|seizure/i;


// Chat state
let chat = [];
let busy = false;
let curTab = 'navigate';


// Typing hints per tab (English). tabs.js reads this object.
const HINT = {
  navigate: 'Describe your symptoms…',
  communicate: 'Ask how to explain your problem…',
  manage: 'Ask about your medication…',
  followup: 'Tell me how you feel today…'
};

const HINT_EN = { ...HINT };


/* ===================================
   Phone fixes
   (kept here so the shared CSS file stays untouched)
   =================================== */

document.head.insertAdjacentHTML('beforeend', `<style>

  /* Long words wrap instead of running off the screen */
  .msg { overflow-wrap: anywhere; word-break: break-word; }
  .msg .btn { white-space: normal; max-width: 100%; }
  #log { overflow-x: hidden; }

  /* The chat panel scrolls on small screens */
  #dockbody { max-height: 75vh; overflow-y: auto; }
  .dock { max-width: 100vw; }

  /* 16px stops iPhones from zooming in when the box is tapped */
  #cin { font-size: 16px; min-width: 0; }

</style>`);


/* ===================================
   Chat text in each language
   ===================================

   Have native speakers review these before launch.

   bar      = text on the bottom bar
   ctitle   = consent title
   cbody    = consent text
   cok      = consent button
   ph       = typing box hint
   greet    = first message from the assistant
   send     = send button
   note     = small note under the typing box
   urgent   = emergency card text
   call     = emergency card button
   check    = text before the category name on the "where to go" button
   use      = button that copies the chat summary into the form
   unavail  = shown when the assistant cannot be reached
   wait     = shown when there are too many messages
*/

const CHAT_TEXT = {

  // -----------------------------------
  en: {
    bar: 'Ask in your own language',
    ctitle: 'Before you chat',
    cbody: "Your messages are sent to an AI service (Google Gemini, free demo tier) to get a reply. The free tier may use messages to improve Google's products, so do not type your name, address, health card number or real medical details. Do not use this chat in an emergency: call 9-1-1.",
    cok: 'I understand, start chat',
    ph: 'Describe your symptoms…',
    greet: 'Hello. Tell me what is happening and how long it has been going on. You can write in any language.',
    send: 'Send',
    note: 'Helps you choose where to go. It does not diagnose.',
    urgent: 'This may be an emergency. Call 9-1-1 now. If you are thinking about suicide, call or text 9-8-8.',
    call: 'Call 9-1-1',
    check: 'Check where to go:',
    use: 'Use in my provider summary',
    unavail: 'The assistant is not available right now. In an emergency call 9-1-1. For nurse advice call 8-1-1, or use the Navigate tab.',
    wait: 'Too many messages. Please wait a minute and try again.'
  },

  // -----------------------------------
  fr: {
    bar: 'Demander dans ma langue',
    ctitle: 'Avant de discuter',
    cbody: "Vos messages sont envoyés à un service d'IA (Google Gemini, version gratuite de démonstration). Cette version peut utiliser les messages pour améliorer les produits de Google : n'écrivez pas votre nom, adresse, numéro de carte santé ni de détails médicaux réels. N'utilisez pas ce chat en cas d'urgence : appelez le 9-1-1.",
    cok: 'Je comprends, commencer',
    ph: 'Décrivez vos symptômes…',
    greet: "Bonjour. Dites-moi ce qui se passe et depuis combien de temps. Vous pouvez écrire dans n'importe quelle langue.",
    send: 'Envoyer',
    note: 'Aide à choisir où aller. Ne pose pas de diagnostic.',
    urgent: "Cela peut être une urgence. Appelez le 9-1-1 maintenant. Si vous pensez au suicide, appelez ou envoyez un texto au 9-8-8.",
    call: 'Appeler le 9-1-1',
    check: 'Voir où aller :',
    use: 'Utiliser dans mon résumé',
    unavail: "L'assistant n'est pas disponible. En cas d'urgence, appelez le 9-1-1. Pour parler à une infirmière, appelez le 8-1-1, ou utilisez l'onglet S'orienter.",
    wait: 'Trop de messages. Attendez une minute et réessayez.'
  },

  // -----------------------------------
  es: {
    bar: 'Pregunte en su idioma',
    ctitle: 'Antes de chatear',
    cbody: 'Sus mensajes se envían a un servicio de IA (Google Gemini, versión gratuita de demostración). La versión gratuita puede usar los mensajes para mejorar los productos de Google, así que no escriba su nombre, dirección, número de tarjeta de salud ni datos médicos reales. No use este chat en una emergencia: llame al 9-1-1.',
    cok: 'Entiendo, empezar',
    ph: 'Describa sus síntomas…',
    greet: 'Hola. Cuénteme qué está pasando y desde cuándo. Puede escribir en cualquier idioma.',
    send: 'Enviar',
    note: 'Ayuda a elegir adónde ir. No diagnostica.',
    urgent: 'Esto puede ser una emergencia. Llame al 9-1-1 ahora. Si piensa en suicidarse, llame o envíe un mensaje al 9-8-8.',
    call: 'Llamar al 9-1-1',
    check: 'Ver adónde ir:',
    use: 'Usar en mi resumen',
    unavail: 'El asistente no está disponible. En una emergencia llame al 9-1-1. Para hablar con una enfermera llame al 8-1-1 o use la pestaña Orientación.',
    wait: 'Demasiados mensajes. Espere un minuto e inténtelo de nuevo.'
  },

  // -----------------------------------
  pt: {
    bar: 'Pergunte no seu idioma',
    ctitle: 'Antes de conversar',
    cbody: 'Suas mensagens são enviadas a um serviço de IA (Google Gemini, versão gratuita de demonstração). A versão gratuita pode usar as mensagens para melhorar produtos do Google; por isso, não digite seu nome, endereço, número do cartão de saúde nem dados médicos reais. Não use este chat em emergências: ligue 9-1-1.',
    cok: 'Entendi, começar',
    ph: 'Descreva seus sintomas…',
    greet: 'Olá. Conte-me o que está acontecendo e há quanto tempo. Você pode escrever em qualquer idioma.',
    send: 'Enviar',
    note: 'Ajuda a escolher onde ir. Não faz diagnóstico.',
    urgent: 'Isto pode ser uma emergência. Ligue 9-1-1 agora. Se estiver pensando em suicídio, ligue ou envie mensagem para 9-8-8.',
    call: 'Ligar 9-1-1',
    check: 'Ver onde ir:',
    use: 'Usar no meu resumo',
    unavail: 'O assistente não está disponível. Em emergência, ligue 9-1-1. Para falar com uma enfermeira, ligue 8-1-1 ou use a aba Orientação.',
    wait: 'Muitas mensagens. Aguarde um minuto e tente novamente.'
  },

  // -----------------------------------
  ru: {
    bar: 'Спросить на своём языке',
    ctitle: 'Перед началом чата',
    cbody: 'Ваши сообщения отправляются в сервис ИИ (Google Gemini, бесплатная демо-версия). Бесплатная версия может использовать сообщения для улучшения продуктов Google, поэтому не вводите имя, адрес, номер медицинской карты и реальные медицинские данные. Не используйте чат при чрезвычайной ситуации: звоните 9-1-1.',
    cok: 'Понятно, начать',
    ph: 'Опишите симптомы…',
    greet: 'Здравствуйте. Расскажите, что происходит и как давно. Можно писать на любом языке.',
    send: 'Отправить',
    note: 'Помогает выбрать, куда обратиться. Не ставит диагноз.',
    urgent: 'Это может быть неотложная ситуация. Позвоните 9-1-1 сейчас. Если думаете о самоубийстве, позвоните или напишите на 9-8-8.',
    call: 'Позвонить 9-1-1',
    check: 'Куда обратиться:',
    use: 'Использовать в моём резюме',
    unavail: 'Помощник сейчас недоступен. В экстренной ситуации звоните 9-1-1. Консультация медсестры: 8-1-1, или откройте вкладку «Куда обратиться».',
    wait: 'Слишком много сообщений. Подождите минуту и повторите.'
  },

  // -----------------------------------
  zh: {
    bar: '用您的语言提问',
    ctitle: '聊天前请注意',
    cbody: '您的消息会发送给AI服务（Google Gemini免费演示版）以获取回复。免费版可能会用消息改进Google产品，请不要输入姓名、地址、健康卡号或真实的医疗细节。紧急情况请勿使用聊天，请拨打9-1-1。',
    cok: '我明白，开始聊天',
    ph: '请描述您的症状…',
    greet: '您好。请告诉我发生了什么，以及持续多久。您可以用任何语言书写。',
    send: '发送',
    note: '帮助您选择去哪里就医，不做诊断。',
    urgent: '这可能是紧急情况。请立即拨打9-1-1。如果您有自杀的想法，请拨打或短信联系9-8-8。',
    call: '拨打9-1-1',
    check: '查看该去哪里：',
    use: '用于我的就诊摘要',
    unavail: '助手暂时无法使用。紧急情况请拨打9-1-1；护士咨询请拨打8-1-1，或使用“导航”标签。',
    wait: '消息过多，请稍等一分钟再试。'
  },

  // -----------------------------------
  ko: {
    bar: '내 언어로 질문하기',
    ctitle: '채팅 전에 확인하세요',
    cbody: '메시지는 AI 서비스(Google Gemini 무료 데모 버전)로 전송됩니다. 무료 버전은 메시지를 Google 제품 개선에 사용할 수 있으므로 이름, 주소, 건강보험 카드 번호, 실제 의료 정보는 입력하지 마세요. 응급 상황에서는 이 채팅을 사용하지 말고 9-1-1에 전화하세요.',
    cok: '이해했어요, 시작',
    ph: '증상을 설명해 주세요…',
    greet: '안녕하세요. 어떤 일이 있고 얼마나 됐는지 알려주세요. 어떤 언어로든 쓰셔도 됩니다.',
    send: '보내기',
    note: '어디로 가야 할지 돕습니다. 진단은 하지 않습니다.',
    urgent: '응급 상황일 수 있습니다. 지금 9-1-1에 전화하세요. 자살을 생각 중이라면 9-8-8로 전화하거나 문자하세요.',
    call: '9-1-1 전화',
    check: '어디로 갈지 보기:',
    use: '진료 요약에 사용',
    unavail: "지금은 도우미를 사용할 수 없습니다. 응급 시 9-1-1, 간호사 상담은 8-1-1, 또는 '진료 찾기' 탭을 이용하세요.",
    wait: '메시지가 너무 많습니다. 1분 후 다시 시도하세요.'
  },

  // -----------------------------------
  ja: {
    bar: '自分の言語で質問',
    ctitle: 'チャットの前に',
    cbody: 'メッセージはAIサービス（Google Gemini 無料デモ版）に送信されます。無料版ではメッセージがGoogleの製品改善に使われる場合があるため、名前、住所、健康保険証番号、実際の医療情報は入力しないでください。緊急時はこのチャットを使わず、9-1-1に電話してください。',
    cok: '了解して開始',
    ph: '症状を入力してください…',
    greet: 'こんにちは。何が起きているか、いつからかを教えてください。どの言語でも書けます。',
    send: '送信',
    note: '受診先選びを手伝います。診断はしません。',
    urgent: '緊急の可能性があります。今すぐ9-1-1に電話してください。自殺を考えている場合は9-8-8に電話またはテキストしてください。',
    call: '9-1-1に電話',
    check: '行き先を確認：',
    use: '受診メモに使う',
    unavail: '現在アシスタントは利用できません。緊急時は9-1-1、看護師相談は8-1-1、または「受診先を探す」タブをご利用ください。',
    wait: 'メッセージが多すぎます。1分待ってからもう一度お試しください。'
  },

  // -----------------------------------
  ar: {
    bar: 'اسأل بلغتك',
    ctitle: 'قبل المحادثة',
    cbody: 'تُرسل رسائلك إلى خدمة ذكاء اصطناعي (Google Gemini، نسخة تجريبية مجانية). قد تستخدم النسخة المجانية الرسائل لتحسين منتجات Google، لذا لا تكتب اسمك أو عنوانك أو رقم بطاقتك الصحية أو تفاصيل طبية حقيقية. لا تستخدم هذه المحادثة في الطوارئ: اتصل بـ 9-1-1.',
    cok: 'فهمت، ابدأ',
    ph: 'صف أعراضك…',
    greet: 'مرحبًا. أخبرني بما يحدث ومنذ متى. يمكنك الكتابة بأي لغة.',
    send: 'إرسال',
    note: 'يساعدك على اختيار المكان المناسب. لا يقدّم تشخيصًا.',
    urgent: 'قد تكون هذه حالة طارئة. اتصل بـ 9-1-1 الآن. إذا كنت تفكر في الانتحار فاتصل أو أرسل رسالة إلى 9-8-8.',
    call: 'اتصل بـ 9-1-1',
    check: 'انظر إلى أين تذهب:',
    use: 'استخدمه في ملخصي',
    unavail: 'المساعد غير متاح الآن. في الطوارئ اتصل بـ 9-1-1. لاستشارة ممرضة اتصل بـ 8-1-1 أو استخدم تبويب التوجيه.',
    wait: 'رسائل كثيرة. انتظر دقيقة ثم حاول مرة أخرى.'
  },

  // -----------------------------------
  tl: {
    bar: 'Magtanong sa sarili mong wika',
    ctitle: 'Bago mag-chat',
    cbody: 'Ipinapadala ang mga mensahe mo sa isang AI service (Google Gemini, libreng demo tier). Maaaring gamitin ng libreng tier ang mga mensahe para pagbutihin ang produkto ng Google, kaya huwag ilagay ang pangalan, address, health card number o totoong medikal na detalye. Huwag gamitin ang chat na ito sa emergency: tumawag sa 9-1-1.',
    cok: 'Naiintindihan ko, simulan',
    ph: 'Ilarawan ang mga sintomas…',
    greet: 'Kumusta. Sabihin mo kung ano ang nangyayari at gaano na katagal. Maaari kang magsulat sa anumang wika.',
    send: 'Ipadala',
    note: 'Tumutulong pumili kung saan pupunta. Hindi ito diagnosis.',
    urgent: 'Maaaring emergency ito. Tumawag sa 9-1-1 ngayon. Kung iniisip mong magpakamatay, tumawag o mag-text sa 9-8-8.',
    call: 'Tumawag sa 9-1-1',
    check: 'Tingnan kung saan pupunta:',
    use: 'Gamitin sa buod ko',
    unavail: 'Hindi available ang assistant ngayon. Sa emergency, tumawag sa 9-1-1. Para sa nurse, tumawag sa 8-1-1 o gamitin ang Gabay tab.',
    wait: 'Masyadong maraming mensahe. Maghintay ng isang minuto at subukan ulit.'
  },

  // -----------------------------------
  pa: {
    bar: 'ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਪੁੱਛੋ',
    ctitle: 'ਚੈਟ ਤੋਂ ਪਹਿਲਾਂ',
    cbody: 'ਤੁਹਾਡੇ ਸੁਨੇਹੇ ਇੱਕ AI ਸੇਵਾ (Google Gemini, ਮੁਫ਼ਤ ਡੈਮੋ ਵਰਜਨ) ਨੂੰ ਭੇਜੇ ਜਾਂਦੇ ਹਨ। ਮੁਫ਼ਤ ਵਰਜਨ ਸੁਨੇਹਿਆਂ ਨੂੰ Google ਦੇ ਉਤਪਾਦ ਸੁਧਾਰਨ ਲਈ ਵਰਤ ਸਕਦਾ ਹੈ, ਇਸ ਲਈ ਆਪਣਾ ਨਾਮ, ਪਤਾ, ਸਿਹਤ ਕਾਰਡ ਨੰਬਰ ਜਾਂ ਅਸਲੀ ਡਾਕਟਰੀ ਜਾਣਕਾਰੀ ਨਾ ਲਿਖੋ। ਐਮਰਜੈਂਸੀ ਵਿੱਚ ਇਹ ਚੈਟ ਨਾ ਵਰਤੋ: 9-1-1 ਤੇ ਕਾਲ ਕਰੋ।',
    cok: 'ਮੈਂ ਸਮਝ ਗਿਆ/ਗਈ, ਸ਼ੁਰੂ ਕਰੋ',
    ph: 'ਆਪਣੇ ਲੱਛਣ ਦੱਸੋ…',
    greet: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਦੱਸੋ ਕੀ ਹੋ ਰਿਹਾ ਹੈ ਅਤੇ ਕਿੰਨੇ ਸਮੇਂ ਤੋਂ। ਤੁਸੀਂ ਕਿਸੇ ਵੀ ਭਾਸ਼ਾ ਵਿੱਚ ਲਿਖ ਸਕਦੇ ਹੋ।',
    send: 'ਭੇਜੋ',
    note: 'ਇਹ ਚੁਣਨ ਵਿੱਚ ਮਦਦ ਕਰਦਾ ਹੈ ਕਿ ਕਿੱਥੇ ਜਾਣਾ ਹੈ। ਇਹ ਜਾਂਚ ਨਹੀਂ ਕਰਦਾ।',
    urgent: 'ਇਹ ਐਮਰਜੈਂਸੀ ਹੋ ਸਕਦੀ ਹੈ। ਹੁਣੇ 9-1-1 ਤੇ ਕਾਲ ਕਰੋ। ਜੇ ਤੁਸੀਂ ਖੁਦਕੁਸ਼ੀ ਬਾਰੇ ਸੋਚ ਰਹੇ ਹੋ ਤਾਂ 9-8-8 ਤੇ ਕਾਲ ਜਾਂ ਟੈਕਸਟ ਕਰੋ।',
    call: '9-1-1 ਤੇ ਕਾਲ ਕਰੋ',
    check: 'ਦੇਖੋ ਕਿੱਥੇ ਜਾਣਾ ਹੈ:',
    use: 'ਮੇਰੇ ਸਾਰ ਵਿੱਚ ਵਰਤੋ',
    unavail: 'ਸਹਾਇਕ ਹੁਣ ਉਪਲਬਧ ਨਹੀਂ। ਐਮਰਜੈਂਸੀ ਵਿੱਚ 9-1-1, ਨਰਸ ਲਈ 8-1-1 ਤੇ ਕਾਲ ਕਰੋ, ਜਾਂ ਰਾਹ ਲੱਭੋ ਟੈਬ ਵਰਤੋ।',
    wait: 'ਬਹੁਤ ਸੁਨੇਹੇ। ਇੱਕ ਮਿੰਟ ਉਡੀਕ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।'
  }
};


// Get the text for the language picked in the top menu.
// Any missing line falls back to English.
function getChatText() {

  const chosen = CHAT_TEXT[$('lang').value] || {};

  return { ...CHAT_TEXT.en, ...chosen };
}


/* ===================================
   Apply the chosen language to the chat
   =================================== */

function applyChatLang() {

  const text = getChatText();


  // Bottom bar
  $('dockbar').firstElementChild.textContent = '💬 ' + text.bar;


  // Consent box
  $('consent').querySelector('strong').textContent = text.ctitle;

  $('consent').querySelector('p').textContent = text.cbody;

  $('ok').textContent = text.cok;


  // Send button and the small note
  $('snd').textContent = text.send;

  const note = document.querySelector('#chatbox .note');

  if (note) {
    note.textContent = text.note;
  }


  // Typing hint: English keeps one hint per tab,
  // other languages use one translated hint for every tab
  const isEnglish = $('lang').value === 'en';

  Object.keys(HINT).forEach(tab => {

    HINT[tab] = isEnglish ? HINT_EN[tab] : text.ph;
  });

  $('cin').placeholder = HINT[curTab] || HINT.navigate;
}

$('lang').addEventListener('change', applyChatLang);


/* ===================================
   Open and close the chat bar
   =================================== */

function setDock(open) {

  $('dockbody').hidden = !open;

  $('dockbar').setAttribute('aria-expanded', open);

  $('chev').textContent = open ? '▼' : '▲';

  if (open && !$('chatbox').hidden) {
    $('cin').focus();
  }
}

$('dockbar').onclick = () => setDock($('dockbody').hidden);


/* ===================================
   Chat helpers
   =================================== */

// Add a message bubble to the chat
function addMsg(cls, html) {

  const bubble = document.createElement('div');

  bubble.className = 'msg ' + cls;

  bubble.innerHTML = html;

  $('log').appendChild(bubble);

  $('log').scrollTop = 1e9;

  return bubble;
}


// The red emergency card
function emergencyCard(text) {

  return esc(text.urgent)
    + ' <a class="btn" href="tel:911" style="display:inline-block;text-decoration:none;background:var(--red)">'
    + esc(text.call)
    + '</a>';
}


// The chat never shows links. Only our own buttons move people around the site.
function removeLinks(reply) {

  return String(reply)
    .replace(/(https?:\/\/|www\.)\S+/gi, '')
    .trim();
}


/* ===================================
   Consent button -> start the chat
   =================================== */

$('ok').onclick = () => {

  $('consent').hidden = true;

  $('chatbox').hidden = false;

  addMsg('bot', esc(getChatText().greet));

  $('cin').focus();
};


/* ===================================
   Send a message
   =================================== */

async function send() {

  const typed = $('cin').value.trim();

  if (!typed || busy) {
    return;
  }

  const text = getChatText();


  // -----------------------------------
  // Show the person's message
  // -----------------------------------

  $('cin').value = '';

  addMsg('me', esc(typed));

  chat.push({ role: 'user', content: typed });


  // -----------------------------------
  // Backup emergency check on the person's own words
  // -----------------------------------

  let emergencyShown = false;

  if (URGENT_RE.test(typed)) {

    addMsg('bot sos', emergencyCard(text));

    emergencyShown = true;
  }


  // -----------------------------------
  // Show "..." while we wait
  // -----------------------------------

  busy = true;

  const bubble = addMsg('bot', '…');


  try {

    // -----------------------------------
    // Ask our backend
    // -----------------------------------

    const response = await fetch(API_URL, {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({

        messages: chat.slice(-10),

        lang: $('lang').value,

        tab: curTab
      })
    });

    if (!response.ok) {

      const error = new Error(String(response.status));

      error.status = response.status;

      throw error;
    }

    const data = await response.json();


    // -----------------------------------
    // Show the reply (links removed)
    // -----------------------------------

    const reply = removeLinks(data.reply || '');

    if (!reply) {

      throw new Error('The AI reply was empty');
    }

    chat.push({ role: 'assistant', content: reply });

    bubble.innerHTML = esc(reply).replace(/\n/g, '<br>');


    // -----------------------------------
    // The AI says it may be an emergency
    // -----------------------------------

    if (data.urgent && !emergencyShown) {

      addMsg('bot sos', emergencyCard(text));
    }


    // -----------------------------------
    // Button: "Check where to go: <category>"
    // -----------------------------------

    const knowsCategory =
      !data.urgent
      && data.category
      && typeof CATS !== 'undefined'
      && CATS[data.category];

    if (knowsCategory) {

      const categoryName =
        (typeof catText === 'function')
          ? catText(data.category, CATS[data.category]).name
          : CATS[data.category].name;

      const goButton = document.createElement('button');

      goButton.className = 'btn';

      goButton.textContent = text.check + ' ' + categoryName;

      goButton.onclick = () => {

        st = { step: 'g', cat: data.category };

        setDock(false);

        openTab('navigate');

        navRender();

        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      bubble.appendChild(document.createElement('br'));

      bubble.appendChild(goButton);
    }


    // -----------------------------------
    // Button: "Use in my provider summary"
    // -----------------------------------

    if (data.summary_en) {

      const summaryButton = document.createElement('button');

      summaryButton.className = 'btn g';

      summaryButton.textContent = text.use;

      summaryButton.onclick = () => {

        $('f_story').value = data.summary_en;

        setDock(false);

        openTab('communicate');

        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      bubble.appendChild(summaryButton);
    }


  } catch (error) {

    // -----------------------------------
    // Something went wrong: show a clear message
    // -----------------------------------

    bubble.textContent =
      error.status === 429
        ? text.wait
        : text.unavail;


  } finally {

    busy = false;
  }
}


/* ===================================
   Send button and Enter key
   =================================== */

$('snd').onclick = send;

// isComposing: Korean, Japanese and Chinese keyboards press Enter to confirm
// a word. That must not send the message.
$('cin').onkeydown = event => {

  if (event.key === 'Enter' && !event.isComposing) {

    send();
  }
};


// Set the chat text for the starting language
applyChatLang();