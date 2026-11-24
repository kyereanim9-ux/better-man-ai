// --- EXPRESSION ORALE (articulation + conversations en plusieurs langues) ---
// Micro : Web Speech API du navigateur (gratuit, Chrome/Edge/Safari).
// Voix : speechSynthesis. Rien n'est envoyé au serveur sauf le texte des
// conversations (pour le partenaire IA). L'historique reste dans le navigateur.
const SPK_LANGS = [
  { code: 'fr', flag: '🇫🇷', name: 'Français', bcp: 'fr-FR' },
  { code: 'en', flag: '🇬🇧', name: 'English', bcp: 'en-US' },
  { code: 'es', flag: '🇪🇸', name: 'Español', bcp: 'es-ES' },
  { code: 'ko', flag: '🇰🇷', name: '한국어', bcp: 'ko-KR' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch', bcp: 'de-DE' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano', bcp: 'it-IT' },
  { code: 'pt', flag: '🇧🇷', name: 'Português', bcp: 'pt-BR' },
  { code: 'ja', flag: '🇯🇵', name: '日本語', bcp: 'ja-JP' },
  { code: 'zh', flag: '🇨🇳', name: '中文', bcp: 'zh-CN' },
  { code: 'ar', flag: '🇸🇦', name: 'العربية', bcp: 'ar-SA' }
];
// Langues sans espaces entre les mots : on compare caractère par caractère.
const SPK_CHAR_LANGS = new Set(['ja', 'zh']);

const SPK_TWISTERS = {
  fr: ["Les chaussettes de l'archiduchesse sont-elles sèches, archi-sèches ?", "Un chasseur sachant chasser doit savoir chasser sans son chien.", "Si six scies scient six cyprès, six cents scies scient six cents cyprès.", "Ton thé t'a-t-il ôté ta toux ?", "Je veux et j'exige d'exquises excuses."],
  en: ['She sells seashells by the seashore.', 'Red lorry, yellow lorry, red lorry, yellow lorry.', 'Peter Piper picked a peck of pickled peppers.', 'Unique New York, you know you need unique New York.', 'The thirty-three thieves thought that they thrilled the throne throughout Thursday.'],
  es: ['Tres tristes tigres tragaban trigo en un trigal.', 'Pablito clavó un clavito, ¿qué clavito clavó Pablito?', 'El perro de San Roque no tiene rabo porque Ramón Ramírez se lo ha cortado.', 'Compré pocas copas, pocas copas compré.', 'Erre con erre cigarro, erre con erre barril.'],
  ko: ['간장 공장 공장장은 강 공장장이고 된장 공장 공장장은 장 공장장이다.', '내가 그린 기린 그림은 잘 그린 기린 그림이다.', '경찰청 철창살은 외철창살이냐 쌍철창살이냐.', '저기 계신 저 분이 박 법학박사이시고 여기 계신 이 분이 백 법학박사이시다.'],
  de: ['Fischers Fritz fischt frische Fische, frische Fische fischt Fischers Fritz.', 'Blaukraut bleibt Blaukraut und Brautkleid bleibt Brautkleid.', 'Zwischen zwei Zwetschgenzweigen zwitschern zwei Schwalben.'],
  it: ['Trentatré trentini entrarono a Trento tutti e trentatré trotterellando.', 'Sopra la panca la capra campa, sotto la panca la capra crepa.', 'Apelle figlio di Apollo fece una palla di pelle di pollo.'],
  pt: ['O rato roeu a roupa do rei de Roma.', 'Três pratos de trigo para três tigres tristes.', 'O peito do pé de Pedro é preto.'],
  ja: ['生麦生米生卵', '隣の客はよく柿食う客だ', '東京特許許可局', '赤巻紙青巻紙黄巻紙'],
  zh: ['四是四，十是十，十四是十四，四十是四十。', '吃葡萄不吐葡萄皮，不吃葡萄倒吐葡萄皮。', '八百标兵奔北坡。'],
  ar: ['خيط حرير على حيط خليل.', 'طار الطير فوق الطيار.', 'قيس قاس قوسا قاسيا.']
};

const SPK_FILLERS = {
  fr: ['euh', 'heu', 'bah', 'ben', 'genre', 'en fait', 'du coup', 'voilà', 'tu vois', 'quoi'],
  en: ['um', 'uh', 'erm', 'like', 'you know', 'basically', 'actually', 'i mean', 'kind of', 'sort of'],
  es: ['eh', 'em', 'este', 'o sea', 'pues', 'bueno', 'tipo', 'sabes'],
  ko: ['음', '어', '그', '저기', '막', '뭐'],
  de: ['äh', 'ähm', 'also', 'halt', 'quasi', 'sozusagen', 'irgendwie'],
  it: ['ehm', 'cioè', 'tipo', 'allora', 'praticamente', 'insomma'],
  pt: ['é', 'tipo', 'então', 'né', 'assim', 'sabe'],
  ja: ['えーと', 'えっと', 'あの', 'まあ', 'なんか'],
  zh: ['那个', '就是', '嗯', '然后'],
  ar: ['يعني', 'امم', 'اه']
};

const spk = {
  lang: localStorage.getItem('bm_spk_lang') || 'en',
  level: localStorage.getItem('bm_spk_level') || 'intermediaire',
  tab: 'convo',
  twistIx: 0,
  scenario: 'smalltalk',
  history: [],
  active: false,
  fillers: 0,
  words: 0,
  speakMs: 0,
  voiceOn: localStorage.getItem('bm_spk_voice') !== '0',
  rec: null,
  busy: false,
  scenarios: null
};

const spkEsc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const spkLangInfo = () => SPK_LANGS.find(l => l.code === spk.lang) || SPK_LANGS[1];
const spkRecApi = () => window.SpeechRecognition || window.webkitSpeechRecognition;

function spkTokens(text, lang) {
  const base = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (SPK_CHAR_LANGS.has(lang)) return [...base.replace(/[\s\p{P}\p{S}]/gu, '')];
  return base.replace(/[\p{P}\p{S}]/gu, ' ').split(/\s+/).filter(Boolean);
}

// Alignement (plus longue sous-séquence commune) : quels mots de la phrase
// cible ont bien été reconnus, dans l'ordre.
function spkAlign(target, spoken) {
  const n = target.length, m = spoken.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = target[i] === spoken[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const hit = new Array(n).fill(false);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (target[i] === spoken[j]) { hit[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return hit;
}

function spkCountFillers(text, lang) {
  const t = ' ' + String(text).toLowerCase().replace(/[\p{P}]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  return (SPK_FILLERS[lang] || []).reduce((n, f) => {
    const re = SPK_CHAR_LANGS.has(lang) || lang === 'ko' ? new RegExp(f, 'g') : new RegExp(` ${f} `, 'g');
    return n + (t.match(re) || []).length;
  }, 0);
}

function spkSay(text, onEnd) {
  if (!('speechSynthesis' in window)) { onEnd && onEnd(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const info = spkLangInfo();
  u.lang = info.bcp;
  const voice = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(info.code));
  if (voice) u.voice = voice;
  u.rate = spk.level === 'debutant' ? 0.85 : 1;
  u.onend = () => onEnd && onEnd();
  u.onerror = () => onEnd && onEnd();
  window.speechSynthesis.speak(u);
}

// Écoute une phrase au micro. onPartial reçoit le texte en cours, onDone le
// texte final et la durée de parole (ms).
function spkListen({ onPartial, onDone, onFail }) {
  const Rec = spkRecApi();
  if (!Rec) { onFail('Micro non pris en charge par ce navigateur : utilise Chrome, Edge ou Safari.'); return null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const rec = new Rec();
  rec.lang = spkLangInfo().bcp;
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = '', interim = '', t0 = 0, tLast = 0, silenceTimer = null;
  const armSilence = () => { clearTimeout(silenceTimer); silenceTimer = setTimeout(() => rec.stop(), 2200); };
  rec.onresult = (e) => {
    if (!t0) t0 = Date.now();
    tLast = Date.now();
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    onPartial && onPartial((finalText + interim).trim());
    armSilence();
  };
  rec.onerror = (e) => {
    const msg = { 'not-allowed': 'Permission micro refusée : autorise le micro pour ce site dans ton navigateur.', 'no-speech': 'Aucune voix détectée. Réessaie en parlant plus près du micro.', 'audio-capture': 'Aucun micro trouvé.', 'language-not-supported': 'Cette langue n\'est pas reconnue par le micro de ce navigateur.' }[e.error];
    if (e.error !== 'aborted') onFail(msg || `Erreur micro (${e.error}).`);
  };
  rec.onend = () => {
    clearTimeout(silenceTimer);
    const text = (finalText + interim).trim();
    onDone(text, t0 && tLast ? tLast - t0 : 0);
  };
  rec.start();
  armSilence();
  return rec;
}

function spkStop() {
  if (spk.rec) { try { spk.rec.abort(); } catch (e) { /* déjà arrêté */ } spk.rec = null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function spkSaveLog(entry) {
  try {
    const log = JSON.parse(localStorage.getItem('bm_spk_log') || '[]');
    log.unshift({ ...entry, date: new Date().toISOString() });
    localStorage.setItem('bm_spk_log', JSON.stringify(log.slice(0, 100)));
  } catch (e) { /* stockage indisponible */ }
}

async function loadSpeaking() {
  spkStop();
  const root = document.getElementById('speaking-root');
  if (!spk.scenarios) {
    try { spk.scenarios = (await api('/speaking/options')).scenarios; }
    catch (e) { spk.scenarios = { smalltalk: 'Discussion libre' }; }
  }
  const micOk = !!spkRecApi();
  root.innerHTML = `
    ${micOk ? '' : '<div class="card-block spk-warn">🎤 Le micro n\'est pas disponible dans ce navigateur. Ouvre l\'app dans Chrome, Edge ou Safari pour parler ; en attendant tu peux écrire.</div>'}
    <div class="card-block">
      <h3>Langue pratiquée</h3>
      <div class="spk-langs">${SPK_LANGS.map(l => `<button type="button" class="spk-chip ${l.code === spk.lang ? 'on' : ''}" data-spk-lang="${l.code}">${l.flag} ${spkEsc(l.name)}</button>`).join('')}</div>
      <label class="meta spk-level">Niveau
        <select id="spk-level">
          <option value="debutant">Débutant</option><option value="intermediaire">Intermédiaire</option><option value="avance">Avancé</option>
        </select>
      </label>
    </div>
    <div class="spk-tabs">
      <button type="button" data-spk-tab="convo" class="${spk.tab === 'convo' ? 'on' : ''}">💬 Conversation</button>
      <button type="button" data-spk-tab="artic" class="${spk.tab === 'artic' ? 'on' : ''}">👄 Articulation</button>
      <button type="button" data-spk-tab="log" class="${spk.tab === 'log' ? 'on' : ''}">📈 Historique</button>
    </div>
    <div id="spk-panel"></div>`;
  root.querySelector('#spk-level').value = spk.level;
  root.querySelector('#spk-level').onchange = (e) => { spk.level = e.target.value; localStorage.setItem('bm_spk_level', spk.level); };
  root.querySelectorAll('[data-spk-lang]').forEach(b => b.onclick = () => {
    spk.lang = b.dataset.spkLang; localStorage.setItem('bm_spk_lang', spk.lang);
    spk.twistIx = 0; spk.history = []; spk.active = false; loadSpeaking();
  });
  root.querySelectorAll('[data-spk-tab]').forEach(b => b.onclick = () => { spk.tab = b.dataset.spkTab; loadSpeaking(); });
  if (spk.tab === 'artic') spkRenderArtic();
  else if (spk.tab === 'log') spkRenderLog();
  else spkRenderConvo();
}

// --- Onglet Articulation ---
function spkRenderArtic() {
  const panel = document.getElementById('spk-panel');
  const list = SPK_TWISTERS[spk.lang] || SPK_TWISTERS.en;
  const line = list[spk.twistIx % list.length];
  panel.innerHTML = `
    <div class="card-block">
      <h3>Virelangue ${spk.twistIx % list.length + 1} / ${list.length}</h3>
      <p class="meta">1. Écoute le modèle. 2. Répète lentement en exagérant chaque son. 3. Recommence plus vite. Le micro vérifie chaque mot.</p>
      <p class="spk-line" id="spk-line" dir="auto">${spkEsc(line)}</p>
      <div class="spk-row">
        <button type="button" id="spk-listen" class="secondary">🔊 Écouter</button>
        <button type="button" id="spk-try">🎤 À toi</button>
        <button type="button" id="spk-next" class="secondary">Suivant ›</button>
      </div>
      <p class="spk-heard meta" id="spk-heard" dir="auto"></p>
      <div id="spk-score"></div>
    </div>
    <div class="card-block">
      <h3>Conseils d'articulation</h3>
      <ul class="spk-tips">
        <li><strong>Exagère d'abord :</strong> ouvre grand la bouche et marque chaque consonne, puis accélère.</li>
        <li><strong>Finis tes mots :</strong> la plupart des « mâchonnements » viennent des fins de mots avalées.</li>
        <li><strong>Un stylo entre les dents :</strong> lis la phrase avec, puis sans ; ta diction devient plus nette.</li>
        <li><strong>Respire au bon endroit :</strong> une virgule = une petite pause, un point = une vraie pause.</li>
      </ul>
    </div>`;
  const tokensTarget = spkTokens(line, spk.lang);
  panel.querySelector('#spk-listen').onclick = () => spkSay(line);
  panel.querySelector('#spk-next').onclick = () => { spk.twistIx++; spkRenderArtic(); };
  const tryBtn = panel.querySelector('#spk-try');
  tryBtn.onclick = () => {
    if (spk.rec) { spk.rec.stop(); return; }
    tryBtn.textContent = '⏹️ Stop';
    panel.querySelector('#spk-score').innerHTML = '';
    spk.rec = spkListen({
      onPartial: (t) => { panel.querySelector('#spk-heard').textContent = '« ' + t + ' »'; },
      onFail: (m) => showToast(m),
      onDone: (text, ms) => {
        spk.rec = null; tryBtn.textContent = '🎤 Encore';
        if (!text) return;
        const hit = spkAlign(tokensTarget, spkTokens(text, spk.lang));
        const score = Math.round(100 * hit.filter(Boolean).length / Math.max(1, hit.length));
        // Affichage mot à mot (ou caractère à caractère) : vert = reconnu, rouge = à retravailler.
        // Un mot affiché peut contenir plusieurs jetons (l'archiduchesse, t'a-t-il) :
        // il est vert seulement si tous ses jetons ont été reconnus.
        let k = 0;
        const shown = SPK_CHAR_LANGS.has(spk.lang)
          ? [...line.replace(/[\s\p{P}\p{S}]/gu, '')].map(c => ({ w: c, ok: hit[k++] }))
          : line.split(/\s+/).filter(Boolean).map(w => {
            const n = spkTokens(w, spk.lang).length;
            const ok = n === 0 || hit.slice(k, k + n).every(Boolean);
            k += n;
            return { w, ok };
          });
        const marks = shown.map(({ w, ok }) => `<span class="${ok ? 'spk-ok' : 'spk-miss'}">${spkEsc(w)}</span>`).join(SPK_CHAR_LANGS.has(spk.lang) ? '' : ' ');
        const secs = ms / 1000;
        const verdict = score >= 90 ? 'Excellent, très net ! Essaie plus vite.' : score >= 70 ? 'Bien. Retravaille les mots en rouge.' : 'Ralentis et exagère les sons en rouge.';
        panel.querySelector('#spk-score').innerHTML = `
          <div class="spk-scorebox"><span class="spk-big">${score}%</span><span>${verdict}${secs ? `<br><span class="meta">${secs.toFixed(1)} s</span>` : ''}</span></div>
          <p class="spk-line spk-marked" dir="auto">${marks}</p>`;
        spkSaveLog({ kind: 'artic', lang: spk.lang, label: line.slice(0, 40), score });
      }
    });
    if (!spk.rec) tryBtn.textContent = '🎤 À toi';
  };
}

// --- Onglet Conversation ---
function spkRenderConvo() {
  const panel = document.getElementById('spk-panel');
  const started = spk.active;
  panel.innerHTML = `
    <div class="card-block">
      <h3>Scénario</h3>
      <select id="spk-scenario" ${started ? 'disabled' : ''}>
        ${Object.entries(spk.scenarios).map(([k, v]) => `<option value="${k}">${spkEsc(v)}</option>`).join('')}
      </select>
      <p class="meta" id="spk-sc-hint"></p>
      <div class="spk-row">
        ${started ? '<button type="button" id="spk-restart" class="secondary">↺ Nouvelle conversation</button><button type="button" id="spk-feedback">📝 Bilan du coach</button>' : '<button type="button" id="spk-start">▶️ Commencer</button>'}
        <label class="meta spk-voice"><input type="checkbox" id="spk-voice" ${spk.voiceOn ? 'checked' : ''}> Voix du partenaire</label>
      </div>
    </div>
    <div class="card-block spk-chat-block ${started ? '' : 'hidden'}">
      <div class="spk-stats" id="spk-stats"></div>
      <div class="spk-chat" id="spk-chat"></div>
      <p class="spk-live meta" id="spk-live" dir="auto"></p>
      <div class="spk-mic-row">
        <button type="button" id="spk-mic" class="spk-mic" aria-label="Parler">🎤</button>
        <form id="spk-text-form" class="spk-text-form"><input id="spk-text" placeholder="…ou écris ta réponse" autocomplete="off"><button type="submit" class="secondary">Envoyer</button></form>
      </div>
      <div id="spk-feedback-box"></div>
    </div>`;
  const sel = panel.querySelector('#spk-scenario');
  sel.value = spk.scenario;
  const hints = {
    flirt: 'Elle réagit comme une vraie personne : l\'humour, la curiosité sincère et l\'assurance tranquille marchent ; les phrases toutes faites et l\'insistance, non.',
    date: 'Pose des questions, écoute, rebondis sur ce qu\'elle dit. Ne monopolise pas la parole.',
    interview: 'Réponds avec la méthode STAR : Situation, Tâche, Action, Résultat.',
    conflict: 'Écoute, reconnais, propose une solution. Évite de te justifier.',
    pitch: 'Commence par la conclusion, puis un chiffre ou un exemple.'
  };
  const setHint = () => { panel.querySelector('#spk-sc-hint').textContent = hints[sel.value] || 'Parle naturellement. Le partenaire te relance.'; };
  setHint();
  sel.onchange = () => { spk.scenario = sel.value; setHint(); };
  panel.querySelector('#spk-voice').onchange = (e) => { spk.voiceOn = e.target.checked; localStorage.setItem('bm_spk_voice', spk.voiceOn ? '1' : '0'); if (!spk.voiceOn) window.speechSynthesis?.cancel(); };
  const startBtn = panel.querySelector('#spk-start');
  if (startBtn) startBtn.onclick = () => { spk.active = true; spk.history = []; spk.fillers = 0; spk.words = 0; spk.speakMs = 0; spkRenderConvo(); spkPartnerTurn(); };
  const restart = panel.querySelector('#spk-restart');
  if (restart) restart.onclick = () => { spkStop(); spk.active = false; spk.history = []; spkRenderConvo(); };
  const fb = panel.querySelector('#spk-feedback');
  if (fb) fb.onclick = spkFeedback;
  if (!started) return;
  spkDrawChat();
  const mic = panel.querySelector('#spk-mic');
  mic.disabled = !spkRecApi();
  mic.onclick = () => {
    if (spk.rec) { spk.rec.stop(); return; }
    if (spk.busy) return;
    mic.classList.add('on');
    spk.rec = spkListen({
      onPartial: (t) => { panel.querySelector('#spk-live').textContent = t; },
      onFail: (m) => showToast(m),
      onDone: (text, ms) => {
        spk.rec = null; mic.classList.remove('on');
        panel.querySelector('#spk-live').textContent = '';
        if (text) spkUserTurn(text, ms);
      }
    });
    if (!spk.rec) mic.classList.remove('on');
  };
  panel.querySelector('#spk-text-form').onsubmit = (e) => {
    e.preventDefault();
    const inp = panel.querySelector('#spk-text');
    if (inp.value.trim() && !spk.busy) { spkUserTurn(inp.value.trim(), 0); inp.value = ''; }
  };
}

function spkDrawChat() {
  const chat = document.getElementById('spk-chat');
  if (!chat) return;
  chat.innerHTML = spk.history.map((m, i) => `
    <div class="spk-msg ${m.role}" dir="auto">${spkEsc(m.content)}${m.role === 'assistant' ? ` <button type="button" class="spk-replay" data-i="${i}" aria-label="Réécouter">🔊</button>` : ''}</div>`).join('')
    + (spk.busy ? '<div class="spk-msg assistant spk-typing">…</div>' : '');
  chat.querySelectorAll('.spk-replay').forEach(b => b.onclick = () => spkSay(spk.history[+b.dataset.i].content));
  chat.scrollTop = chat.scrollHeight;
  const userTurns = spk.history.filter(m => m.role === 'user').length;
  const wpm = spk.speakMs > 4000 && !SPK_CHAR_LANGS.has(spk.lang) ? Math.round(spk.words / (spk.speakMs / 60000)) : null;
  const stats = document.getElementById('spk-stats');
  if (stats) stats.innerHTML = `<span><b>${userTurns}</b> répliques</span><span><b>${spk.words}</b> mots</span><span><b>${wpm ?? '–'}</b> mots/min</span><span><b>${spk.fillers}</b> mots parasites</span>`;
}

async function spkPartnerTurn() {
  spk.busy = true; spkDrawChat();
  try {
    const data = await api('/speaking/turn', { method: 'POST', body: { scenario: spk.scenario, lang: spk.lang, level: spk.level, history: spk.history } });
    spk.history.push({ role: 'assistant', content: data.reply });
    if (data.note && !spk.noteShown) { showToast(data.note); spk.noteShown = true; }
    spk.busy = false; spkDrawChat();
    if (spk.voiceOn) spkSay(data.reply);
  } catch (e) {
    spk.busy = false; spkDrawChat();
    showToast(e.message);
  }
}

function spkUserTurn(text, ms) {
  spk.history.push({ role: 'user', content: text });
  spk.fillers += spkCountFillers(text, spk.lang);
  spk.words += spkTokens(text, spk.lang).length;
  spk.speakMs += ms;
  spkPartnerTurn();
}

async function spkFeedback() {
  const box = document.getElementById('spk-feedback-box');
  const btn = document.getElementById('spk-feedback');
  if (spk.history.filter(m => m.role === 'user').length < 2) { showToast('Parle au moins deux fois avant de demander un bilan.'); return; }
  btn.disabled = true; box.innerHTML = '<p class="meta">Le coach analyse ta conversation…</p>';
  const wpm = spk.speakMs > 4000 && !SPK_CHAR_LANGS.has(spk.lang) ? Math.round(spk.words / (spk.speakMs / 60000)) : null;
  try {
    const data = await api('/speaking/feedback', { method: 'POST', body: { scenario: spk.scenario, lang: spk.lang, history: spk.history, fillers: spk.fillers, wordsPerMinute: wpm } });
    box.innerHTML = `<div class="spk-feedback"><h3>Bilan du coach</h3><div>${spkEsc(data.feedback).replace(/\n/g, '<br>')}</div></div>`;
    const m = /(\d+(?:[.,]\d)?)\s*\/\s*10/.exec(data.feedback);
    spkSaveLog({ kind: 'convo', lang: spk.lang, label: spk.scenarios[spk.scenario] || spk.scenario, score: m ? Math.round(parseFloat(m[1].replace(',', '.')) * 10) : null, fillers: spk.fillers, wpm });
  } catch (e) {
    box.innerHTML = '';
    showToast(e.message);
  } finally { btn.disabled = false; }
}

// --- Onglet Historique ---
function spkRenderLog() {
  const panel = document.getElementById('spk-panel');
  let log = [];
  try { log = JSON.parse(localStorage.getItem('bm_spk_log') || '[]'); } catch (e) { /* vide */ }
  const flag = (c) => (SPK_LANGS.find(l => l.code === c) || {}).flag || '';
  panel.innerHTML = `
    <div class="card-block">
      <h3>Tes dernières séances</h3>
      <p class="meta">Enregistré seulement sur cet appareil. Score articulation = % de mots reconnus ; score conversation = note du coach.</p>
      ${log.length ? `<div class="spk-log">${log.map(r => `
        <div class="card"><div><strong>${flag(r.lang)} ${spkEsc(r.label)}</strong>
          <div class="meta">${new Date(r.date).toLocaleDateString()} · ${r.kind === 'artic' ? 'Articulation' : 'Conversation'}${r.fillers != null ? ` · ${r.fillers} mots parasites` : ''}${r.wpm ? ` · ${r.wpm} mots/min` : ''}</div></div>
          <span class="spk-pill">${r.score != null ? r.score + '%' : '–'}</span></div>`).join('')}</div>`
        : '<p class="meta">Aucune séance pour l\'instant. Fais un virelangue ou demande un bilan après une conversation.</p>'}
    </div>`;
}
