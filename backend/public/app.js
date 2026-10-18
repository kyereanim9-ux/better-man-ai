// Configuration : adapte si ton backend tourne ailleurs.
// Chemin relatif : fonctionne que l'app soit ouverte en local, via le réseau
// local, ou via un tunnel public (ngrok, Cloudflare Tunnel...) — l'API est
// toujours sur la même origine que la page (le backend sert aussi ce frontend).
const API_BASE = '/api';

let state = {
  token: localStorage.getItem('bm_token') || null,
  user: JSON.parse(localStorage.getItem('bm_user') || 'null'),
  currentConversationId: null
};

// --- Helpers API ---
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Session invalide ou expirée : avant, ça laissait la page bloquée sur
    // "Chargement..." indéfiniment sans aucune explication. Maintenant, on
    // reconnecte clairement l'utilisateur au lieu de le laisser deviner.
    doLogout();
    showToast('Session expirée — reconnecte-toi.');
    throw new Error('Session expirée.');
  }
  if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
  return data;
}

// --- LECTEUR VOCAL (Web Speech API, gratuit, intégré au navigateur) ---
let speakerIdCounter = 0;
const SPEAKER_TEXTS = {};
function isSpeechSupported() { return typeof window !== 'undefined' && 'speechSynthesis' in window; }

// Liste des voix disponibles sur ce navigateur/OS (varie selon l'appareil).
// Chargée de façon asynchrone par certains navigateurs (Chrome), d'où l'écoute
// de l'événement 'voiceschanged'. On privilégie les voix françaises en tête de liste.
let AVAILABLE_VOICES = [];
function refreshVoices() {
  if (!isSpeechSupported()) return;
  const voices = window.speechSynthesis.getVoices();
  AVAILABLE_VOICES = voices.sort((a, b) => {
    const aFr = a.lang.startsWith('fr') ? 0 : 1;
    const bFr = b.lang.startsWith('fr') ? 0 : 1;
    return aFr - bFr;
  });
}
if (isSpeechSupported()) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function voiceOptionsHTML() {
  const savedVoice = localStorage.getItem('bm_voice_name') || '';
  if (!AVAILABLE_VOICES.length) return '';
  return `
    <select data-action="voice" title="Voix">
      <option value="">Voix par défaut</option>
      ${AVAILABLE_VOICES.map(v => `<option value="${escapeHtml(v.name)}" ${v.name === savedVoice ? 'selected' : ''}>${escapeHtml(v.name)} (${v.lang})</option>`).join('')}
    </select>
  `;
}

function speakerHTML(text) {
  if (!isSpeechSupported()) return '<div class="speaker meta">(lecture audio non supportée par ce navigateur)</div>';
  const id = 'sp' + (speakerIdCounter++);
  SPEAKER_TEXTS[id] = text;
  return `
    <div class="speaker" data-speaker="${id}">
      <button data-action="play" data-id="${id}" title="Écouter">🔊 Écouter</button>
      <button data-action="pause" data-id="${id}" title="Pause/Reprendre">⏸️</button>
      <button data-action="stop" data-id="${id}" title="Stop">⏹️</button>
      <select data-action="rate" data-id="${id}" title="Vitesse">
        <option value="0.75">x0.75</option>
        <option value="1" selected>x1</option>
        <option value="1.25">x1.25</option>
        <option value="1.5">x1.5</option>
        <option value="2">x2</option>
      </select>
      ${voiceOptionsHTML()}
    </div>
  `;
}

function buildUtterance(text, container) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = getAppLangBCP47();
  const rateSelect = container.querySelector('select[data-action="rate"]');
  utter.rate = parseFloat(rateSelect?.value || '1');

  const voiceSelect = container.querySelector('select[data-action="voice"]');
  const voiceName = voiceSelect?.value;
  if (voiceName) {
    const voice = AVAILABLE_VOICES.find(v => v.name === voiceName);
    if (voice) utter.voice = voice;
  }
  return utter;
}

document.addEventListener('change', (e) => {
  if (e.target.matches('.speaker select[data-action="voice"]')) {
    localStorage.setItem('bm_voice_name', e.target.value);
  }
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.speaker button');
  if (!btn) return;
  const { action, id } = btn.dataset;
  const text = SPEAKER_TEXTS[id];
  if (!text) return;
  const container = document.querySelector(`.speaker[data-speaker="${id}"]`);

  if (action === 'play') {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(buildUtterance(text, container));
  } else if (action === 'pause') {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) window.speechSynthesis.pause();
    else if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  } else if (action === 'stop') {
    window.speechSynthesis.cancel();
  }
});

const DOMAIN_LABELS = {
  emotionnel: 'Émotionnel', relationnel: 'Relationnel', physique: 'Physique', mental: 'Mental',
  financier: 'Financier', professionnel: 'Professionnel', social: 'Social', communication: 'Communication',
  discipline: 'Discipline', intime: 'Intimité', spirituel: 'Spirituel'
};

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
// --- Auth screen ---
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');

document.getElementById('tab-login').onclick = () => switchAuthTab('login');
document.getElementById('tab-register').onclick = () => switchAuthTab('register');

function switchAuthTab(which) {
  document.getElementById('tab-login').classList.toggle('active', which === 'login');
  document.getElementById('tab-register').classList.toggle('active', which === 'register');
  document.getElementById('login-form').classList.toggle('hidden', which !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', which !== 'register');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    onAuthSuccess(data);
  } catch (err) {
    document.getElementById('login-error').textContent = err.message;
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  try {
    const data = await api('/auth/register', { method: 'POST', body: { name, email, password } });
    onAuthSuccess(data);
  } catch (err) {
    document.getElementById('register-error').textContent = err.message;
  }
});

function onAuthSuccess(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('bm_token', data.token);
  localStorage.setItem('bm_user', JSON.stringify(data.user));
  showMain();
}

function doLogout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('bm_token');
  localStorage.removeItem('bm_user');
  authScreen.classList.remove('hidden');
  mainScreen.classList.add('hidden');
  document.getElementById('bottom-nav').classList.add('hidden');
}
document.getElementById('pd-logout').onclick = doLogout;

// --- Thème et couleur d'accent ---
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('bm_theme', theme);
  document.querySelectorAll('[data-theme-choice]').forEach(b => {
    b.classList.toggle('active-choice', b.dataset.themeChoice === theme);
  });
}
function applyAccent(accent) {
  document.body.setAttribute('data-accent', accent);
  localStorage.setItem('bm_accent', accent);
  document.querySelectorAll('[data-accent-choice]').forEach(b => {
    b.classList.toggle('active-choice', b.dataset.accentChoice === accent);
  });
}
function initAppearance() {
  applyTheme(localStorage.getItem('bm_theme') || 'dark');
  applyAccent(localStorage.getItem('bm_accent') || 'bleu');
}
document.querySelectorAll('[data-theme-choice]').forEach(b => {
  b.onclick = () => applyTheme(b.dataset.themeChoice);
});
document.querySelectorAll('[data-accent-choice]').forEach(b => {
  b.onclick = () => applyAccent(b.dataset.accentChoice);
});
initAppearance();

// --- Langue (voix + contenu IA) ---
const LANG_BCP47 = { fr: 'fr-FR', en: 'en-US', ko: 'ko-KR' };
const LANG_NAMES = { fr: 'français', en: 'anglais', ko: 'coréen' };
function getAppLang() { return localStorage.getItem('bm_lang') || 'fr'; }
function getAppLangBCP47() { return LANG_BCP47[getAppLang()] || 'fr-FR'; }
function applyLang(lang) {
  localStorage.setItem('bm_lang', lang);
  document.querySelectorAll('[data-lang-choice]').forEach(b => {
    b.classList.toggle('active-choice', b.dataset.langChoice === lang);
  });
}
document.querySelectorAll('[data-lang-choice]').forEach(b => {
  b.onclick = () => applyLang(b.dataset.langChoice);
});
applyLang(getAppLang());

// --- Toasts (XP gagné, mission terminée) ---
function showToast(html) {
  const layer = document.getElementById('toast-layer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// --- Menu profil ---
const profileDropdown = document.getElementById('profile-dropdown');
document.getElementById('avatar-btn').onclick = (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle('hidden');
};
document.addEventListener('click', (e) => {
  if (!profileDropdown.classList.contains('hidden') && !e.target.closest('.profile-menu-wrap')) {
    profileDropdown.classList.add('hidden');
  }
});
profileDropdown.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    profileDropdown.classList.add('hidden');
    switchView(btn.dataset.view);
  });
});
document.querySelector('[data-pd-action="theme"]').addEventListener('click', () => {
  profileDropdown.classList.add('hidden');
  switchView('account');
  document.getElementById('appearance-card').scrollIntoView({ behavior: 'smooth' });
});

const GREETING_QUOTES = [
  "Prêt à travailler sur toi aujourd'hui ?",
  "Une petite victoire aujourd'hui peut changer ta semaine.",
  "Quel domaine veux-tu améliorer aujourd'hui ?",
  "Chaque jour compte. Commence par une chose simple.",
  "La discipline d'aujourd'hui, c'est la force de demain.",
  "Un pas à la fois — c'est suffisant."
];
function pickDailyQuote() {
  const today = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const ch of today) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return GREETING_QUOTES[hash % GREETING_QUOTES.length];
}

function renderAvatarBtn() {
  const btn = document.getElementById('avatar-btn');
  if (state.user.avatar) {
    btn.innerHTML = `<img src="${state.user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:center;" />`;
  } else {
    btn.textContent = state.user.name.trim().slice(0, 1).toUpperCase() || '?';
  }
}

function showMain() {
  authScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');

  const first = state.user.name.trim().split(' ')[0] || state.user.name;
  document.getElementById('greeting-text').textContent = `Bonjour ${first} 👋`;
  document.getElementById('greeting-quote').textContent = pickDailyQuote();
  renderAvatarBtn();
  document.getElementById('pd-name').textContent = state.user.name;
  document.getElementById('pd-role').textContent = state.user.role === 'admin' ? 'Administrateur' : 'Membre';
  document.getElementById('pd-admin').classList.toggle('hidden', state.user.role !== 'admin');
  document.getElementById('nav-admin').classList.toggle('hidden', state.user.role !== 'admin');

  // Notification touchée : ouvrir directement la bonne section (?view=bible...).
  const viewParam = new URLSearchParams(location.search).get('view');
  const startView = viewParam && document.getElementById('view-' + viewParam) ? viewParam : 'daily';
  if (viewParam) history.replaceState(null, '', location.pathname);
  switchView(startView);
  loadNotifications();
}

// --- Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => switchView(btn.dataset.view);
});
document.querySelectorAll('.bn-btn').forEach(btn => {
  btn.onclick = () => {
    switchView(btn.dataset.view);
    if (btn.dataset.scrollMission) {
      setTimeout(() => document.getElementById('mission-card')?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };
});

function switchView(view) {
  // Quitter « Mes idées » en plein enregistrement : on le sauvegarde au lieu de laisser le micro ouvert.
  if (view !== 'ideas') {
    if (typeof ideaRecorder !== 'undefined' && ideaRecorder) stopIdeaRecording(false);
    if (typeof ideaDictation !== 'undefined' && ideaDictation) ideaDictation.stop();
  }
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.bn-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view && !b.dataset.scrollMission));
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');

  if (view === 'daily') loadDailyDashboard();
  if (view === 'coach') loadConversations();
  if (view === 'journal') loadJournal();
  if (view === 'habits') loadHabits();
  if (view === 'goals') loadGoals();
  if (view === 'bible') loadBible();
  if (view === 'library') loadLibrary();
  if (view === 'videos') loadVideos();
  if (view === 'teach') loadTeach();
  if (view === 'search') loadSearchStatus();
  if (view === 'progress') loadProgress();
  if (view === 'situation') loadSituation();
  if (view === 'communication') { /* rien à précharger */ }
  if (view === 'finance') loadFinance();
  if (view === 'physique') loadPhysique();
  if (view === 'style') loadStyle();
  if (view === 'relationships') loadRelationships();
  if (view === 'skincare') loadSkincare();
  if (view === 'nutrition') loadNutrition();
  if (view === 'image-analysis') loadImageAnalysisHistory();
  if (view === 'adaptation') { /* chargé au clic sur "Analyser" */ }
  if (view === 'domains') loadDomains();
  if (view === 'ideas') loadIdeas();
  if (view === 'pepites') loadPepites();
  if (view === 'profile-setup') loadOnboarding();
  if (view === 'whats-new') loadWhatsNew();
  if (view === 'account') { loadAccount(); renderNotifSettings(); }
  if (view === 'admin') loadAdmin();
}

// --- CATÉGORIES (accueil) ---
document.querySelectorAll('.feature-card [data-view]').forEach(btn => {
  btn.onclick = () => switchView(btn.dataset.view);
});
document.querySelectorAll('#view-account [data-view]').forEach(btn => {
  btn.onclick = () => switchView(btn.dataset.view);
});
const CATEGORIES = {
  'cat-moi': [
    { view: 'ideas', icon: '💡', name: 'Mes idées', desc: 'Tes projets : micro, photos, tâches' },
    { view: 'profile-setup', icon: '👤', name: 'Profil', desc: 'Ce que tu es, ce que tu vises' },
    { view: 'journal', icon: '📔', name: 'Journal', desc: 'Écris librement' },
    { view: 'goals', icon: '🎯', name: 'Objectifs', desc: 'Ce que tu veux atteindre' },
    { view: 'habits', icon: '✅', name: 'Habitudes', desc: 'Ce que tu répètes chaque jour' },
    { view: 'progress', icon: '📈', name: 'Progression', desc: 'Ton évolution dans le temps' }
  ],
  'cat-coaching': [
    { view: 'coach', icon: '🤖', name: 'Coach IA', desc: 'Réfléchis avant d\'agir' },
    { view: 'situation', icon: '🆘', name: 'Situation', desc: 'Analyse un moment précis' },
    { view: 'relationships', icon: '❤️', name: 'Relations', desc: 'Un espace par relation importante' },
    { view: 'communication', icon: '💬', name: 'Communication', desc: 'Mieux te faire comprendre' },
    { view: 'adaptation', icon: '⚙️', name: 'Adaptation', desc: 'Ajuste ton rythme' },
    { view: 'domains', icon: '🧠', name: 'Domaines', desc: 'Vue d\'ensemble de ta vie' }
  ],
  'cat-apprendre': [
    { view: 'pepites', icon: '✨', name: 'Pépites', desc: 'Une idée puissante en 1 minute' },
    { view: 'bible', icon: '📖', name: 'Bible', desc: 'Lire, mémoriser, appliquer' },
    { view: 'library', icon: '📚', name: 'Bibliothèque', desc: 'Tes livres et lectures' },
    { view: 'teach', icon: '🎓', name: 'Teach Me', desc: 'Apprends un sujet en 5 niveaux' },
    { view: 'videos', icon: '🎬', name: 'Vidéos', desc: 'Résumés de tes vidéos' },
    { view: 'image-analysis', icon: '📷', name: 'Analyse photo', desc: 'Prends une photo, discute avec l\'IA' },
    { view: 'search', icon: '🌐', name: 'Recherche', desc: 'Chercher sur le web' }
  ],
  'cat-corps': [
    { view: 'physique', icon: '💪', name: 'Physique', desc: 'Construis un corps plus fort' },
    { view: 'style', icon: '👔', name: 'Style', desc: 'Présentation et image' },
    { view: 'skincare', icon: '🧴', name: 'Skincare', desc: 'Routine coréenne, suivi quotidien' },
    { view: 'nutrition', icon: '🍽️', name: 'Alimentation', desc: 'Journal photo de tes repas' }
  ],
  'cat-vie': [
    { view: 'finance', icon: '💰', name: 'Finance', desc: 'Dépenses et épargne' }
  ]
};
function getHiddenSections() {
  try { return JSON.parse(localStorage.getItem('bm_hidden_sections') || '[]'); } catch (e) { return []; }
}
function renderCategories(domainScores) {
  window._lastDomainScores = domainScores;
  const hiddenSections = getHiddenSections();
  const DOMAIN_MAP = { physique: 'physique', finance: 'financier', bible: 'spirituel', communication: 'communication', intimacy: 'intime' };
  for (const [gridId, items] of Object.entries(CATEGORIES)) {
    const el = document.getElementById(gridId);
    if (!el) continue;
    const visibleItems = items.filter(it => !hiddenSections.includes(it.view));
    const block = el.closest('.category-block');
    if (block) block.style.display = visibleItems.length ? '' : 'none';
    el.innerHTML = visibleItems.map(it => {
      const domainKey = DOMAIN_MAP[it.view];
      const score = domainScores && domainKey ? domainScores[domainKey] : null;
      return `
        <button class="nav-card" data-view="${it.view}">
          <span class="nav-icon">${it.icon}</span>
          <span class="nav-name">${escapeHtml(it.name)}</span>
          <span class="nav-desc">${escapeHtml(it.desc)}</span>
          ${score != null ? `<span class="nav-progress">${score}% cette semaine</span>` : ''}
        </button>
      `;
    }).join('');
    el.querySelectorAll('[data-view]').forEach(btn => { btn.onclick = () => switchView(btn.dataset.view); });
  }
}

// --- DAILY : tableau de bord d'accueil ---
async function loadDailyDashboard() {
  loadDailyPepite();
  try {
    const [daily, gami, domains, verseOfDay] = await Promise.all([
      api('/daily'),
      api('/gamification/status'),
      api('/domains/scores').catch(() => null),
      api('/bible/verse-of-day').catch(() => null)
    ]);

    document.getElementById('xp-level-num').textContent = gami.level;
    document.getElementById('xp-level-name').textContent = gami.levelName;
    document.getElementById('xp-fill').style.width = gami.progressToNext + '%';
    document.getElementById('xp-current').textContent = `${gami.xp} XP`;
    document.getElementById('xp-next').textContent = gami.nextLevel ? `${gami.nextLevel.xpNeeded} XP avant le niveau ${gami.nextLevel.level}` : 'Niveau maximum';
    document.getElementById('xp-streak').textContent = `🔥 ${gami.streak} jour${gami.streak > 1 ? 's' : ''} de série`;

    document.getElementById('mission-sub').textContent = daily.suggestion;
    const total = daily.mission.length;
    document.getElementById('mission-count').textContent = `0 / ${total} missions terminées`;
    document.getElementById('mission-progress-fill').style.width = '0%';
    document.getElementById('mission-list').innerHTML = daily.mission.length
      ? daily.mission.map(m => `
          <div class="mission-item" data-mission-type="${m.type}" data-mission-id="${m.id}">
            <span class="check">✓</span>
            <span class="label">${m.type === 'habit' ? '✅' : m.type === 'goal' ? '🎯' : '📖'} ${escapeHtml(m.title)}</span>
          </div>
        `).join('')
      : '<p class="meta" style="color:rgba(255,255,255,0.85);">Aucune mission pour l\'instant — ajoute une habitude ou un objectif pour démarrer.</p>';
    bindMissionItems();

    if (verseOfDay) {
      document.getElementById('daily-bible-verse').innerHTML = `"${escapeHtml(verseOfDay.verse.text)}" <span class="verse-ref">— ${escapeHtml(verseOfDay.verse.ref)}</span>`;
    }

    const weekScores = domains ? domains.week : null;
    renderCategories(weekScores);

    const homeDash = document.getElementById('home-domains-dashboard');
    if (weekScores) {
      const top = Object.entries(weekScores).sort((a, b) => b[1] - a[1]).slice(0, 4);
      homeDash.innerHTML = top.map(([d, score]) => `
        <div class="domain-row">
          <span>${DOMAIN_LABELS[d] || d}</span>
          <div class="domain-bar-track"><div class="domain-bar-fill" style="width:${score}%"></div></div>
          <span>${score}</span>
        </div>
      `).join('') || '<p class="meta">Pas encore de données cette semaine.</p>';
    } else {
      homeDash.innerHTML = '<p class="meta">Indisponible pour l\'instant.</p>';
    }

    try {
      const reflection = await api('/progress/daily-reflection');
      if (reflection) {
        document.getElementById('reflection-accomplished').value = reflection.accomplished || '';
        document.getElementById('reflection-difficult').value = reflection.difficult || '';
        document.getElementById('reflection-learned').value = reflection.learned || '';
        document.getElementById('reflection-differently').value = reflection.differently || '';
        document.getElementById('daily-reflection-status').textContent = 'Déjà rempli aujourd\'hui — tu peux le modifier.';
      }
    } catch { /* pas bloquant */ }
  } catch (err) {
    document.getElementById('mission-sub').textContent = 'Erreur : ' + err.message;
  }
}

function bindMissionItems() {
  document.querySelectorAll('.mission-item').forEach(item => {
    item.onclick = async () => {
      if (item.classList.contains('done')) return;
      const type = item.dataset.missionType;
      const id = item.dataset.missionId;
      try {
        if (type === 'habit') await api(`/habits/${id}/done`, { method: 'POST' });
        else if (type === 'goal') await api(`/goals/${id}`, { method: 'PATCH', body: { status: 'done' } });
        else if (type === 'bible') await api(`/bible/memorization/${id}/advance`, { method: 'POST' });

        item.classList.add('done');
        const done = document.querySelectorAll('.mission-item.done').length;
        const total = document.querySelectorAll('.mission-item').length;
        document.getElementById('mission-count').textContent = `${done} / ${total} missions terminées`;
        document.getElementById('mission-progress-fill').style.width = Math.round((done / total) * 100) + '%';
        showToast(`<span class="xp-amount">+XP</span> Mission terminée 🎉`);
      } catch (err) {
        showToast(err.message);
      }
    };
  });
}


async function loadConversations() {
  const list = await api('/chat/conversations');
  const el = document.getElementById('conversation-list');
  el.innerHTML = list.map(c => `
    <div class="conv-item ${c.id === state.currentConversationId ? 'active' : ''}" data-id="${c.id}">
      <span>${c.title}</span>
    </div>
  `).join('') || '<p class="meta">Aucune conversation</p>';

  el.querySelectorAll('.conv-item').forEach(item => {
    item.onclick = () => openConversation(item.dataset.id);
  });

  if (!state.currentConversationId && list.length) openConversation(list[0].id);
}

document.getElementById('new-conv-btn').onclick = async () => {
  const conv = await api('/chat/conversations', { method: 'POST', body: { title: 'Nouvelle conversation' } });
  state.currentConversationId = conv.id;
  await loadConversations();
  renderMessages(conv.messages);
};

async function openConversation(id) {
  state.currentConversationId = id;
  const conv = await api(`/chat/conversations/${id}`);
  await loadConversations();
  renderMessages(conv.messages);
}

function renderMessages(messages) {
  const el = document.getElementById('messages');
  el.innerHTML = messages.map(m => `
    <div class="msg ${m.role}">
      <div>${m.hasPhoto ? '📷 ' : ''}${escapeHtml(m.content)}</div>
      ${m.role === 'assistant' ? speakerHTML(m.content) : ''}
      ${m.role === 'assistant' && m.source ? `<div class="meta" style="margin-top:4px;">${m.source === 'local' ? '⚙️ Coach local (aucune IA externe configurée ou toutes indisponibles)' : `✅ Répondu par ${escapeHtml(m.source)}`}</div>` : ''}
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

let selectedMessagePhoto = null;
document.getElementById('message-photo-btn').onclick = () => document.getElementById('message-photo-input').click();
document.getElementById('message-photo-input').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  selectedMessagePhoto = await resizeImageToDataUrl(file, 700, 0.8);
  document.getElementById('message-photo-status').textContent = '📷 Photo prête à être envoyée — écris ta question (optionnel) et envoie.';
};

if (SpeechRecognitionAPI) {
  const micBtn = document.getElementById('message-mic-btn');
  let micListening = false;
  let micRecognition = null;
  micBtn.onclick = () => {
    if (micListening) { micRecognition.stop(); return; }
    const input = document.getElementById('message-input');
    micRecognition = new SpeechRecognitionAPI();
    micRecognition.lang = getAppLangBCP47();
    micRecognition.interimResults = true;
    const base = input.value ? input.value + ' ' : '';
    micRecognition.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      input.value = base + text;
    };
    micRecognition.onerror = (e) => {
      const messages = { 'not-allowed': "Permission micro refusée.", 'no-speech': "Aucune voix détectée." };
      showToast(messages[e.error] || `Erreur micro (${e.error})`);
    };
    micRecognition.onend = () => { micListening = false; micBtn.textContent = '🎤'; };
    micRecognition.start();
    micListening = true;
    micBtn.textContent = '⏹️';
  };
} else {
  document.getElementById('message-mic-btn').disabled = true;
}

document.getElementById('message-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  const photo = selectedMessagePhoto;
  if (!content && !photo) return;
  if (!state.currentConversationId) {
    const conv = await api('/chat/conversations', { method: 'POST', body: { title: (content || 'Photo').slice(0, 30) } });
    state.currentConversationId = conv.id;
    await loadConversations();
  }
  input.value = '';
  selectedMessagePhoto = null;
  document.getElementById('message-photo-status').textContent = '';
  document.getElementById('message-photo-input').value = '';
  await api(`/chat/conversations/${state.currentConversationId}/messages`, {
    method: 'POST', body: { content, photo, lang: LANG_NAMES[getAppLang()] }
  });
  const conv = await api(`/chat/conversations/${state.currentConversationId}`);
  renderMessages(conv.messages);
});

// --- JOURNAL ---
async function loadJournal() {
  const entries = await api('/journal');
  const el = document.getElementById('journal-list');
  el.innerHTML = entries.map(e => `
    <div class="card" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div>
          <div>${escapeHtml(e.content)}</div>
          <div class="meta">${new Date(e.createdAt).toLocaleString('fr-FR')}</div>
          ${speakerHTML(e.content)}
        </div>
        <button class="small danger" data-id="${e.id}">Supprimer</button>
      </div>
      ${e.questions?.length ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
          ${e.domains?.length ? `<div class="badge-row" style="margin-bottom:8px;">${e.domains.map(d => `<span class="badge">${escapeHtml(DOMAIN_LABELS[d] || d)}</span>`).join('')}</div>` : ''}
          <p class="meta" style="font-weight:700;margin-bottom:4px;">Pour réfléchir</p>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--muted);">${e.questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>
        </div>
      ` : ''}
    </div>
  `).join('') || '<p class="meta">Aucune entrée pour l\'instant.</p>';

  el.querySelectorAll('button[data-id]').forEach(btn => {
    btn.onclick = async () => { await api(`/journal/${btn.dataset.id}`, { method: 'DELETE' }); loadJournal(); };
  });
}

document.getElementById('journal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('journal-input');
  if (!input.value.trim()) return;
  await api('/journal', { method: 'POST', body: { content: input.value } });
  input.value = '';
  loadJournal();
});

// --- HABITS ---
async function loadHabits() {
  const habits = await api('/habits');
  const today = new Date().toISOString().slice(0, 10);
  const el = document.getElementById('habits-list');
  el.innerHTML = habits.map(h => `
    <div class="card">
      <span>${escapeHtml(h.title)} <span class="meta">(${DOMAIN_LABELS[h.domain] || h.domain})</span> ${h.doneDates.includes(today) ? '✅' : ''}</span>
      <div>
        <select data-change-domain="${h.id}">
          ${Object.entries(DOMAIN_LABELS).map(([key, label]) => `<option value="${key}" ${h.domain === key ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button class="small" data-done="${h.id}">Fait aujourd'hui</button>
        <button class="small danger" data-del="${h.id}">Supprimer</button>
      </div>
    </div>
  `).join('') || '<p class="meta">Aucune habitude pour l\'instant.</p>';

  el.querySelectorAll('button[data-done]').forEach(btn => {
    btn.onclick = async () => { await api(`/habits/${btn.dataset.done}/done`, { method: 'POST' }); loadHabits(); };
  });
  el.querySelectorAll('button[data-del]').forEach(btn => {
    btn.onclick = async () => { await api(`/habits/${btn.dataset.del}`, { method: 'DELETE' }); loadHabits(); };
  });
  el.querySelectorAll('select[data-change-domain]').forEach(sel => {
    sel.onchange = async () => { await api(`/habits/${sel.dataset.changeDomain}`, { method: 'PATCH', body: { domain: sel.value } }); loadHabits(); };
  });
}

document.getElementById('habit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('habit-input');
  const domain = document.getElementById('habit-domain').value;
  if (!input.value.trim()) return;
  await api('/habits', { method: 'POST', body: { title: input.value, domain } });
  input.value = '';
  loadHabits();
});

// --- GOALS ---
async function loadGoals() {
  const goals = await api('/goals');
  const el = document.getElementById('goals-list');
  el.innerHTML = goals.map(g => `
    <div class="card">
      <span>${escapeHtml(g.title)} <span class="meta">(${g.category} — ${g.status})</span></span>
      <div>
        <button class="small" data-done="${g.id}">Marquer fait</button>
        <button class="small danger" data-del="${g.id}">Supprimer</button>
      </div>
    </div>
  `).join('') || '<p class="meta">Aucun objectif pour l\'instant.</p>';

  el.querySelectorAll('button[data-done]').forEach(btn => {
    btn.onclick = async () => { await api(`/goals/${btn.dataset.done}`, { method: 'PATCH', body: { status: 'done' } }); loadGoals(); };
  });
  el.querySelectorAll('button[data-del]').forEach(btn => {
    btn.onclick = async () => { await api(`/goals/${btn.dataset.del}`, { method: 'DELETE' }); loadGoals(); };
  });
}

document.getElementById('goal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('goal-input');
  const category = document.getElementById('goal-category').value;
  if (!input.value.trim()) return;
  await api('/goals', { method: 'POST', body: { title: input.value, category } });
  input.value = '';
  loadGoals();
});

// --- ADMIN ---
async function loadAdmin() {
  try {
    const status = await api('/meta/system-status');
    document.getElementById('admin-system-status').innerHTML = `
      <div class="badge-row">
        <span class="badge">Version ${escapeHtml(status.version)}</span>
        <span class="badge">Node ${escapeHtml(status.nodeVersion)}</span>
        <span class="badge">Uptime ${status.uptimeSeconds}s</span>
        <span class="badge">${status.counts.users} utilisateur(s)</span>
      </div>
    `;
  } catch {
    document.getElementById('admin-system-status').textContent = 'Indisponible.';
  }

  const users = await api('/admin/users');
  const el = document.getElementById('admin-users-list');
  el.innerHTML = users.map(u => `
    <div class="card">
      <span>${escapeHtml(u.name)} — ${escapeHtml(u.email)} <span class="meta">(${u.role}${u.active ? '' : ', désactivé'})</span></span>
      <div>
        <button class="small" data-toggle="${u.id}" data-active="${u.active}">${u.active ? 'Désactiver' : 'Activer'}</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('button[data-toggle]').forEach(btn => {
    btn.onclick = async () => {
      const active = btn.dataset.active === 'true';
      await api(`/admin/users/${btn.dataset.toggle}`, { method: 'PATCH', body: { active: !active } });
      loadAdmin();
    };
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- BIBLE ---
async function loadBible() {
  initBibleFinder();
  loadBiblePlans();
  loadBibleFavorites();
  try {
    const [vod, rod, qod] = await Promise.all([
      api('/bible/verse-of-day'),
      api('/bible/reading-of-day'),
      api('/bible/question-of-day')
    ]);

    document.getElementById('bible-verse-of-day').innerHTML = renderVerseBlock(vod.verse);
    document.getElementById('bible-reading-of-day').innerHTML = renderVerseBlock(rod.verse);
    document.getElementById('bible-question-of-day').innerHTML = `
      <div class="verse-ref">${escapeHtml(qod.verse.ref)}</div>
      <div>${escapeHtml(qod.question)}</div>
      ${speakerHTML(qod.question)}
    `;
    bindAddMemButtons(document.getElementById('bible-verse-of-day'));
    bindAddMemButtons(document.getElementById('bible-reading-of-day'));
  } catch (err) {
    document.getElementById('bible-verse-of-day').textContent = 'Erreur : ' + err.message;
    document.getElementById('bible-reading-of-day').textContent = 'Erreur : ' + err.message;
    document.getElementById('bible-question-of-day').textContent = 'Erreur : ' + err.message;
    return;
  }

  loadMemorization();
}

function renderVerseBlock(verse) {
  return `
    <div>${escapeHtml(verse.text)}</div>
    <div class="verse-ref">${escapeHtml(verse.ref)}</div>
    ${speakerHTML(verse.text)}
    <button class="small" data-add-mem="${escapeHtml(verse.ref)}">➕ Ajouter à la mémorisation</button>
    <button class="small" data-read-ref="${escapeHtml(verse.ref)}">📖 Lire le chapitre</button>
  `;
}

function bindAddMemButtons(container) {
  container.querySelectorAll('[data-add-mem]').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api('/bible/memorization', { method: 'POST', body: { ref: btn.dataset.addMem } });
        btn.textContent = 'Ajouté ✅';
        btn.disabled = true;
        loadMemorization();
      } catch (err) {
        showToast(escapeHtml(err.message));
      }
    };
  });
  container.querySelectorAll('[data-fav-ref]').forEach(btn => {
    btn.onclick = async () => {
      const ref = btn.dataset.favRef;
      try {
        if (bibleFavRefs.has(ref)) {
          const fav = bibleFavorites.find(f => f.ref === ref);
          if (fav) await api(`/bible/favorites/${fav.id}`, { method: 'DELETE' });
          btn.textContent = '☆ Favori';
        } else {
          await api('/bible/favorites', { method: 'POST', body: { ref } });
          btn.textContent = '⭐ Favori';
          showToast('⭐ Ajouté à tes versets favoris');
        }
        loadBibleFavorites();
      } catch (err) { showToast(escapeHtml(err.message)); }
    };
  });
  // « Lire le chapitre » : ouvre le lecteur en haut de la page Bible.
  container.querySelectorAll('[data-read-ref]').forEach(btn => {
    btn.onclick = () => {
      const chapterRef = btn.dataset.readRef.replace(/:\d+(-\d+)?$/, '');
      runBibleLookup(chapterRef, true);
    };
  });
}

// --- Bible complète : recherche, lecture par chapitre, ajout à la mémorisation ---
let bibleBooks = null;
async function initBibleFinder() {
  if (bibleBooks) return;
  try { bibleBooks = await api('/bible/books'); } catch (e) { return; }
  const bookSel = document.getElementById('bible-book-select');
  bookSel.innerHTML = '<option value="">📚 Parcourir un livre…</option>' +
    `<optgroup label="Ancien Testament">${bibleBooks.slice(0, 39).map(b => `<option value="${b.index}">${escapeHtml(b.name)}</option>`).join('')}</optgroup>` +
    `<optgroup label="Nouveau Testament">${bibleBooks.slice(39).map(b => `<option value="${b.index}">${escapeHtml(b.name)}</option>`).join('')}</optgroup>`;
}

function fillChapterSelect(bookIndex, selected) {
  const chSel = document.getElementById('bible-chapter-select');
  const book = bibleBooks?.[bookIndex];
  if (!book) { chSel.disabled = true; chSel.innerHTML = '<option value="">Chapitre</option>'; return; }
  chSel.disabled = false;
  chSel.innerHTML = Array.from({ length: book.chapters }, (_, i) => `<option value="${i + 1}" ${i + 1 === selected ? 'selected' : ''}>Chapitre ${i + 1}</option>`).join('');
}

function verseRowHTML(v, showRef) {
  return `
    <div class="bible-verse-row">
      <div class="bible-verse-text">${showRef ? '' : `<sup>${v.verse}</sup> `}${v.html || escapeHtml(v.text)}</div>
      <div class="bible-verse-meta">
        ${showRef ? `<span class="verse-ref">${escapeHtml(v.ref)}</span>` : ''}
        <button type="button" class="small" data-add-mem="${escapeHtml(v.ref)}">➕ Mémoriser</button>
        <button type="button" class="small" data-fav-ref="${escapeHtml(v.ref)}">${bibleFavRefs.has(v.ref) ? '⭐ Favori' : '☆ Favori'}</button>
        ${showRef ? `<button type="button" class="small" data-read-ref="${escapeHtml(v.ref)}">📖 Chapitre</button>` : ''}
      </div>
    </div>`;
}

function highlightWords(text, query) {
  const words = stripAccentsClient(query.toLowerCase()).split(/\s+/).filter(w => w.length > 1);
  return text.split(/(\s+)/).map(tok => {
    const t = stripAccentsClient(tok.toLowerCase()).replace(/^[^a-z0-9]+/, '');
    return words.some(w => t.startsWith(w) || t.includes("'" + w) || t.includes('’' + w)) ? `<mark>${escapeHtml(tok)}</mark>` : escapeHtml(tok);
  }).join('');
}

async function runBibleLookup(q, scrollIntoView) {
  const out = document.getElementById('bible-lookup-results');
  document.getElementById('bible-lookup-input').value = q;
  out.innerHTML = '<p class="meta">Recherche…</p>';
  if (scrollIntoView) document.getElementById('bible-finder').scrollIntoView({ behavior: 'smooth' });
  let data;
  try { data = await api(`/bible/lookup?q=${encodeURIComponent(q)}`); }
  catch (e) { out.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`; return; }

  if (data.type === 'ref') {
    await initBibleFinder();
    document.getElementById('bible-book-select').value = String(data.bookIndex);
    fillChapterSelect(data.bookIndex, data.chapter);
    // Plage de versets demandée (« 1 Co 13:4-7 ») : on propose de la mémoriser d'un coup.
    const isPassage = q.includes(':') && data.verses.length > 1 && data.verses.length <= 10;
    const passageRef = isPassage ? `${data.book} ${data.chapter}:${data.verses[0].verse}-${data.verses.at(-1).verse}` : null;
    out.innerHTML = `
      <div class="bible-reader-head">
        <button type="button" class="small" data-ch-nav="-1" ${data.chapter <= 1 ? 'disabled' : ''}>◀</button>
        <strong>${escapeHtml(data.book)} ${data.chapter}</strong>
        <button type="button" class="small" data-ch-nav="1" ${data.chapter >= data.chapters ? 'disabled' : ''}>▶</button>
      </div>
      ${passageRef ? `<button type="button" class="small" data-add-mem="${escapeHtml(passageRef)}">➕ Mémoriser tout le passage (${escapeHtml(passageRef)})</button>` : ''}
      ${data.verses.length < 40 && data.verses.length > 1 ? speakerHTML(data.verses.map(v => v.text).join(' ')) : ''}
      ${data.verses.map(v => verseRowHTML(v, false)).join('')}
      ${data.verses.length === 1 || passageRef ? `<button type="button" class="small" data-read-ref="${escapeHtml(data.verses[0].ref)}">📖 Lire tout le chapitre</button>` : ''}`;
    out.querySelectorAll('[data-ch-nav]').forEach(b => {
      b.onclick = () => runBibleLookup(`${data.book} ${data.chapter + Number(b.dataset.chNav)}`);
    });
  } else {
    document.getElementById('bible-book-select').value = '';
    fillChapterSelect(-1);
    out.innerHTML = data.total
      ? `<p class="meta">${data.total} verset(s) trouvé(s)${data.total > data.results.length ? ` — les ${data.results.length} premiers, précise ta recherche avec plus de mots` : ''}.</p>` +
        data.results.map(v => verseRowHTML({ ...v, html: highlightWords(v.text, q) }, true)).join('')
      : '<p class="meta">Aucun verset ne contient tous ces mots. Essaie un autre mot, ou une référence comme « Jean 3:16 ».</p>';
  }
  bindAddMemButtons(out);
}

document.getElementById('bible-lookup-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = document.getElementById('bible-lookup-input').value.trim();
  if (q) runBibleLookup(q);
});
document.getElementById('bible-book-select').addEventListener('change', (e) => {
  if (e.target.value === '') { fillChapterSelect(-1); return; }
  const b = Number(e.target.value);
  fillChapterSelect(b, 1);
  runBibleLookup(`${bibleBooks[b].name} 1`);
});
document.getElementById('bible-chapter-select').addEventListener('change', (e) => {
  const b = Number(document.getElementById('bible-book-select').value);
  runBibleLookup(`${bibleBooks[b].name} ${e.target.value}`);
});
document.getElementById('bible-custom-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/bible/memorization', { method: 'POST', body: {
      ref: document.getElementById('bible-custom-ref').value,
      text: document.getElementById('bible-custom-text').value
    } });
    e.target.reset();
    showToast('✅ Verset ajouté à ta mémorisation.');
    loadMemorization();
  } catch (err) { showToast(escapeHtml(err.message)); }
});

document.getElementById('bible-search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = document.getElementById('bible-search-input').value.trim();
  if (!q) return;
  const results = await api('/bible/search?q=' + encodeURIComponent(q));
  const el = document.getElementById('bible-search-results');
  el.innerHTML = results.length
    ? results.map(v => `<div class="card-block">${renderVerseBlock(v)}</div>`).join('')
    : '<p class="meta">Aucun résultat. Essaie un autre mot-clé.</p>';
  bindAddMemButtons(el);
});

document.getElementById('bible-ask-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('bible-ask-input');
  const question = input.value.trim();
  if (!question) return;
  const data = await api('/bible/ask', { method: 'POST', body: { question } });
  const el = document.getElementById('bible-ask-result');
  el.innerHTML = `
    <p class="meta">TEXTE BIBLIQUE</p>
    ${data.texteBiblique.map(v => `<div class="card-block">${renderVerseBlock(v)}</div>`).join('') || '<p class="meta">Aucun passage trouvé.</p>'}
    <p class="meta">APPLICATION (interprétation, pas une réponse directe)</p>
    <p>${escapeHtml(data.application)}</p>
  `;
  bindAddMemButtons(el);
});

// --- Quiz à trous : on écrit sa réponse, l'app vérifie et montre la bonne ---
const quizScore = { good: 0, total: 0 };
function renderQuizScore() {
  document.getElementById('bible-quiz-score').textContent = quizScore.total
    ? `Score de la session : ${quizScore.good} / ${quizScore.total} bonne(s) réponse(s)` : '';
}

async function loadBibleQuiz() {
  const source = document.getElementById('bible-quiz-source').value;
  const book = document.getElementById('bible-quiz-book').value;
  const el = document.getElementById('bible-quiz-result');
  let quiz;
  try { quiz = await api(`/bible/quiz?source=${source}${source === 'book' ? `&book=${encodeURIComponent(book)}` : ''}`); }
  catch (e) { el.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`; return; }
  el.innerHTML = `
    ${source === 'mine' && quiz.source !== 'mine' ? '<p class="meta">Tu n\'as pas encore de verset en mémorisation : question tirée de la sélection de versets.</p>' : ''}
    <p class="quiz-prompt">${escapeHtml(quiz.prompt).replace('_____', '<span class="quiz-blank">_____</span>')}</p>
    <p class="meta">${quiz.bookName ? `📖 Quiz : ${escapeHtml(quiz.bookName)} · ` : ''}${escapeHtml(quiz.ref)} — mot de ${quiz.answerLength} lettres</p>
    <form id="bible-quiz-form" class="quiz-form">
      <input type="text" id="bible-quiz-answer" placeholder="Ta réponse" autocomplete="off" autocapitalize="off" />
      <button type="submit">Vérifier</button>
    </form>
    <div class="quiz-actions">
      <button type="button" class="small" id="bible-quiz-hint">💡 Indice</button>
      <button type="button" class="small" id="bible-quiz-reveal">👁️ Voir la réponse</button>
    </div>
    <div id="bible-quiz-feedback"></div>
  `;
  const input = document.getElementById('bible-quiz-answer');
  input.focus();
  let answered = false;

  const showResult = (r, revealed) => {
    if (!answered) { answered = true; quizScore.total++; if (r.correct) quizScore.good++; renderQuizScore(); }
    // Surligne le mot à sa position exacte (un même mot peut apparaître plusieurs fois).
    const full = r.fullText.split(' ').map((w, i) => i === quiz.blankIndex
      ? escapeHtml(w).replace(escapeHtml(r.expected), `<strong class="quiz-good">${escapeHtml(r.expected)}</strong>`)
      : escapeHtml(w)).join(' ');
    document.getElementById('bible-quiz-feedback').innerHTML = `
      <div class="quiz-feedback ${r.correct ? 'ok' : 'ko'}">
        ${revealed ? '👁️ Réponse' : r.correct ? (r.typo ? '✅ Correct (petite faute d\'orthographe)' : '✅ Bonne réponse !') : `❌ Pas tout à fait — tu as écrit « ${escapeHtml(input.value.trim() || '…')} »`}
        <div>Bonne réponse : <strong>${escapeHtml(r.expected)}</strong></div>
        <p class="quiz-verse">« ${full} » <span class="meta">— ${escapeHtml(r.ref)}</span></p>
        <button type="button" id="bible-quiz-next">Question suivante ➜</button>
      </div>`;
    document.getElementById('bible-quiz-form').querySelector('button').disabled = true;
    input.disabled = true;
    document.getElementById('bible-quiz-next').onclick = loadBibleQuiz;
  };
  const check = async (reveal) => {
    try {
      const r = await api('/bible/quiz/check', { method: 'POST', body: { ref: quiz.ref, blankIndex: quiz.blankIndex, answer: input.value, reveal } });
      showResult(r, reveal);
    } catch (e) { showToast(escapeHtml(e.message)); }
  };
  document.getElementById('bible-quiz-form').onsubmit = (e) => {
    e.preventDefault();
    if (!input.value.trim()) { input.focus(); return; }
    check(false);
  };
  document.getElementById('bible-quiz-hint').onclick = (e) => {
    input.placeholder = `Commence par « ${quiz.hint.toUpperCase()} »`;
    e.target.disabled = true;
    input.focus();
  };
  document.getElementById('bible-quiz-reveal').onclick = () => check(true);
}
document.getElementById('bible-quiz-btn').onclick = loadBibleQuiz;

// « Un livre précis » : liste des 66 livres, Apocalypse sélectionnée par défaut.
document.getElementById('bible-quiz-source').addEventListener('change', async (e) => {
  const sel = document.getElementById('bible-quiz-book');
  const isBook = e.target.value === 'book';
  sel.classList.toggle('hidden', !isBook);
  if (isBook && !sel.options.length) {
    await initBibleFinder();
    if (!bibleBooks) return;
    sel.innerHTML = `<optgroup label="Ancien Testament">${bibleBooks.slice(0, 39).map(b => `<option value="${b.index}">${escapeHtml(b.name)}</option>`).join('')}</optgroup>` +
      `<optgroup label="Nouveau Testament">${bibleBooks.slice(39).map(b => `<option value="${b.index}">${escapeHtml(b.name)}</option>`).join('')}</optgroup>`;
    sel.value = String(bibleBooks.findIndex(b => b.name === 'Apocalypse'));
  }
  quizScore.good = 0; quizScore.total = 0; renderQuizScore();
});
document.getElementById('bible-quiz-book').addEventListener('change', () => { quizScore.good = 0; quizScore.total = 0; renderQuizScore(); });

// --- Exercice à trous pour un verset en mémorisation ---
// Plus l'étape est avancée, plus il y a de mots à retrouver.
const MEM_BLANK_RATIO = { read: 0.15, fill_blanks: 0.25, recite: 0.4, test: 0.5, review_1: 0.6, review_final: 0.75, mastered: 0.75 };
const normWord = (w) => stripAccentsClient(String(w).toLowerCase()).replace(/[’']/g, "'").replace(/[^a-z0-9']/g, '');

function openMemExercise(item, canValidate) {
  const panel = document.getElementById(`recite-panel-${item.id}`);
  const isOpen = !panel.classList.contains('hidden') && panel.dataset.mode === 'exercise';
  document.querySelectorAll('[id^="recite-panel-"]').forEach(p => p.classList.add('hidden'));
  if (isOpen) return;
  panel.dataset.mode = 'exercise';
  panel.classList.remove('hidden');

  const words = item.text.split(' ');
  const candidates = words.map((w, i) => i).filter(i => normWord(words[i]).length > 2);
  const count = Math.max(1, Math.round(candidates.length * (MEM_BLANK_RATIO[item.stageKey] ?? 0.3)));
  const blanks = new Set([...candidates].sort(() => Math.random() - 0.5).slice(0, count));

  panel.innerHTML = `
    <div class="card-block mem-exercise">
      <p class="meta">🧩 Complète les ${blanks.size} mot(s) manquant(s) de ${escapeHtml(item.ref)}</p>
      <p class="mem-text">${words.map((w, i) => {
        if (!blanks.has(i)) return escapeHtml(w);
        const core = w.replace(/[.,;:!?«»"()]/g, '');
        const punct = w.slice(core.length);
        return `<input class="mem-blank" data-i="${i}" size="${Math.max(3, core.length)}" autocomplete="off" autocapitalize="off" />${escapeHtml(punct)}`;
      }).join(' ')}</p>
      <div class="quiz-actions">
        <button type="button" data-mem-check>Vérifier</button>
        <button type="button" class="small" data-mem-show>👁️ Voir le verset</button>
      </div>
      <div data-mem-feedback></div>
    </div>`;
  const inputs = [...panel.querySelectorAll('.mem-blank')];
  inputs[0]?.focus();
  inputs.forEach((inp, k) => inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); (inputs[k + 1] || panel.querySelector('[data-mem-check]')).focus(); }
  }));

  panel.querySelector('[data-mem-check]').onclick = () => {
    let good = 0;
    inputs.forEach(inp => {
      const expected = words[Number(inp.dataset.i)].replace(/[.,;:!?«»"()]/g, '');
      const ok = normWord(inp.value) === normWord(expected) || normWord(inp.value) === normWord(expected).replace(/^[a-z]'/, '');
      if (ok) good++;
      inp.classList.toggle('ok', ok);
      inp.classList.toggle('ko', !ok);
      if (!ok) inp.title = `Bonne réponse : ${expected}`;
    });
    const pct = Math.round((good / inputs.length) * 100);
    const corrections = inputs.filter(i => i.classList.contains('ko'))
      .map(i => `<li>« ${escapeHtml(i.value || '…')} » → <strong>${escapeHtml(words[Number(i.dataset.i)].replace(/[.,;:!?«»"()]/g, ''))}</strong></li>`).join('');
    panel.querySelector('[data-mem-feedback]').innerHTML = `
      <div class="quiz-feedback ${pct >= 80 ? 'ok' : 'ko'}">
        ${pct >= 80 ? '✅' : '🔁'} ${good} / ${inputs.length} mots trouvés (${pct} %)
        ${corrections ? `<ul class="mem-corrections">${corrections}</ul>` : ''}
        <p class="quiz-verse">« ${escapeHtml(item.text)} »</p>
        ${pct >= 80 && canValidate ? `<button type="button" data-mem-validate>✅ Valider cette étape</button>` : ''}
        ${pct < 80 ? '<p class="meta">Objectif : 80 % pour valider l\'étape. Relis le verset et réessaie.</p>' : ''}
        <button type="button" class="small" data-mem-retry>🔁 Nouvel essai</button>
      </div>`;
    panel.querySelector('[data-mem-retry]').onclick = () => { panel.classList.add('hidden'); openMemExercise(item, canValidate); };
    const validate = panel.querySelector('[data-mem-validate]');
    if (validate) validate.onclick = async () => {
      await api(`/bible/memorization/${item.id}/advance`, { method: 'POST' });
      showToast('✅ Étape validée, bravo !');
      loadMemorization();
    };
  };
  panel.querySelector('[data-mem-show]').onclick = () => {
    panel.querySelector('[data-mem-feedback]').innerHTML = `<p class="quiz-verse">« ${escapeHtml(item.text)} »</p>`;
  };
}

async function loadMemorization() {
  const data = await api('/bible/memorization');
  const el = document.getElementById('bible-memorization');

  function renderGroup(title, items, showAdvance) {
    if (!items.length) return '';
    return `
      <div class="mem-group">
        <h4>${title} (${items.length})</h4>
        ${items.map(m => `
          <div class="card mem-item">
            <span>${escapeHtml(m.ref)}${m.custom ? ' <span class="meta">(perso)</span>' : ''}
              <span class="meta">${escapeHtml(m.stageLabel)}</span>
              <span class="mem-progress-row">
                <span class="mem-progress"><span style="width:${Math.round(Math.min(m.stage, 6) / 6 * 100)}%"></span></span>
                <span class="meta">${m.status === 'mastered' ? '🏆 Maîtrisé' : `Étape ${m.stage + 1}/6`}</span>
              </span>
              ${m.nextReviewAt && !m.isDue ? `<span class="meta">Prochaine révision : ${new Date(m.nextReviewAt).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>` : ''}
            </span>
            <div>
              <button class="small" data-exercise="${m.id}">🧩 S'entraîner</button>
              <button class="small" data-recite="${m.id}" data-recite-text="${escapeHtml(m.text)}" data-recite-ref="${escapeHtml(m.ref)}">🎤 Réciter</button>
              ${showAdvance ? `<button class="small" data-advance="${m.id}">Valider cette étape</button>` : ''}
              <button class="small danger" data-del-mem="${m.id}">Supprimer</button>
            </div>
          </div>
          <div class="hidden" id="recite-panel-${m.id}"></div>
        `).join('')}
      </div>
    `;
  }

  el.innerHTML =
    renderGroup('À réviser aujourd\'hui', data.due, true) +
    renderGroup('En cours', data.inProgress, false) +
    renderGroup('Maîtrisés', data.mastered, false) ||
    '<p class="meta">Aucun verset en mémorisation. Ajoute-en un depuis le verset du jour ou une recherche.</p>';

  const allItems = [...data.due, ...data.inProgress, ...data.mastered];
  el.querySelectorAll('[data-recite]').forEach(btn => {
    btn.onclick = () => openRecitationPanel(btn.dataset.recite, btn.dataset.reciteText, btn.dataset.reciteRef, data.due.some(d => d.id === btn.dataset.recite));
  });
  el.querySelectorAll('[data-exercise]').forEach(btn => {
    const item = allItems.find(m => m.id === btn.dataset.exercise);
    btn.onclick = () => openMemExercise(item, data.due.some(d => d.id === item.id));
  });
  el.querySelectorAll('[data-advance]').forEach(btn => {
    btn.onclick = async () => { await api(`/bible/memorization/${btn.dataset.advance}/advance`, { method: 'POST' }); loadMemorization(); };
  });
  el.querySelectorAll('[data-del-mem]').forEach(btn => {
    btn.onclick = async () => { await api(`/bible/memorization/${btn.dataset.delMem}`, { method: 'DELETE' }); loadMemorization(); };
  });
}

// --- Récitation biblique via reconnaissance vocale du navigateur (gratuite) ---
function stripAccentsClient(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

// Micro générique : transcrit la voix directement dans une zone de texte.
// Réutilisable partout (Journal, Situation...) sans dupliquer la logique.
function attachVoiceToTextarea(btnId, textareaId, statusId) {
  const btn = document.getElementById(btnId);
  const textarea = document.getElementById(textareaId);
  const status = document.getElementById(statusId);
  if (!SpeechRecognitionAPI) {
    btn.disabled = true;
    status.textContent = "Non supporté par ce navigateur (essaie Chrome).";
    return;
  }

  let recognition = null;
  let listening = false;
  const baseText = () => textarea.dataset.baseText || '';

  btn.onclick = () => {
    if (listening) { recognition.stop(); return; }
    textarea.dataset.baseText = textarea.value ? textarea.value + ' ' : '';
    recognition = new SpeechRecognitionAPI();
    recognition.lang = getAppLangBCP47();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      if (final) textarea.dataset.baseText = baseText() + final;
      textarea.value = baseText() + interim;
    };
    recognition.onerror = (e) => {
      const messages = { 'not-allowed': "Permission micro refusée — active-la dans les réglages du navigateur.", 'no-speech': "Aucune voix détectée.", 'network': "Problème réseau." };
      status.textContent = messages[e.error] || `Erreur de reconnaissance (${e.error}) — réessaie.`;
    };
    recognition.onend = () => {
      listening = false;
      btn.textContent = "🎤 Parler au lieu d'écrire";
      status.textContent = '';
    };
    recognition.start();
    listening = true;
    btn.textContent = '⏹️ Arrêter';
    status.textContent = 'Écoute en cours...';
  };
}
attachVoiceToTextarea('journal-voice-btn', 'journal-input', 'journal-voice-status');
attachVoiceToTextarea('situation-voice-btn', 'situation-input', 'situation-voice-status');

// --- Récitation d'un verset : à voix haute (reconnaissance vocale) ou par écrit ---
// Correction mot par mot dans l'ordre du verset (plus longue sous-suite commune),
// toujours en français puisque les versets sont en Louis Segond.
const reciteWords = (s) => stripAccentsClient(String(s).toLowerCase()).replace(/[’']/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

function alignRecitation(target, said) {
  const display = target.split(/\s+/).filter(Boolean);
  const t = display.map(w => reciteWords(w).join(''));
  const a = reciteWords(said);
  const dp = Array.from({ length: t.length + 1 }, () => new Uint16Array(a.length + 1));
  for (let i = t.length - 1; i >= 0; i--) {
    for (let j = a.length - 1; j >= 0; j--) {
      dp[i][j] = t[i] && t[i] === a[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const found = new Array(t.length).fill(false);
  for (let i = 0, j = 0; i < t.length && j < a.length;) {
    if (t[i] && t[i] === a[j]) { found[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const counted = t.filter(Boolean).length || 1;
  const score = Math.round(found.filter((f, i) => f && t[i]).length / counted * 100);
  const html = display.map((w, i) => `<span class="${found[i] || !t[i] ? 'rw-ok' : 'rw-miss'}">${escapeHtml(w)}</span>`).join(' ');
  return { score, html };
}

function speechErrorMessage(code) {
  const ios = isIOS();
  const map = {
    'not-allowed': ios
      ? "Micro ou reconnaissance vocale refusés. Sur iPhone : Réglages → Safari → Micro → Autoriser, et Réglages → Général → Clavier → « Activer Dictée »."
      : "Micro refusé : touche l'icône 🔒 à côté de l'adresse → Micro → Autoriser, puis recharge la page.",
    'service-not-allowed': ios
      ? "La reconnaissance vocale est désactivée. Active la Dictée : Réglages → Général → Clavier → « Activer Dictée ». Si l'app est ouverte depuis l'écran d'accueil, essaie dans Safari."
      : "La reconnaissance vocale n'est pas autorisée sur ce navigateur. Essaie Chrome à jour.",
    'network': "La reconnaissance vocale a besoin d'Internet (elle passe par les serveurs du navigateur). Vérifie ta connexion, ou récite par écrit.",
    'no-speech': "Je n'ai rien entendu. Parle un peu plus fort, plus près du micro, puis réessaie.",
    'audio-capture': "Aucun micro détecté, ou il est utilisé par une autre app.",
    'language-not-supported': "Le français n'est pas disponible pour la reconnaissance vocale sur cet appareil.",
    'aborted': null
  };
  return code in map ? map[code] : `Erreur de reconnaissance (${code}).`;
}

function openRecitationPanel(id, text, ref, canValidate) {
  const panel = document.getElementById(`recite-panel-${id}`);
  // Le même panneau sert à l'exercice à trous : basculer au lieu de fermer.
  const isOpen = !panel.classList.contains('hidden') && panel.dataset.mode !== 'exercise';
  document.querySelectorAll('[id^="recite-panel-"]').forEach(p => p.classList.add('hidden'));
  if (window._recitation) { try { window._recitation.abort(); } catch (e) { /* déjà arrêtée */ } window._recitation = null; }
  if (isOpen) return;
  panel.dataset.mode = 'recite';
  panel.classList.remove('hidden');
  const voiceOk = !!SpeechRecognitionAPI;

  panel.innerHTML = `
    <div class="card-block recite">
      <p class="meta">Récite « ${escapeHtml(ref)} » de mémoire, sans regarder.</p>
      <div class="pep-tabs recite-tabs">
        <button type="button" class="pep-tab ${voiceOk ? 'active' : ''}" data-rmode="voice">🎤 À voix haute</button>
        <button type="button" class="pep-tab ${voiceOk ? '' : 'active'}" data-rmode="text">⌨️ Par écrit</button>
      </div>
      <div data-rpanel="voice" class="${voiceOk ? '' : 'hidden'}">
        <div class="rec-row">
          <button type="button" data-rstart>🎤 Démarrer</button>
          <button type="button" class="small" data-rstop disabled>⏹️ Arrêter</button>
        </div>
        <p class="meta" data-rstatus>Touche « Démarrer », récite le verset, puis « Arrêter ».</p>
        <p class="recite-live" data-rlive></p>
      </div>
      <div data-rpanel="text" class="${voiceOk ? 'hidden' : ''}">
        ${voiceOk ? '' : '<p class="meta">La reconnaissance vocale n\'est pas disponible sur ce navigateur : récite par écrit.</p>'}
        <textarea data-rtext placeholder="Écris le verset de mémoire…"></textarea>
        <button type="button" data-rcheck>Vérifier</button>
      </div>
      <div data-rresult></div>
    </div>`;

  const $ = (sel) => panel.querySelector(sel);
  panel.querySelectorAll('[data-rmode]').forEach(b => {
    b.onclick = () => {
      if (window._recitation) window._recitation.stop();
      panel.querySelectorAll('[data-rmode]').forEach(x => x.classList.toggle('active', x === b));
      panel.querySelectorAll('[data-rpanel]').forEach(x => x.classList.toggle('hidden', x.dataset.rpanel !== b.dataset.rmode));
    };
  });

  const showResult = (said) => {
    if (!said.trim()) return;
    const { score, html } = alignRecitation(text, said);
    $('[data-rresult]').innerHTML = `
      <div class="quiz-feedback ${score >= 80 ? 'ok' : 'ko'}">
        <strong>${score >= 90 ? '🏆' : score >= 80 ? '✅' : '🔁'} ${score} % du verset retrouvé</strong>
        <p class="recite-diff">${html}</p>
        <p class="meta">En vert : les mots retrouvés · en rouge : ceux qui manquent.</p>
        ${score >= 80 && canValidate ? '<button type="button" data-rvalidate>✅ Valider cette étape</button>' : ''}
        ${score < 80 ? '<p class="meta">Objectif : 80 %. Relis les mots en rouge et réessaie.</p>' : ''}
      </div>`;
    const v = $('[data-rvalidate]');
    if (v) v.onclick = async () => {
      await api(`/bible/memorization/${id}/advance`, { method: 'POST' });
      showToast('✅ Étape validée, bravo !');
      loadMemorization();
    };
  };

  $('[data-rcheck]').onclick = () => {
    const said = $('[data-rtext]').value;
    if (!said.trim()) { $('[data-rtext]').focus(); return; }
    showResult(said);
  };

  if (!voiceOk) return;
  // Android : le mode « continu » duplique ou coupe des mots ; on enchaîne des
  // écoutes courtes à la place, relancées tant que l'utilisateur n'a pas arrêté.
  const android = /android/i.test(navigator.userAgent);
  let finalText = '';
  let wantStop = true;
  let recognition = null;

  const setStatus = (msg, error) => { const el = $('[data-rstatus]'); if (el) { el.textContent = msg; el.classList.toggle('error', !!error); } };
  const setButtons = (listening) => { $('[data-rstart]').disabled = listening; $('[data-rstop]').disabled = !listening; };

  const listen = () => {
    recognition = new SpeechRecognitionAPI();
    window._recitation = recognition;
    recognition.lang = 'fr-FR';
    recognition.continuous = !android;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      $('[data-rlive]').textContent = finalText + interim;
    };
    recognition.onerror = (e) => {
      const msg = speechErrorMessage(e.error);
      if (e.error === 'no-speech' && !wantStop && android) return; // silence entre deux phrases : on relance
      if (msg) { setStatus(msg + (['network', 'service-not-allowed', 'not-allowed', 'language-not-supported'].includes(e.error) ? ' Tu peux aussi utiliser « Par écrit ».' : ''), true); wantStop = true; }
    };
    recognition.onend = () => {
      if (!wantStop) { try { listen(); return; } catch (err) { /* relance impossible */ } }
      window._recitation = null;
      setButtons(false);
      if (!$('[data-rstatus]').classList.contains('error')) setStatus(finalText.trim() ? 'Écoute terminée.' : 'Rien n\'a été reconnu. Réessaie, ou récite par écrit.', !finalText.trim());
      showResult(finalText);
    };
    recognition.start();
  };

  $('[data-rstart]').onclick = () => {
    if (window._recitation) return; // déjà en écoute : un 2e démarrage ferait planter la reconnaissance
    finalText = '';
    wantStop = false;
    $('[data-rlive]').textContent = '';
    $('[data-rresult]').innerHTML = '';
    setStatus('🎙️ Je t\'écoute… récite le verset.');
    setButtons(true);
    try { listen(); }
    catch (err) { wantStop = true; window._recitation = null; setButtons(false); setStatus(`Impossible de démarrer la reconnaissance (${err.name || err.message}). Récite par écrit.`, true); }
  };
  $('[data-rstop]').onclick = () => { wantStop = true; if (recognition) recognition.stop(); };
}

// --- PROGRESSION ---
async function loadProgress() {
  let review, monthly, trends, summary;
  try {
    [review, monthly, trends, summary] = await Promise.all([
      api('/progress/weekly-review'),
      api('/progress/monthly-review'),
      api('/progress/trends'),
      api('/progress/summary')
    ]);
  } catch (err) {
    document.getElementById('weekly-review-content').textContent = 'Erreur : ' + err.message;
    return;
  }

  document.getElementById('weekly-review-content').innerHTML = review.summary.map(l => `<p>${escapeHtml(l)}</p>`).join('');

  const TREND_ICONS = { up: '📈', down: '📉', stable: '➡️' };
  document.getElementById('monthly-review-content').innerHTML = `
    <p class="meta">${monthly.month} comparé à ${monthly.previousMonth}</p>
    <div class="badge-row">
      <span class="badge">${TREND_ICONS[monthly.trends.habits]} Habitudes : ${monthly.current.habitChecks} (${monthly.previous.habitChecks} le mois dernier)</span>
      <span class="badge">${TREND_ICONS[monthly.trends.goals]} Objectifs faits : ${monthly.current.goalsDone} (${monthly.previous.goalsDone})</span>
      <span class="badge">${TREND_ICONS[monthly.trends.journal]} Journal : ${monthly.current.journalCount} (${monthly.previous.journalCount})</span>
      <span class="badge">${TREND_ICONS[monthly.trends.situations]} Situations : ${monthly.current.situationsCount} (${monthly.previous.situationsCount})</span>
    </div>
    <h4>Questions pour ta revue du mois</h4>
    <ul>${monthly.reflectionQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>
    ${speakerHTML(monthly.reflectionQuestions.join(' '))}
  `;

  document.getElementById('trends-content').innerHTML = trends.notable.length
    ? `<div class="badge-row">${trends.notable.map(t => `<span class="badge">${escapeHtml(t.key)} × ${t.count}</span>`).join('')}</div><p class="meta">${escapeHtml(trends.note)}</p>`
    : `<p class="meta">${escapeHtml(trends.note)}</p>`;

  renderBarChart(document.getElementById('habits-chart'), summary.habitsPerDay);

  document.getElementById('goals-chart').innerHTML = `
    <div class="badge-row">
      <span class="badge">Actifs : ${summary.goalsByStatus.active}</span>
      <span class="badge">Faits : ${summary.goalsByStatus.done}</span>
      <span class="badge">En pause : ${summary.goalsByStatus.paused}</span>
    </div>
  `;

  document.getElementById('memorization-stats').innerHTML = `
    <div class="badge-row">
      <span class="badge">Total : ${summary.memorizationStats.total}</span>
      <span class="badge">Maîtrisés : ${summary.memorizationStats.mastered}</span>
    </div>
  `;
}

function renderBarChart(el, data) {
  const max = Math.max(1, ...data.map(d => d.count));
  el.innerHTML = `
    <div class="bar-chart">
      ${data.map(d => `<div class="bar" style="height:${Math.max(3, (d.count / max) * 100)}%" title="${d.date} : ${d.count}"></div>`).join('')}
    </div>
    <div class="bar-chart-labels">
      ${data.map(d => `<span>${d.date.slice(8)}</span>`).join('')}
    </div>
  `;
}

// --- GAMIFICATION (mise à jour légère de la carte XP après une action) ---
async function loadGamiBar() {
  try {
    const g = await api('/gamification/status');
    document.getElementById('xp-level-num').textContent = g.level;
    document.getElementById('xp-level-name').textContent = g.levelName;
    document.getElementById('xp-fill').style.width = g.progressToNext + '%';
    document.getElementById('xp-current').textContent = `${g.xp} XP`;
    document.getElementById('xp-next').textContent = g.nextLevel ? `${g.nextLevel.xpNeeded} XP avant le niveau ${g.nextLevel.level}` : 'Niveau maximum';
    document.getElementById('xp-streak').textContent = `🔥 ${g.streak} jour${g.streak > 1 ? 's' : ''} de série`;
  } catch { /* pas connecté ou erreur réseau : on ignore silencieusement */ }
}

// --- SITUATION RÉELLE ---
document.getElementById('situation-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('situation-input');
  if (!input.value.trim()) return;
  const situation = await api('/situations', { method: 'POST', body: { content: input.value } });
  input.value = '';
  renderSituationResult(situation);
  loadSituationHistory();
  loadSituationPatterns();
  loadGamiBar();
});

function renderSituationResult(situation) {
  document.getElementById('situation-result').innerHTML = `
    <div class="card-block">
      <p class="meta">Domaines détectés : ${situation.domains.map(escapeHtml).join(', ')}</p>
      <h4>Questions avant d'agir</h4>
      <ul>${situation.questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>
      <h4>Action suggérée</h4>
      <p>${escapeHtml(situation.suggestion)}</p>
      ${speakerHTML(situation.questions.join(' ') + ' ' + situation.suggestion)}
    </div>
  `;
}

async function loadSituation() {
  loadSituationHistory();
  loadSituationPatterns();
}

async function loadSituationHistory() {
  const list = await api('/situations');
  const el = document.getElementById('situation-history');
  el.innerHTML = list.length ? list.map(s => `
    <div class="card">
      <div>
        <div>${escapeHtml(s.content.slice(0, 100))}${s.content.length > 100 ? '…' : ''}</div>
        <div class="meta">${new Date(s.createdAt).toLocaleString('fr-FR')} — ${s.domains.join(', ')}</div>
      </div>
      <button class="small danger" data-del-sit="${s.id}">Supprimer</button>
    </div>
  `).join('') : '<p class="meta">Aucune situation enregistrée pour l\'instant.</p>';

  el.querySelectorAll('[data-del-sit]').forEach(btn => {
    btn.onclick = async () => { await api(`/situations/${btn.dataset.delSit}`, { method: 'DELETE' }); loadSituationHistory(); };
  });
}

async function loadSituationPatterns() {
  const data = await api('/situations/patterns');
  const el = document.getElementById('situation-patterns');
  el.innerHTML = `
    <p class="meta">${data.totalSituations} situation(s) analysée(s) sur les 30 derniers jours.</p>
    ${data.recurringPatterns.length
      ? data.recurringPatterns.map(p => `<div class="card"><span>${escapeHtml(p.note)}</span></div>`).join('')
      : `<p class="meta">${escapeHtml(data.note)}</p>`}
  `;
}

// --- COMMUNICATION ---
document.getElementById('reply-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('reply-input');
  if (!input.value.trim()) return;
  const data = await api('/communication/suggest-reply', { method: 'POST', body: { message: input.value } });
  const el = document.getElementById('reply-result');
  const labels = { naturel: 'Naturel', romantique: 'Romantique', drole: 'Drôle', flirt: 'Flirt', profond: 'Profond', direct: 'Direct' };
  el.innerHTML = `
    ${Object.entries(data.suggestions).map(([key, text]) => `
      <div class="reply-variant">
        <div class="label">${labels[key] || key}</div>
        <div class="card">${escapeHtml(text)}</div>
      </div>
    `).join('')}
    <p class="meta">${escapeHtml(data.note)}</p>
  `;
});

document.getElementById('analyze-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('analyze-input');
  if (!input.value.trim()) return;
  const data = await api('/communication/analyze-conversation', { method: 'POST', body: { text: input.value } });
  const el = document.getElementById('analyze-result');
  el.innerHTML = `
    <p class="meta">${data.lineCount} ligne(s), ${data.questionCount} question(s)</p>
    ${data.tips.map(t => `<div class="card"><span>💡 ${escapeHtml(t)}</span></div>`).join('')}
    <h4>Pour y réfléchir</h4>
    <ul>${data.reflectionPrompts.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
    <p class="meta">${escapeHtml(data.disclaimer)}</p>
  `;
});

// --- FINANCE ---
async function loadFinance() {
  let summary, txs, savings, investments;
  try {
    [summary, txs, savings, investments] = await Promise.all([
      api('/finance/summary'), api('/finance/transactions'), api('/finance/savings-goals'), api('/finance/investments')
    ]);
  } catch (err) {
    document.getElementById('finance-summary').textContent = 'Erreur : ' + err.message;
    return;
  }

  document.getElementById('finance-summary').innerHTML = `
    <div class="badge-row">
      <span class="badge">Revenus : ${summary.income.toFixed(2)} €</span>
      <span class="badge">Dépenses : ${summary.expense.toFixed(2)} €</span>
      <span class="badge">Solde : ${summary.balance.toFixed(2)} €</span>
    </div>
    ${summary.byCategory.length ? `
      <h4>Répartition des dépenses</h4>
      ${summary.byCategory.map(c => `<div class="card"><span>${escapeHtml(c.category)}</span><span>${c.amount.toFixed(2)} €</span></div>`).join('')}
    ` : ''}
  `;

  document.getElementById('tx-list').innerHTML = txs.slice(0, 15).map(t => `
    <div class="card">
      <span>${t.type === 'income' ? '➕' : '➖'} ${t.amount.toFixed(2)} € — ${escapeHtml(t.category)} <span class="meta">(${t.date})</span></span>
      <button class="small danger" data-del-tx="${t.id}">Supprimer</button>
    </div>
  `).join('') || '<p class="meta">Aucune transaction.</p>';
  document.querySelectorAll('[data-del-tx]').forEach(btn => {
    btn.onclick = async () => { await api(`/finance/transactions/${btn.dataset.delTx}`, { method: 'DELETE' }); loadFinance(); };
  });

  document.getElementById('savings-list').innerHTML = savings.map(s => `
    <div class="card">
      <span>${escapeHtml(s.title)} — ${s.savedAmount}/${s.targetAmount} €</span>
      <div>
        <button class="small" data-add-savings="${s.id}">+50 €</button>
        <button class="small danger" data-del-savings="${s.id}">Supprimer</button>
      </div>
    </div>
  `).join('') || '<p class="meta">Aucun objectif d\'épargne.</p>';
  document.querySelectorAll('[data-add-savings]').forEach(btn => {
    btn.onclick = async () => { await api(`/finance/savings-goals/${btn.dataset.addSavings}/add`, { method: 'POST', body: { amount: 50 } }); loadFinance(); };
  });
  document.querySelectorAll('[data-del-savings]').forEach(btn => {
    btn.onclick = async () => { await api(`/finance/savings-goals/${btn.dataset.delSavings}`, { method: 'DELETE' }); loadFinance(); };
  });

  const INVESTMENT_TYPE_LABELS = { epargne: 'Épargne réglementée', bourse: 'Bourse / ETF', immobilier: 'Immobilier', crypto: 'Crypto', autre: 'Autre' };
  document.getElementById('investment-list').innerHTML = investments.map(inv => `
    <div class="card">
      <span>
        ${escapeHtml(inv.name)} <span class="meta">(${INVESTMENT_TYPE_LABELS[inv.type] || inv.type})</span><br/>
        <span class="meta">${inv.amount.toFixed(2)} € → projeté à ${inv.projectedValue.toFixed(2)} € dans ${inv.horizonMonths} mois (à ${inv.annualRatePercent}%/an que tu as toi-même renseigné)</span>
      </span>
      <button class="small danger" data-del-investment="${inv.id}">Supprimer</button>
    </div>
  `).join('') || '<p class="meta">Aucun investissement suivi pour l\'instant.</p>';
  document.querySelectorAll('[data-del-investment]').forEach(btn => {
    btn.onclick = async () => { await api(`/finance/investments/${btn.dataset.delInvestment}`, { method: 'DELETE' }); loadFinance(); };
  });
}

document.getElementById('tx-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('tx-type').value;
  const amount = document.getElementById('tx-amount').value;
  const category = document.getElementById('tx-category').value;
  if (!amount) return;
  await api('/finance/transactions', { method: 'POST', body: { type, amount, category } });
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-category').value = '';
  loadFinance();
});

document.getElementById('savings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('savings-title').value;
  const targetAmount = document.getElementById('savings-target').value;
  if (!title || !targetAmount) return;
  await api('/finance/savings-goals', { method: 'POST', body: { title, targetAmount } });
  document.getElementById('savings-title').value = '';
  document.getElementById('savings-target').value = '';
  loadFinance();
});

document.getElementById('investment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('investment-name').value;
  const type = document.getElementById('investment-type').value;
  const amount = document.getElementById('investment-amount').value;
  const annualRatePercent = document.getElementById('investment-rate').value;
  const horizonMonths = document.getElementById('investment-months').value;
  if (!name || !amount || annualRatePercent === '' || !horizonMonths) return;
  try {
    await api('/finance/investments', { method: 'POST', body: { name, type, amount, annualRatePercent, horizonMonths } });
    document.getElementById('investment-name').value = '';
    document.getElementById('investment-amount').value = '';
    document.getElementById('investment-rate').value = '';
    document.getElementById('investment-months').value = '';
    loadFinance();
  } catch (err) {
    showToast(err.message);
  }
});

// --- DOMAINES ---

async function loadDomains() {
  const data = await api('/domains/scores');
  const el = document.getElementById('domains-scores');
  const period = 'week'; // vue par défaut : cette semaine
  el.innerHTML = `
    <div class="tabs" id="domain-period-tabs">
      <button class="tab" data-period="today">Aujourd'hui</button>
      <button class="tab active" data-period="week">Semaine</button>
      <button class="tab" data-period="month">Mois</button>
      <button class="tab" data-period="allTime">Depuis le début</button>
    </div>
    <div id="domain-bars"></div>
    <p class="meta">${escapeHtml(data.note)}</p>
  `;
  renderDomainBars(data[period]);
  document.querySelectorAll('#domain-period-tabs .tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('#domain-period-tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
      renderDomainBars(data[tab.dataset.period]);
    };
  });
}

function renderDomainBars(scores) {
  const el = document.getElementById('domain-bars');
  el.innerHTML = Object.entries(scores).map(([domain, score]) => `
    <div class="domain-row">
      <span>${DOMAIN_LABELS[domain] || domain}</span>
      <div class="domain-bar-track"><div class="domain-bar-fill" style="width:${score}%"></div></div>
      <span>${score}</span>
    </div>
  `).join('');
}

// --- ONBOARDING / PROFIL ---
const ONBOARDING_LABELS = {
  age: 'Âge', situationPersonnelle: 'Situation personnelle', situationAmoureuse: 'Situation amoureuse',
  travail: 'Travail', finances: 'Finances', sommeil: 'Sommeil', alimentation: 'Alimentation',
  activitePhysique: 'Activité physique', confianceEnSoi: 'Confiance en soi', gestionEmotions: 'Gestion des émotions',
  communication: 'Communication', relations: 'Relations', intimite: 'Intimité et sexualité', carriere: 'Carrière',
  competences: 'Compétences', spiritualite: 'Spiritualité', habitudesNumeriques: 'Habitudes numériques',
  tempsDisponible: 'Temps disponible', forces: 'Mes forces', faiblesses: 'Mes faiblesses',
  mauvaisesHabitudes: 'Mauvaises habitudes', bonnesHabitudes: 'Bonnes habitudes',
  objectifs30j: 'Objectifs à 30 jours', objectifs90j: 'Objectifs à 90 jours', objectifs1an: 'Objectifs à 1 an',
  visionHomme: "Vision de l'homme que je veux devenir"
};

async function loadOnboarding() {
  const data = await api('/onboarding');
  const form = document.getElementById('onboarding-form');
  form.innerHTML = data.fields.map(f => `
    <label>
      ${ONBOARDING_LABELS[f] || f}
      <textarea data-field="${f}" rows="2">${escapeHtml(data.answers[f] || '')}</textarea>
    </label>
  `).join('');
  document.getElementById('onboarding-status').textContent = data.completed ? 'Profil marqué comme complété.' : 'Profil en cours de complétion.';
}

document.getElementById('onboarding-save-btn').onclick = async () => {
  const answers = {};
  document.querySelectorAll('#onboarding-form [data-field]').forEach(el => {
    answers[el.dataset.field] = el.value;
  });
  const data = await api('/onboarding', { method: 'PUT', body: { answers, completed: true } });
  document.getElementById('onboarding-status').textContent = 'Profil enregistré ✅';
};

// --- WHAT'S NEW ---
async function loadWhatsNew() {
  const versions = await api('/meta/whats-new');
  const el = document.getElementById('whats-new-list');
  el.innerHTML = versions.map(v => `
    <div class="card-block">
      <h3>v${escapeHtml(v.version)} — ${escapeHtml(v.title)} <span class="meta">(${v.date})</span></h3>
      ${v.features.length ? `<p class="meta">Nouveautés</p><ul>${v.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
      ${v.improvements.length ? `<p class="meta">Améliorations</p><ul>${v.improvements.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
      ${v.fixes.length ? `<p class="meta">Corrections</p><ul>${v.fixes.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
    </div>
  `).join('');
}

// --- COMPTE / CONFIDENTIALITÉ ---
function renderAccountAvatar() {
  const img = document.getElementById('account-avatar-preview');
  const fallback = document.getElementById('account-avatar-fallback');
  if (state.user.avatar) {
    img.src = state.user.avatar;
    img.style.display = 'block';
    fallback.style.display = 'none';
  } else {
    img.style.display = 'none';
    fallback.style.display = 'flex';
    fallback.textContent = state.user.name.trim().slice(0, 1).toUpperCase() || '?';
  }
}

function resizeImageToDataUrl(file, maxSize = 240, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadAccount() {
  renderLockControls();
  renderAccountAvatar();

  try {
    const me = await api('/users/me');
    document.getElementById('account-name-input').value = me.name;
    if (me.avatar !== state.user.avatar) {
      state.user.avatar = me.avatar;
      localStorage.setItem('bm_user', JSON.stringify(state.user));
      renderAccountAvatar();
      renderAvatarBtn();
    }
  } catch { /* si indisponible, le champ reste vide, pas bloquant */ }

  document.getElementById('account-avatar-pick-btn').onclick = () => document.getElementById('account-avatar-input').click();
  document.getElementById('account-avatar-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const updated = await api('/users/me', { method: 'PATCH', body: { avatar: dataUrl } });
      state.user.avatar = updated.avatar;
      localStorage.setItem('bm_user', JSON.stringify(state.user));
      renderAccountAvatar();
      renderAvatarBtn();
      showToast('Photo mise à jour ✅');
    } catch (err) {
      showToast(err.message);
    }
    e.target.value = '';
  };
  document.getElementById('account-avatar-remove-btn').onclick = async () => {
    try {
      const updated = await api('/users/me', { method: 'PATCH', body: { avatar: null } });
      state.user.avatar = updated.avatar;
      localStorage.setItem('bm_user', JSON.stringify(state.user));
      renderAccountAvatar();
      renderAvatarBtn();
    } catch (err) {
      showToast(err.message);
    }
  };

  document.getElementById('export-btn').onclick = async () => {
    const res = await fetch(API_BASE + '/privacy/export', { headers: { Authorization: `Bearer ${state.token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'better-man-ai-export.json'; a.click();
    URL.revokeObjectURL(url);
  };
}

document.getElementById('account-name-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('account-name-input').value.trim();
  if (!name) return;
  const status = document.getElementById('account-name-status');
  try {
    const updated = await api('/users/me', { method: 'PATCH', body: { name } });
    state.user.name = updated.name;
    localStorage.setItem('bm_user', JSON.stringify(state.user));
    const first = state.user.name.trim().split(' ')[0] || state.user.name;
    document.getElementById('greeting-text').textContent = `Bonjour ${first} 👋`;
    document.getElementById('avatar-btn').textContent = state.user.name.trim().slice(0, 1).toUpperCase() || '?';
    renderAvatarBtn();
    document.getElementById('pd-name').textContent = state.user.name;
    status.textContent = 'Nom mis à jour ✅';
  } catch (err) {
    status.textContent = err.message;
  }
});

document.getElementById('delete-account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('delete-account-password').value;
  if (!confirm('Cette action est définitive et supprime toutes tes données. Continuer ?')) return;
  try {
    await api('/privacy/delete-account', { method: 'POST', body: { password } });
    doLogout();
  } catch (err) {
    document.getElementById('delete-account-status').textContent = err.message;
  }
});

// --- VERROUILLAGE LOCAL (PIN, stocké uniquement dans ce navigateur) ---
function renderLockControls() {
  const hasPin = !!localStorage.getItem('bm_lock_pin');
  const el = document.getElementById('lock-controls');
  el.innerHTML = hasPin
    ? `<button id="remove-lock-btn" class="small">Désactiver le verrouillage</button>`
    : `
      <form id="set-lock-form">
        <input type="password" id="set-lock-pin" placeholder="Choisis un code (4 chiffres min.)" />
        <button type="submit">Activer le verrouillage</button>
      </form>
    `;

  const removeBtn = document.getElementById('remove-lock-btn');
  if (removeBtn) removeBtn.onclick = () => { localStorage.removeItem('bm_lock_pin'); renderLockControls(); };

  const setForm = document.getElementById('set-lock-form');
  if (setForm) setForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('set-lock-pin').value;
    if (pin.length < 4) return;
    localStorage.setItem('bm_lock_pin', pin);
    renderLockControls();
  });
}

function checkAppLock() {
  const pin = localStorage.getItem('bm_lock_pin');
  if (!pin) return; // pas de verrouillage configuré
  if (sessionStorage.getItem('bm_unlocked') === 'true') return; // déjà déverrouillé cette session

  document.getElementById('lock-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

document.getElementById('lock-unlock-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('lock-pin-input').value;
  if (input === localStorage.getItem('bm_lock_pin')) {
    sessionStorage.setItem('bm_unlocked', 'true');
    document.getElementById('lock-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  } else {
    document.getElementById('lock-error').textContent = 'Code incorrect.';
  }
});

// --- BIBLIOTHÈQUE ---
document.getElementById('library-text-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('library-title').value.trim();
  const author = document.getElementById('library-author').value.trim();
  const text = document.getElementById('library-text').value.trim();
  if (!title || !text) return;
  await api('/library/books/text', { method: 'POST', body: { title, author, text } });
  document.getElementById('library-title').value = '';
  document.getElementById('library-author').value = '';
  document.getElementById('library-text').value = '';
  loadLibrary();
});

document.getElementById('library-upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('library-upload-title').value.trim();
  const fileInput = document.getElementById('library-upload-file');
  if (!title || !fileInput.files[0]) return;
  const formData = new FormData();
  formData.append('title', title);
  formData.append('file', fileInput.files[0]);
  try {
    const res = await fetch(API_BASE + '/library/books/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    document.getElementById('library-upload-title').value = '';
    fileInput.value = '';
    loadLibrary();
  } catch (err) {
    alert(err.message);
  }
});

async function loadLibrary() {
  const books = await api('/library/books');
  const el = document.getElementById('library-list');
  el.innerHTML = books.length ? books.map(b => `
    <div class="card">
      <span>${escapeHtml(b.title)} ${b.author ? `— ${escapeHtml(b.author)}` : ''} <span class="meta">(${b.type}, ${b.length} caractères)</span></span>
      <div>
        <button class="small" data-open-book="${b.id}">Ouvrir</button>
        <button class="small danger" data-del-book="${b.id}">Supprimer</button>
      </div>
    </div>
  `).join('') : '<p class="meta">Aucun livre pour l\'instant.</p>';

  el.querySelectorAll('[data-open-book]').forEach(btn => {
    btn.onclick = () => openBook(btn.dataset.openBook);
  });
  el.querySelectorAll('[data-del-book]').forEach(btn => {
    btn.onclick = async () => { await api(`/library/books/${btn.dataset.delBook}`, { method: 'DELETE' }); loadLibrary(); };
  });
}

async function openBook(id) {
  const [book, studyPack] = await Promise.all([
    api(`/library/books/${id}`),
    api(`/library/books/${id}/study-pack`).catch(() => null)
  ]);
  const block = document.getElementById('library-detail-block');
  block.classList.remove('hidden');
  const percent = book.text.length ? Math.round((book.position / book.text.length) * 100) : 0;
  document.getElementById('library-detail').innerHTML = `
    <div class="card-block">
      <h3>🎧 Lecture audio</h3>
      <p class="meta">Position actuelle : ${percent}% (${book.position} / ${book.text.length} caractères)</p>
      <div class="speaker">
        <button id="audiobook-play">▶️ Lire depuis ma position</button>
        <button id="audiobook-pause">⏸️ Pause/Reprendre</button>
        <button id="audiobook-stop">⏹️ Stop (garde la position)</button>
        <button id="audiobook-restart" class="small">Reprendre depuis le début</button>
      </div>
      <p class="meta" id="audiobook-status"></p>
    </div>
  ` + renderStudyDetail({
    title: book.title, text: book.text, studyPack, sourceType: 'library', sourceId: id
  });
  bindStudyRatingButtons();
  bindAudiobookControls(book);
  block.scrollIntoView({ behavior: 'smooth' });
}

// --- Lecture audio continue (livre entier, avec reprise de position) ---
let audiobook = { active: false, bookId: null, chunks: [], chunkIndex: 0, baseOffset: 0 };

function splitIntoChunks(text, maxLen = 600) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > maxLen && current) { chunks.push(current); current = s; }
    else current += s;
  }
  if (current) chunks.push(current);
  return chunks;
}

function bindAudiobookControls(book) {
  const statusEl = document.getElementById('audiobook-status');

  document.getElementById('audiobook-play').onclick = () => startAudiobook(book, book.position, statusEl);
  document.getElementById('audiobook-restart').onclick = () => startAudiobook(book, 0, statusEl);
  document.getElementById('audiobook-pause').onclick = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) window.speechSynthesis.pause();
    else if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  };
  document.getElementById('audiobook-stop').onclick = () => {
    audiobook.active = false;
    window.speechSynthesis.cancel();
    statusEl.textContent = 'Arrêté — ta position est sauvegardée.';
  };
}

function startAudiobook(book, startPosition, statusEl) {
  if (!isSpeechSupported()) { statusEl.textContent = 'Lecture audio non supportée par ce navigateur.'; return; }
  window.speechSynthesis.cancel();
  const remainingText = book.text.slice(startPosition);
  if (!remainingText.trim()) { statusEl.textContent = 'Tu es arrivé(e) à la fin du livre 🎉'; return; }

  audiobook = { active: true, bookId: book.id, chunks: splitIntoChunks(remainingText), chunkIndex: 0, baseOffset: startPosition };
  statusEl.textContent = 'Lecture en cours...';
  speakNextAudiobookChunk(statusEl);
}

function speakNextAudiobookChunk(statusEl) {
  if (!audiobook.active || audiobook.chunkIndex >= audiobook.chunks.length) {
    if (audiobook.active) statusEl.textContent = 'Tu es arrivé(e) à la fin du livre 🎉';
    audiobook.active = false;
    return;
  }
  const chunk = audiobook.chunks[audiobook.chunkIndex];
  const utter = new SpeechSynthesisUtterance(chunk);
  utter.lang = 'fr-FR';
  const savedVoice = localStorage.getItem('bm_voice_name');
  if (savedVoice) {
    const voice = AVAILABLE_VOICES.find(v => v.name === savedVoice);
    if (voice) utter.voice = voice;
  }
  utter.onend = () => {
    if (!audiobook.active) return; // arrêté entre-temps
    audiobook.chunkIndex++;
    const consumed = audiobook.chunks.slice(0, audiobook.chunkIndex).join('').length;
    const newPosition = audiobook.baseOffset + consumed;
    api(`/library/books/${audiobook.bookId}/position`, { method: 'PATCH', body: { position: newPosition } }).catch(() => {});
    speakNextAudiobookChunk(statusEl);
  };
  window.speechSynthesis.speak(utter);
}

// --- VIDÉOS ---
document.getElementById('video-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('video-title').value.trim();
  const url = document.getElementById('video-url').value.trim();
  const transcript = document.getElementById('video-transcript').value.trim();
  if (!title || !url) return;
  await api('/videos', { method: 'POST', body: { title, url, transcript } });
  document.getElementById('video-title').value = '';
  document.getElementById('video-url').value = '';
  document.getElementById('video-transcript').value = '';
  loadVideos();
});

async function loadVideos() {
  const videos = await api('/videos');
  const el = document.getElementById('video-list');
  el.innerHTML = videos.length ? videos.map(v => `
    <div class="card">
      <span>${escapeHtml(v.title)} ${v.hasFile ? '🎬' : ''} ${v.hasTranscript ? '📝' : ''} <span class="meta">${escapeHtml(v.url || '')}</span></span>
      <div>
        <button class="small" data-open-video="${v.id}">Ouvrir</button>
        <button class="small danger" data-del-video="${v.id}">Supprimer</button>
      </div>
    </div>
  `).join('') : '<p class="meta">Aucune vidéo pour l\'instant.</p>';

  el.querySelectorAll('[data-open-video]').forEach(btn => {
    btn.onclick = () => openVideo(btn.dataset.openVideo);
  });
  el.querySelectorAll('[data-del-video]').forEach(btn => {
    btn.onclick = async () => { await api(`/videos/${btn.dataset.delVideo}`, { method: 'DELETE' }); loadVideos(); };
  });
}

document.getElementById('video-upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('video-upload-title').value.trim();
  const fileInput = document.getElementById('video-upload-input');
  const status = document.getElementById('video-upload-status');
  if (!title || !fileInput.files[0]) { status.textContent = 'Titre et fichier requis.'; return; }
  status.textContent = 'Import en cours...';
  const formData = new FormData();
  formData.append('title', title);
  formData.append('file', fileInput.files[0]);
  try {
    const res = await fetch(API_BASE + '/videos/upload', {
      method: 'POST', headers: { Authorization: `Bearer ${state.token}` }, body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    status.textContent = 'Importée ✅';
    document.getElementById('video-upload-title').value = '';
    fileInput.value = '';
    loadVideos();
  } catch (err) {
    status.textContent = err.message;
  }
});

async function openVideo(id) {
  const video = await api(`/videos/${id}`);
  const studyPack = video.transcript ? await api(`/videos/${id}/study-pack`).catch(() => null) : null;
  const block = document.getElementById('video-detail-block');
  block.classList.remove('hidden');
  document.getElementById('video-detail').innerHTML = `
    ${video.videoFile ? `<div class="card-block"><video src="${video.videoFile}" controls style="width:100%;border-radius:10px;"></video></div>` : ''}
    <div class="card-block">
      <h3>📝 Transcription</h3>
      <form id="video-transcript-edit-form">
        <textarea id="video-transcript-edit-input" placeholder="Colle ou modifie la transcription..." rows="3">${escapeHtml(video.transcript || '')}</textarea>
        <button type="submit">${video.transcript ? 'Mettre à jour' : 'Ajouter'}</button>
      </form>
    </div>
  ` + renderStudyDetail({
    title: video.title, text: video.transcript, studyPack, sourceType: 'video', sourceId: id,
    emptyHint: 'Aucune transcription associée. Ajoute-la ci-dessus pour générer résumé/flashcards/quiz.'
  });
  document.getElementById('video-transcript-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const transcript = document.getElementById('video-transcript-edit-input').value;
    await api(`/videos/${id}/transcript`, { method: 'PATCH', body: { transcript } });
    openVideo(id);
  });
  bindStudyRatingButtons();
  block.scrollIntoView({ behavior: 'smooth' });
}

// --- Rendu partagé résumé / mots-clés / flashcards / auto-évaluation ---
function renderStudyDetail({ title, text, studyPack, sourceType, sourceId, emptyHint }) {
  if (!studyPack) {
    return `<h3>${escapeHtml(title)}</h3><p class="meta">${emptyHint || 'Contenu trop court pour générer un résumé.'}</p>`;
  }
  return `
    <h3>${escapeHtml(title)}</h3>
    <p class="meta">${escapeHtml(studyPack.note)}</p>

    <h4>Résumé</h4>
    <div>${studyPack.summary.map(s => `<p>${escapeHtml(s)}</p>`).join('')}</div>
    ${speakerHTML(studyPack.summary.join(' '))}

    <h4>Mots-clés</h4>
    <div class="badge-row">${studyPack.keyTerms.map(k => `<span class="badge">${escapeHtml(k)}</span>`).join('')}</div>

    <h4>Flashcards</h4>
    ${studyPack.flashcards.map(f => `
      <div class="card"><span>${escapeHtml(f.prompt)}</span><span class="meta">(${f.answer.length} lettres)</span></div>
    `).join('')}

    <h4>Questions</h4>
    <ul>${studyPack.questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>

    <h4>Comment tu t'en sors avec ce contenu ?</h4>
    <div class="badge-row">
      <button class="small" data-rate="facile" data-source-type="${sourceType}" data-source-id="${sourceId}" data-label="${escapeHtml(title)}">😄 Facile</button>
      <button class="small" data-rate="moyen" data-source-type="${sourceType}" data-source-id="${sourceId}" data-label="${escapeHtml(title)}">🙂 Moyen</button>
      <button class="small" data-rate="difficile" data-source-type="${sourceType}" data-source-id="${sourceId}" data-label="${escapeHtml(title)}">😕 Difficile</button>
    </div>
    <p class="meta" data-rating-status></p>
  `;
}

function bindStudyRatingButtons() {
  document.querySelectorAll('[data-rate]').forEach(btn => {
    btn.onclick = async () => {
      await api('/learning/attempts', {
        method: 'POST',
        body: {
          sourceType: btn.dataset.sourceType, sourceId: btn.dataset.sourceId,
          label: btn.dataset.label, selfRating: btn.dataset.rate
        }
      });
      const status = btn.closest('div').parentElement.querySelector('[data-rating-status]');
      if (status) status.textContent = 'Enregistré ✅';
      loadGamiBar();
    };
  });
}

// --- TEACH ME ---
document.getElementById('teach-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('teach-topic');
  if (!input.value.trim()) return;
  await api('/teach/topics', { method: 'POST', body: { topic: input.value } });
  input.value = '';
  loadTeach();
});

async function loadTeach() {
  const topics = await api('/teach/topics');
  const el = document.getElementById('teach-list');
  el.innerHTML = topics.length ? topics.map(t => `
    <div class="card">
      <span>${escapeHtml(t.topic)} — ${t.progress}% <span class="meta">(${escapeHtml(t.currentLevel)})</span></span>
      <div>
        <button class="small" data-open-topic="${t.id}">Ouvrir</button>
        <button class="small danger" data-del-topic="${t.id}">Supprimer</button>
      </div>
    </div>
  `).join('') : '<p class="meta">Aucun sujet pour l\'instant.</p>';

  el.querySelectorAll('[data-open-topic]').forEach(btn => {
    btn.onclick = () => openTeachTopic(btn.dataset.openTopic);
  });
  el.querySelectorAll('[data-del-topic]').forEach(btn => {
    btn.onclick = async () => { await api(`/teach/topics/${btn.dataset.delTopic}`, { method: 'DELETE' }); loadTeach(); };
  });

  loadLearningInsights();
}

async function openTeachTopic(id) {
  const topic = await api(`/teach/topics/${id}`);
  const block = document.getElementById('teach-detail-block');
  block.classList.remove('hidden');
  const firstIncompleteIndex = topic.levels.findIndex(l => !l.completed);

  document.getElementById('teach-detail').innerHTML = `
    <h3>${escapeHtml(topic.topic)}</h3>
    ${topic.levels.map((l, i) => `
      <div class="card">
        <div>
          <div>${l.completed ? '✅' : '⬜'} ${escapeHtml(l.label)}</div>
          <div class="meta">${escapeHtml(l.action)}</div>
        </div>
        ${!l.completed && i === firstIncompleteIndex
          ? `<button class="small" data-complete-level="${l.key}" data-topic-id="${topic.id}">Valider</button>`
          : ''}
      </div>
    `).join('')}
  `;

  document.querySelectorAll('[data-complete-level]').forEach(btn => {
    btn.onclick = async () => {
      await api(`/teach/topics/${btn.dataset.topicId}/levels/${btn.dataset.completeLevel}/complete`, { method: 'POST' });
      openTeachTopic(id);
      loadTeach();
      loadGamiBar();
    };
  });

  block.scrollIntoView({ behavior: 'smooth' });
}

async function loadLearningInsights() {
  const data = await api('/learning/insights');
  const el = document.getElementById('learning-insights');
  el.innerHTML = `
    <p class="meta">${escapeHtml(data.note)}</p>
    ${data.toReview.length ? `
      <h4>À réviser</h4>
      ${data.toReview.map(r => `<div class="card"><span>${escapeHtml(r.label)}</span><span class="meta">${r.difficile} fois difficile</span></div>`).join('')}
    ` : ''}
    ${data.mastered.length ? `
      <h4>Maîtrisés</h4>
      ${data.mastered.map(m => `<div class="card"><span>${escapeHtml(m.label)}</span><span class="meta">${m.facile} fois facile</span></div>`).join('')}
    ` : ''}
    ${!data.toReview.length && !data.mastered.length ? '<p class="meta">Pas encore assez de données pour repérer un schéma.</p>' : ''}
  `;
}

// --- RECHERCHE WEB ---
async function loadSearchStatus() {
  const status = await api('/search/status');
  const el = document.getElementById('search-status');
  el.textContent = status.configured
    ? `Recherche active (${status.provider}).`
    : "Aucun accès Internet configuré (mode local, 0 €). Configure SEARCH_PROVIDER et SEARCH_API_KEY côté serveur pour l'activer.";
}

document.getElementById('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('search-input');
  if (!input.value.trim()) return;
  const data = await api('/search/query', { method: 'POST', body: { query: input.value } });
  const el = document.getElementById('search-results');

  if (!data.hasInternetAccess) {
    el.innerHTML = `<p class="meta">${escapeHtml(data.note)}</p>`;
    return;
  }

  el.innerHTML = `
    <p class="meta">INFORMATION TROUVÉE SUR INTERNET (${data.informationTrouvee.length} résultat(s))</p>
    ${data.informationTrouvee.map(r => `
      <div class="card-block">
        <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a>
        <p class="meta">${escapeHtml(r.url)}</p>
        <p>${escapeHtml(r.snippet)}</p>
      </div>
    `).join('')}
    <p class="meta">${escapeHtml(data.note)}</p>
  `;
});

// --- PHYSIQUE ---
async function loadPhysique() {
  const [summary, measurements, workouts, goals] = await Promise.all([
    api('/physique/summary'), api('/physique/measurements'), api('/physique/workouts'), api('/physique/goals')
  ]);
  loadProgressPhotos();

  try {
    const { vision } = await api('/physique/vision');
    document.getElementById('physique-vision-input').value = vision;
  } catch { /* pas bloquant */ }

  document.getElementById('physique-summary').innerHTML = `
    <div class="badge-row">
      ${summary.latest?.weight ? `<span class="badge">Poids : ${summary.latest.weight} kg${summary.weightTrend30d != null ? ` (${summary.weightTrend30d >= 0 ? '+' : ''}${summary.weightTrend30d} sur 30j)` : ''}</span>` : ''}
      ${summary.latest?.waist ? `<span class="badge">Tour de taille : ${summary.latest.waist} cm${summary.waistTrend30d != null ? ` (${summary.waistTrend30d >= 0 ? '+' : ''}${summary.waistTrend30d} sur 30j)` : ''}</span>` : ''}
      <span class="badge">Entraînements 7j : ${summary.workoutsLast7Days}</span>
      <span class="badge">Entraînements 30j : ${summary.workoutsLast30Days}</span>
    </div>
    <p class="meta">${escapeHtml(summary.note)}</p>
  `;

  document.getElementById('measurement-list').innerHTML = measurements.slice(-10).reverse().map(m => `
    <div class="card">
      <span>${m.date} — ${m.weight ? `${m.weight} kg` : ''} ${m.waist ? `${m.waist} cm` : ''}</span>
      <button class="small danger" data-del-measure="${m.id}">Supprimer</button>
    </div>
  `).join('') || '<p class="meta">Aucune mesure.</p>';
  document.querySelectorAll('[data-del-measure]').forEach(btn => {
    btn.onclick = async () => { await api(`/physique/measurements/${btn.dataset.delMeasure}`, { method: 'DELETE' }); loadPhysique(); };
  });

  document.getElementById('workout-list').innerHTML = workouts.slice(0, 10).map(w => `
    <div class="card">
      <span>${w.date} — ${escapeHtml(w.type)} ${w.durationMinutes ? `(${w.durationMinutes} min)` : ''} ${w.sets ? `${w.sets}×${w.reps || '?'}` : ''}</span>
      <button class="small danger" data-del-workout="${w.id}">Supprimer</button>
    </div>
  `).join('') || '<p class="meta">Aucun entraînement.</p>';
  document.querySelectorAll('[data-del-workout]').forEach(btn => {
    btn.onclick = async () => { await api(`/physique/workouts/${btn.dataset.delWorkout}`, { method: 'DELETE' }); loadPhysique(); };
  });

  document.getElementById('physique-goal-list').innerHTML = goals.map(g => `
    <div class="card">
      <span>${g.achieved ? '✅' : '⬜'} ${escapeHtml(g.title)} <span class="meta">(${g.milestone})</span></span>
      <div>
        ${!g.achieved ? `<button class="small" data-done-pgoal="${g.id}">Marquer fait</button>` : ''}
        <button class="small danger" data-del-pgoal="${g.id}">Supprimer</button>
      </div>
    </div>
  `).join('') || '<p class="meta">Aucun objectif.</p>';
  document.querySelectorAll('[data-done-pgoal]').forEach(btn => {
    btn.onclick = async () => { await api(`/physique/goals/${btn.dataset.donePgoal}`, { method: 'PATCH', body: { achieved: true } }); loadPhysique(); };
  });
  document.querySelectorAll('[data-del-pgoal]').forEach(btn => {
    btn.onclick = async () => { await api(`/physique/goals/${btn.dataset.delPgoal}`, { method: 'DELETE' }); loadPhysique(); };
  });
}

document.getElementById('measurement-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const weight = document.getElementById('measurement-weight').value;
  const waist = document.getElementById('measurement-waist').value;
  if (!weight && !waist) return;
  await api('/physique/measurements', { method: 'POST', body: { weight: weight || null, waist: waist || null } });
  document.getElementById('measurement-weight').value = '';
  document.getElementById('measurement-waist').value = '';
  loadPhysique();
});

document.getElementById('workout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('workout-type').value;
  if (!type.trim()) return;
  await api('/physique/workouts', {
    method: 'POST',
    body: {
      type,
      durationMinutes: document.getElementById('workout-duration').value || null,
      sets: document.getElementById('workout-sets').value || null,
      reps: document.getElementById('workout-reps').value || null
    }
  });
  document.getElementById('workout-type').value = '';
  document.getElementById('workout-duration').value = '';
  document.getElementById('workout-sets').value = '';
  document.getElementById('workout-reps').value = '';
  loadPhysique();
});

document.getElementById('physique-vision-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('physique-vision-status');
  try {
    await api('/physique/vision', { method: 'PUT', body: { vision: document.getElementById('physique-vision-input').value } });
    status.textContent = 'Enregistré ✅';
    showToast('Vision mise à jour ✅');
  } catch (err) {
    status.textContent = err.message;
  }
});

document.getElementById('physique-goal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('physique-goal-title').value;
  const milestone = document.getElementById('physique-goal-milestone').value;
  if (!title.trim()) return;
  await api('/physique/goals', { method: 'POST', body: { title, milestone } });
  document.getElementById('physique-goal-title').value = '';
  loadPhysique();
});

// --- STYLE ---
const STYLE_LABELS = {};

async function loadStyle() {
  let checklist, overview, entries;
  try {
    [checklist, overview, entries] = await Promise.all([
      api('/style/checklist'), api('/style/overview'), api('/style/entries')
    ]);
  } catch (err) {
    document.getElementById('style-overview').textContent = 'Erreur : ' + err.message;
    return;
  }
  checklist.forEach(a => { STYLE_LABELS[a.id] = a.title; });

  document.getElementById('style-overview').innerHTML = `
    <p class="meta">${overview.totalEntries} note(s) au total.</p>
    ${overview.neverAddressed.length ? `<div class="badge-row">${overview.neverAddressed.map(t => `<span class="badge">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <p class="meta">${escapeHtml(overview.note)}</p>
  `;

  document.getElementById('style-checklist').innerHTML = checklist.map(a => `
    <div class="card-block">
      <h4>${escapeHtml(a.title)}</h4>
      <ul>${a.prompts.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
      <form data-style-form="${a.id}">
        <textarea placeholder="Ta réflexion ou l'action que tu vas prendre..." rows="2"></textarea>
        <button type="submit">Enregistrer</button>
      </form>
    </div>
  `).join('');

  document.querySelectorAll('[data-style-form]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const textarea = form.querySelector('textarea');
      if (!textarea.value.trim()) return;
      await api('/style/entries', { method: 'POST', body: { area: form.dataset.styleForm, note: textarea.value } });
      textarea.value = '';
      loadStyle();
    });
  });

  document.getElementById('style-entries-list').innerHTML = entries.map(e => `
    <div class="card">
      <div>
        <div>${escapeHtml(STYLE_LABELS[e.area] || e.area)} — ${escapeHtml(e.note)}</div>
        <div class="meta">${new Date(e.createdAt).toLocaleString('fr-FR')}</div>
      </div>
      <button class="small danger" data-del-style="${e.id}">Supprimer</button>
    </div>
  `).join('') || '<p class="meta">Aucune entrée pour l\'instant.</p>';
  document.querySelectorAll('[data-del-style]').forEach(btn => {
    btn.onclick = async () => { await api(`/style/entries/${btn.dataset.delStyle}`, { method: 'DELETE' }); loadStyle(); };
  });
}

// --- ADAPTATION ---
document.getElementById('adaptation-refresh-btn').onclick = async () => {
  const el = document.getElementById('adaptation-results');
  el.textContent = 'Analyse en cours...';
  const data = await api('/adaptation/suggestions');
  const ICONS = {
    increase_difficulty: '📈', reduce_load: '📉', reintroduce_domain: '🔄',
    review_goal: '🧐', reduce_scope: '⚠️', high_friction_week: '🆘'
  };
  el.innerHTML = data.suggestions.length
    ? data.suggestions.map(s => `<div class="card"><span>${ICONS[s.type] || '💡'} ${escapeHtml(s.message)}</span></div>`).join('')
    : '<p class="meta">Rien à signaler pour l\'instant — continue comme ça.</p>';
  el.innerHTML += `<p class="meta">${escapeHtml(data.note)}</p>`;
};

// --- Bilan du soir ---
document.getElementById('daily-reflection-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('daily-reflection-status');
  try {
    await api('/progress/daily-reflection', {
      method: 'PUT',
      body: {
        accomplished: document.getElementById('reflection-accomplished').value,
        difficult: document.getElementById('reflection-difficult').value,
        learned: document.getElementById('reflection-learned').value,
        differently: document.getElementById('reflection-differently').value
      }
    });
    status.textContent = 'Enregistré ✅';
    showToast('Bilan du soir enregistré ✅');
  } catch (err) {
    status.textContent = err.message;
  }
});

// --- RELATIONS ---
document.getElementById('relationship-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('relationship-name');
  if (!input.value.trim()) return;
  await api('/relationships', { method: 'POST', body: { name: input.value } });
  input.value = '';
  loadRelationships();
});

async function loadRelationships() {
  const list = await api('/relationships');
  const el = document.getElementById('relationship-list');
  el.innerHTML = list.length ? list.map(r => `
    <div class="card">
      <span>${escapeHtml(r.name)} <span class="meta">(${r.entryCount} entrée${r.entryCount > 1 ? 's' : ''})</span></span>
      <div>
        <button class="small" data-open-rel="${r.id}">Ouvrir</button>
        <button class="small danger" data-del-rel="${r.id}">Supprimer</button>
      </div>
    </div>
  `).join('') : '<p class="meta">Aucune relation pour l\'instant.</p>';

  el.querySelectorAll('[data-open-rel]').forEach(btn => { btn.onclick = () => openRelationship(btn.dataset.openRel); });
  el.querySelectorAll('[data-del-rel]').forEach(btn => {
    btn.onclick = async () => { await api(`/relationships/${btn.dataset.delRel}`, { method: 'DELETE' }); loadRelationships(); };
  });
}

async function openRelationship(id) {
  const data = await api(`/relationships/${id}/entries`);
  const block = document.getElementById('relationship-detail-block');
  block.classList.remove('hidden');
  document.getElementById('relationship-detail').innerHTML = `
    <h3>${escapeHtml(data.relationship.name)}</h3>
    <form id="relationship-entry-form">
      <select id="rel-entry-type">
        <option value="sujet">Sujet important</option>
        <option value="conflit">Conflit</option>
        <option value="positif">Moment positif</option>
        <option value="besoin">Besoin exprimé</option>
      </select>
      <textarea id="rel-entry-content" placeholder="Ce qui s'est passé..." rows="2"></textarea>
      <textarea id="rel-entry-know" placeholder="Ce que tu SAIS (dit clairement, pas supposé)" rows="2"></textarea>
      <textarea id="rel-entry-assume" placeholder="Ce que tu SUPPOSES seulement" rows="2"></textarea>
      <textarea id="rel-entry-ask" placeholder="Ce qu'il faudrait lui demander directement" rows="2"></textarea>
      <input type="file" id="rel-entry-photo" accept="image/*" capture="environment" />
      <button type="submit">Enregistrer</button>
    </form>
    <div id="relationship-entries-list" style="margin-top:14px;">
      ${data.entries.map(en => `
        <div class="card" style="flex-direction:column;align-items:stretch;">
          <div style="display:flex;justify-content:space-between;">
            <span class="badge">${escapeHtml(data.entryTypeLabels[en.type] || en.type)}</span>
            <button class="small danger" data-del-rel-entry="${en.id}">Supprimer</button>
          </div>
          ${en.photo ? `<img src="${en.photo}" style="max-width:120px;border-radius:8px;margin:8px 0;" />` : ''}
          <p style="margin:8px 0 4px;">${escapeHtml(en.content)}</p>
          ${en.whatYouKnow ? `<p class="meta">Sais : ${escapeHtml(en.whatYouKnow)}</p>` : ''}
          ${en.whatYouAssume ? `<p class="meta">Suppose : ${escapeHtml(en.whatYouAssume)}</p>` : ''}
          ${en.toAsk ? `<p class="meta">À demander : ${escapeHtml(en.toAsk)}</p>` : ''}
          <p class="meta">${new Date(en.createdAt).toLocaleString('fr-FR')}</p>
        </div>
      `).join('') || '<p class="meta">Aucune entrée pour l\'instant.</p>'}
    </div>
  `;
  document.getElementById('relationship-entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('rel-entry-content').value;
    if (!content.trim()) return;
    const fileInput = document.getElementById('rel-entry-photo');
    let photo = null;
    if (fileInput.files[0]) photo = await resizeImageToDataUrl(fileInput.files[0], 600, 0.8);
    await api(`/relationships/${id}/entries`, {
      method: 'POST',
      body: {
        type: document.getElementById('rel-entry-type').value, content,
        whatYouKnow: document.getElementById('rel-entry-know').value,
        whatYouAssume: document.getElementById('rel-entry-assume').value,
        toAsk: document.getElementById('rel-entry-ask').value,
        photo
      }
    });
    openRelationship(id);
    loadRelationships();
  });
  document.querySelectorAll('[data-del-rel-entry]').forEach(btn => {
    btn.onclick = async () => { await api(`/relationships/${id}/entries/${btn.dataset.delRelEntry}`, { method: 'DELETE' }); openRelationship(id); loadRelationships(); };
  });
  block.scrollIntoView({ behavior: 'smooth' });
}

// --- SKINCARE ---
const SKINCARE_STEP_LABELS = {
  'nettoyant-doux': 'Nettoyant doux', 'toner': 'Toner', 'essence': 'Essence', 'serum': 'Sérum',
  'contour-yeux': 'Contour des yeux', 'hydratant': 'Hydratant', 'spf': 'SPF',
  'huile-demaquillante': 'Huile démaquillante', 'exfoliant-2-3x-semaine': 'Exfoliant (2-3x/semaine)',
  'masque-nuit-hydratant': 'Masque de nuit hydratant'
};
async function loadSkincare() {
  let steps, logs;
  try {
    [steps, logs] = await Promise.all([api('/style/skincare/steps'), api('/style/skincare')]);
  } catch (err) {
    document.getElementById('skincare-am-list').textContent = 'Erreur : ' + err.message;
    return;
  }
  const today = logs.find(l => l.date === new Date().toISOString().slice(0, 10)) || { amSteps: [], pmSteps: [] };

  function renderChecklist(containerId, stepKeys, doneKeys, period) {
    document.getElementById(containerId).innerHTML = stepKeys.map(key => `
      <label style="display:flex;align-items:center;gap:8px;padding:8px 0;">
        <input type="checkbox" data-skincare-step="${key}" data-skincare-period="${period}" ${doneKeys.includes(key) ? 'checked' : ''} />
        ${escapeHtml(SKINCARE_STEP_LABELS[key] || key)}
      </label>
    `).join('');
  }
  renderChecklist('skincare-am-list', steps.am, today.amSteps, 'am');
  renderChecklist('skincare-pm-list', steps.pm, today.pmSteps, 'pm');

  document.querySelectorAll('[data-skincare-step]').forEach(cb => {
    cb.onchange = async () => {
      const period = cb.dataset.skincarePeriod;
      const checked = Array.from(document.querySelectorAll(`[data-skincare-period="${period}"]:checked`)).map(c => c.dataset.skincareStep);
      const body = period === 'am' ? { amSteps: checked } : { pmSteps: checked };
      await api('/style/skincare', { method: 'PUT', body });
    };
  });
}

// --- ALIMENTATION ---
document.getElementById('meal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const description = document.getElementById('meal-description').value;
  const mealType = document.getElementById('meal-type').value;
  const fileInput = document.getElementById('meal-photo-input');
  if (!description.trim() && !fileInput.files[0]) return;
  try {
    let photo = null;
    if (fileInput.files[0]) photo = await resizeImageToDataUrl(fileInput.files[0], 500, 0.75);
    await api('/nutrition/meals', { method: 'POST', body: { description, mealType, photo } });
    document.getElementById('meal-description').value = '';
    fileInput.value = '';
    loadNutrition();
  } catch (err) {
    showToast(err.message);
  }
});

async function loadNutrition() {
  const meals = await api('/nutrition/meals');
  const MEAL_TYPE_LABELS = { 'petit-dejeuner': 'Petit-déjeuner', 'dejeuner': 'Déjeuner', 'diner': 'Dîner', 'collation': 'Collation' };
  document.getElementById('meal-list').innerHTML = meals.length ? meals.map(m => `
    <div class="card" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;gap:10px;align-items:center;">
        ${m.photo ? `<img src="${m.photo}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0;" />` : ''}
        <span style="flex:1;">${escapeHtml(MEAL_TYPE_LABELS[m.mealType] || m.mealType)} — ${escapeHtml(m.description)} <span class="meta">(${m.date})</span></span>
        <button class="small danger" data-del-meal="${m.id}">Supprimer</button>
      </div>
      ${m.aiAnalysis ? (m.aiAnalysis.unavailable
        ? `<p class="meta" style="margin-top:8px;">${escapeHtml(m.aiAnalysis.note)}</p>`
        : `
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
            <p class="meta" style="font-weight:700;">ANALYSE IA (${escapeHtml(m.aiAnalysis.confidence)} confiance)</p>
            ${m.aiAnalysis.foods?.length ? `<div class="badge-row">${m.aiAnalysis.foods.map(f => `<span class="badge">${escapeHtml(f)}</span>`).join('')}</div>` : ''}
            ${m.aiAnalysis.estimatedCalories ? `<p class="meta">≈ ${m.aiAnalysis.estimatedCalories} kcal</p>` : ''}
            ${m.aiAnalysis.macroNote ? `<p class="meta">${escapeHtml(m.aiAnalysis.macroNote)}</p>` : ''}
          </div>
        `) : ''}
    </div>
  `).join('') : '<p class="meta">Aucun repas enregistré pour l\'instant.</p>';
  document.querySelectorAll('[data-del-meal]').forEach(btn => {
    btn.onclick = async () => { await api(`/nutrition/meals/${btn.dataset.delMeal}`, { method: 'DELETE' }); loadNutrition(); };
  });
}

// --- Générateur de séance sport (physique) ---
document.getElementById('workout-gen-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const location = document.getElementById('workout-gen-location').value;
  const equipment = document.getElementById('workout-gen-equipment').value;
  const data = await api(`/physique/workout-suggestion?location=${location}&equipment=${equipment}`);
  document.getElementById('workout-gen-result').innerHTML = `
    ${data.exercises.map(ex => `<div class="card"><span>${escapeHtml(ex.name)}</span><span class="meta">${ex.sets} × ${ex.reps}</span></div>`).join('')}
    <p class="meta">${escapeHtml(data.note)}</p>
  `;
});

// --- Photos de progression physique ---
document.getElementById('progress-photo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('progress-photo-input');
  if (!fileInput.files[0]) return;
  try {
    const photo = await resizeImageToDataUrl(fileInput.files[0], 500, 0.8);
    const note = document.getElementById('progress-photo-note').value;
    await api('/physique/progress-photos', { method: 'POST', body: { photo, note } });
    fileInput.value = '';
    document.getElementById('progress-photo-note').value = '';
    loadProgressPhotos();
  } catch (err) {
    showToast(err.message);
  }
});
async function loadProgressPhotos() {
  const photos = await api('/physique/progress-photos');
  document.getElementById('progress-photo-list').innerHTML = photos.map(p => `
    <div style="position:relative;">
      <img src="${p.photo}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;" title="${escapeHtml(p.date)} ${escapeHtml(p.note || '')}" />
      <button class="small danger" data-del-photo="${p.id}" style="position:absolute;top:4px;right:4px;padding:2px 6px;">✕</button>
    </div>
  `).join('') || '<p class="meta">Aucune photo pour l\'instant.</p>';
  document.querySelectorAll('[data-del-photo]').forEach(btn => {
    btn.onclick = async () => { await api(`/physique/progress-photos/${btn.dataset.delPhoto}`, { method: 'DELETE' }); loadProgressPhotos(); };
  });
}

// --- Analyse photo (multimodale) ---
const CATEGORY_ICONS = {
  auto: '🔍', nourriture: '🍽️', peau: '👤', objet: '📦', produit: '🛍️',
  document: '📄', vetement: '👕', animal: '🐶', plante: '🌱', materiel_av: '🎥'
};
let currentImageAnalysisId = null;

function renderImageAnalysisChat(analysis) {
  currentImageAnalysisId = analysis.id;
  document.getElementById('image-analysis-chat-block').classList.remove('hidden');
  const chatEl = document.getElementById('image-analysis-chat');
  chatEl.innerHTML = `
    ${analysis.photo ? `<img src="${analysis.photo}" style="max-width:160px;border-radius:10px;margin-bottom:10px;" />` : ''}
    <div id="ia-messages" style="display:flex;flex-direction:column;gap:8px;">
      ${analysis.messages.map(m => `
        <div class="msg ${m.role === 'user' ? 'user' : 'assistant'}" style="align-self:${m.role === 'user' ? 'flex-end' : 'flex-start'};">
          <div>${escapeHtml(m.content)}</div>
          ${m.role === 'assistant' ? speakerHTML(m.content) : ''}
        </div>
      `).join('')}
    </div>
    ${analysis.providerUsed ? `<p class="meta" style="margin-top:6px;">Répondu par ${escapeHtml(analysis.providerUsed)} (${escapeHtml(analysis.modelUsed || '')})</p>` : ''}
  `;
  chatEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('image-analysis-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('ia-photo-input');
  const status = document.getElementById('image-analysis-status');
  if (!fileInput.files[0]) { status.textContent = 'Choisis ou prends une photo.'; return; }
  status.textContent = 'Analyse en cours...';
  try {
    const photo = await resizeImageToDataUrl(fileInput.files[0], 700, 0.8);
    const analysis = await api('/image-analysis', {
      method: 'POST',
      body: {
        photo,
        category: document.getElementById('ia-category').value,
        question: document.getElementById('ia-question').value,
        keepPhoto: document.getElementById('ia-keep-photo').checked
      }
    });
    status.textContent = analysis.unavailable ? '' : 'Analyse terminée ✅';
    renderImageAnalysisChat(analysis);
    fileInput.value = '';
    document.getElementById('ia-question').value = '';
    loadImageAnalysisHistory();
  } catch (err) {
    status.textContent = err.message;
  }
});

document.getElementById('ia-followup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('ia-followup-input');
  if (!input.value.trim() || !currentImageAnalysisId) return;
  const content = input.value;
  input.value = '';
  const analysis = await api(`/image-analysis/${currentImageAnalysisId}/messages`, { method: 'POST', body: { content } });
  renderImageAnalysisChat(analysis);
  loadImageAnalysisHistory();
});

async function openImageAnalysis(id) {
  const analysis = await api(`/image-analysis/${id}`);
  renderImageAnalysisChat(analysis);
}

async function loadImageAnalysisHistory() {
  const list = await api('/image-analysis');
  const CATEGORY_LABELS_FR = { auto: 'Détection automatique', nourriture: 'Nourriture', peau: 'Visage et peau', objet: 'Objet', produit: 'Produit', document: 'Document', vetement: 'Vêtement', animal: 'Animal', plante: 'Plante', materiel_av: 'Matériel audiovisuel' };
  document.getElementById('image-analysis-history').innerHTML = list.length ? list.map(a => `
    <div class="card">
      ${a.photo ? `<img src="${a.photo}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0;" />` : `<span style="font-size:20px;">${CATEGORY_ICONS[a.category] || '📷'}</span>`}
      <span style="flex:1;">${CATEGORY_ICONS[a.category] || ''} ${escapeHtml(CATEGORY_LABELS_FR[a.category] || a.category)} <span class="meta">— ${escapeHtml(a.lastMessage || '')}</span></span>
      <div>
        <button class="small" data-open-ia="${a.id}">Ouvrir</button>
        <button class="small danger" data-del-ia="${a.id}">Supprimer</button>
      </div>
    </div>
  `).join('') : '<p class="meta">Aucune analyse pour l\'instant.</p>';

  document.querySelectorAll('[data-open-ia]').forEach(btn => { btn.onclick = () => openImageAnalysis(btn.dataset.openIa); });
  document.querySelectorAll('[data-del-ia]').forEach(btn => {
    btn.onclick = async () => {
      await api(`/image-analysis/${btn.dataset.delIa}`, { method: 'DELETE' });
      if (currentImageAnalysisId === btn.dataset.delIa) {
        currentImageAnalysisId = null;
        document.getElementById('image-analysis-chat-block').classList.add('hidden');
      }
      loadImageAnalysisHistory();
    };
  });
}

// --- Init ---
checkAppLock();
if (state.token && state.user) showMain();

// --- PERSONNALISER MON MENU (afficher / masquer les cartes de l'Accueil) ---
(function initMenuCustomization() {
  const STORAGE_KEY = 'bm_hidden_sections';
  const CAT_TITLES = { 'cat-moi': 'Moi', 'cat-coaching': 'Coaching', 'cat-apprendre': 'Apprendre', 'cat-corps': 'Corps & Style', 'cat-vie': 'Vie' };

  function setHidden(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function refreshHome() {
    try { renderCategories(window._lastDomainScores); } catch (e) {}
  }

  function renderList() {
    const listEl = document.getElementById('menu-custom-list');
    if (!listEl) return;
    const hidden = getHiddenSections();
    listEl.innerHTML = Object.entries(CATEGORIES).map(([catId, items]) => `
      <div class="meta" style="margin-top:6px;font-weight:700;">${escapeHtml(CAT_TITLES[catId] || catId)}</div>
      ${items.map(it => `
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" data-menu-toggle="${it.view}" ${hidden.includes(it.view) ? '' : 'checked'} />
          <span>${it.icon} ${escapeHtml(it.name)}</span>
        </label>`).join('')}
    `).join('');
    listEl.querySelectorAll('[data-menu-toggle]').forEach(cb => {
      cb.addEventListener('change', () => {
        const view = cb.dataset.menuToggle;
        const list = getHiddenSections().filter(v => v !== view);
        if (!cb.checked) list.push(view);
        setHidden(list);
        refreshHome();
      });
    });
  }

  const resetBtn = document.getElementById('menu-custom-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      setHidden([]);
      refreshHome();
      renderList();
      showToast('Toutes les sections sont réaffichées');
    });
  }
  renderList();
})();

// --- MES IDÉES : chaque idée devient une mini-section avec les éléments choisis ---
var IDEA_MODULES = [
  { key: 'notes',     label: '📝 Notes / texte' },
  { key: 'micro',     label: '🎤 Micro (enregistrer sa voix)' },
  { key: 'photos',    label: '📸 Photos (galerie + appareil photo)' },
  { key: 'checklist', label: '✅ Liste de tâches à cocher' },
  { key: 'links',     label: '🔗 Liens (vidéos, sites, documents)' },
  { key: 'deadline',  label: '📅 Date limite / rappel' },
  { key: 'progress',  label: '📈 Suivi d\'avancement (statut + %)' }
];
var ideasDbPromise = null;
var ideaRecorder = null;
var ideaRecChunks = [];
var ideaRecStart = 0;
var ideaRecTimer = null;

function ideasDb() {
  if (!ideasDbPromise) {
    ideasDbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('bm_ideas_db', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('ideas')) db.createObjectStore('ideas', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('media')) {
          const m = db.createObjectStore('media', { keyPath: 'id' });
          m.createIndex('ideaId', 'ideaId');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return ideasDbPromise;
}
async function idbDo(store, mode, fn) {
  const db = await ideasDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    tx.onerror = () => reject(tx.error);
  });
}
const ideasGetAll = () => idbDo('ideas', 'readonly', s => s.getAll());
const ideaGet = (id) => idbDo('ideas', 'readonly', s => s.get(id));
const ideaPut = (idea) => idbDo('ideas', 'readwrite', s => s.put(idea));
const ideaDel = (id) => idbDo('ideas', 'readwrite', s => s.delete(id));
const mediaPut = (m) => idbDo('media', 'readwrite', s => s.put(m));
const mediaDel = (id) => idbDo('media', 'readwrite', s => s.delete(id));
const mediaForIdea = (ideaId) => idbDo('media', 'readonly', s => s.index('ideaId').getAll(ideaId));

function newId(prefix) { return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }

async function loadIdeas() {
  document.getElementById('ideas-home').classList.remove('hidden');
  document.getElementById('idea-detail').classList.add('hidden');

  const picker = document.getElementById('idea-module-picker');
  picker.innerHTML = IDEA_MODULES.map(m => `
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
      <input type="checkbox" data-idea-mod="${m.key}" ${m.key === 'notes' ? 'checked' : ''} /> <span>${m.label}</span>
    </label>`).join('');

  document.getElementById('idea-create-btn').onclick = async () => {
    const title = document.getElementById('idea-title').value.trim();
    if (!title) { showToast('Donne un nom à ton idée 🙂'); return; }
    const modules = Array.from(picker.querySelectorAll('[data-idea-mod]:checked')).map(c => c.dataset.ideaMod);
    const idea = {
      id: newId('idea'), title, description: document.getElementById('idea-desc').value.trim(),
      modules, notes: '', checklist: [], links: [], deadline: '', status: 'À démarrer', percent: 0,
      improvements: [], createdAt: Date.now()
    };
    try {
      await ideaPut(idea);
      document.getElementById('idea-title').value = '';
      document.getElementById('idea-desc').value = '';
      showToast('Idée créée ✨');
      openIdea(idea.id);
    } catch (err) { showToast('Erreur : ' + err.message); }
  };

  const listEl = document.getElementById('ideas-list');
  try {
    const ideas = (await ideasGetAll()).sort((a, b) => b.createdAt - a.createdAt);
    listEl.innerHTML = ideas.length ? ideas.map(i => `
      <div class="card" style="cursor:pointer;" data-open-idea="${i.id}">
        <div>
          <div><strong>💡 ${escapeHtml(i.title)}</strong></div>
          <div class="meta">${i.modules.map(k => (IDEA_MODULES.find(m => m.key === k) || {label: k}).label.split(' ')[0]).join(' ')} · ${escapeHtml(i.status || '')}</div>
        </div>
      </div>`).join('') : '<p class="meta">Aucune idée pour l\'instant. Crée la première au-dessus !</p>';
    listEl.querySelectorAll('[data-open-idea]').forEach(el => { el.onclick = () => openIdea(el.dataset.openIdea); });
  } catch (err) {
    listEl.innerHTML = '<p class="meta">Impossible de charger les idées sur ce navigateur.</p>';
  }
}

async function openIdea(id) {
  const idea = await ideaGet(id);
  if (!idea) { loadIdeas(); return; }
  stopIdeaRecording(true);
  document.getElementById('ideas-home').classList.add('hidden');
  const el = document.getElementById('idea-detail');
  el.classList.remove('hidden');
  const has = (k) => idea.modules.includes(k);
  const save = async () => { await ideaPut(idea); };

  el.innerHTML = `
    <div class="card-block">
      <button type="button" class="small" id="idea-back">← Retour à mes idées</button>
      <h3 style="margin-top:12px;text-transform:none;font-size:18px;color:inherit;">💡 ${escapeHtml(idea.title)}</h3>
      ${idea.description ? `<p>${escapeHtml(idea.description)}</p>` : ''}
    </div>

    ${has('progress') ? `
    <div class="card-block">
      <h3>📈 Avancement</h3>
      <select id="idea-status" style="width:100%;margin-bottom:8px;">
        ${['À démarrer', 'En cours', 'En pause', 'Terminé'].map(s => `<option ${s === idea.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <input type="range" id="idea-percent" min="0" max="100" step="5" value="${idea.percent || 0}" style="width:100%;" />
      <div class="meta" id="idea-percent-label">${idea.percent || 0} %</div>
    </div>` : ''}

    ${has('deadline') ? `
    <div class="card-block">
      <h3>📅 Date limite</h3>
      <input type="date" id="idea-deadline" value="${idea.deadline || ''}" style="width:100%;" />
      <div class="meta" id="idea-deadline-info"></div>
    </div>` : ''}

    ${has('notes') ? `
    <div class="card-block">
      <h3>📝 Notes</h3>
      <textarea id="idea-notes" placeholder="Écris librement...">${escapeHtml(idea.notes || '')}</textarea>
      <div class="meta" id="idea-notes-saved"></div>
    </div>` : ''}

    ${has('micro') ? `
    <div class="card-block">
      <h3>🎤 Micro</h3>
      <div class="rec-row">
        <button type="button" id="idea-rec-btn">🎤 Enregistrer</button>
        <span class="rec-time" id="idea-rec-time">00:00</span>
        <span class="rec-level"><span id="idea-rec-level"></span></span>
      </div>
      <p class="meta" id="idea-rec-status">Touche « Enregistrer » et parle. Ton enregistrement reste sur cet appareil.</p>
      <div class="rec-row">
        <button type="button" class="small" id="idea-dictate-btn">✍️ Dicter (voix → texte)</button>
      </div>
      <p class="meta" id="idea-dictate-status"></p>
      <div id="idea-dictation" class="idea-dictation ${idea.dictation ? '' : 'hidden'}">
        <p class="meta">Texte dicté (modifiable) :</p>
        <textarea id="idea-dictation-text">${escapeHtml(idea.dictation || '')}</textarea>
      </div>
      <div id="idea-audio-list" style="margin-top:10px;"></div>
    </div>` : ''}

    ${has('photos') ? `
    <div class="card-block">
      <h3>📸 Photos</h3>
      <div style="display:flex;gap:8px;">
        <button type="button" class="small" id="idea-photo-pick">📤 Galerie</button>
        <button type="button" class="small" id="idea-photo-cam">📷 Appareil photo</button>
      </div>
      <input type="file" id="idea-photo-input" accept="image/*" multiple style="display:none;" />
      <input type="file" id="idea-cam-input" accept="image/*" capture="environment" style="display:none;" />
      <div id="idea-photo-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;margin-top:10px;"></div>
    </div>` : ''}

    ${has('checklist') ? `
    <div class="card-block">
      <h3>✅ Tâches</h3>
      <div style="display:flex;gap:8px;">
        <input type="text" id="idea-task-input" placeholder="Nouvelle tâche..." style="flex:1;" />
        <button type="button" class="small" id="idea-task-add">Ajouter</button>
      </div>
      <div id="idea-task-list" style="margin-top:10px;"></div>
    </div>` : ''}

    ${has('links') ? `
    <div class="card-block">
      <h3>🔗 Liens</h3>
      <input type="text" id="idea-link-label" placeholder="Titre (facultatif)" style="width:100%;margin-bottom:6px;" />
      <div style="display:flex;gap:8px;">
        <input type="url" id="idea-link-url" placeholder="https://..." style="flex:1;" />
        <button type="button" class="small" id="idea-link-add">Ajouter</button>
      </div>
      <div id="idea-link-list" style="margin-top:10px;"></div>
    </div>` : ''}

    <div class="card-block">
      <h3>🛠️ Améliorations souhaitées</h3>
      <p class="meta">Note ici ce que tu voudrais ajouter plus tard à cette idée. Le bouton "Copier pour Claude" prépare un message à me coller.</p>
      <div style="display:flex;gap:8px;">
        <input type="text" id="idea-imp-input" placeholder="Ex : pouvoir partager les photos" style="flex:1;" />
        <button type="button" class="small" id="idea-imp-add">Ajouter</button>
      </div>
      <div id="idea-imp-list" style="margin-top:10px;"></div>
      <button type="button" class="small" id="idea-copy-claude" style="margin-top:10px;">📋 Copier pour Claude</button>
    </div>

    <div class="card-block">
      <h3>⚙️ Éléments de cette idée</h3>
      <div id="idea-edit-mods" style="display:flex;flex-direction:column;gap:8px;"></div>
      <button type="button" class="small danger" id="idea-delete" style="margin-top:14px;">🗑️ Supprimer cette idée</button>
    </div>
  `;

  document.getElementById('idea-back').onclick = () => { stopIdeaRecording(true); loadIdeas(); };

  // Avancement
  if (has('progress')) {
    document.getElementById('idea-status').onchange = async (e) => { idea.status = e.target.value; await save(); };
    const pr = document.getElementById('idea-percent');
    pr.oninput = () => { document.getElementById('idea-percent-label').textContent = pr.value + ' %'; };
    pr.onchange = async () => { idea.percent = Number(pr.value); await save(); };
  }

  // Date limite
  if (has('deadline')) {
    const dl = document.getElementById('idea-deadline');
    const info = () => {
      const box = document.getElementById('idea-deadline-info');
      if (!dl.value) { box.textContent = ''; return; }
      const days = Math.ceil((new Date(dl.value + 'T23:59:59') - new Date()) / 86400000);
      box.textContent = days > 0 ? `Encore ${days} jour(s)` : days === 0 ? "C'est aujourd'hui !" : `Dépassée de ${-days} jour(s)`;
    };
    info();
    dl.onchange = async () => { idea.deadline = dl.value; await save(); info(); };
  }

  // Notes (sauvegarde auto)
  if (has('notes')) {
    let t = null;
    const ta = document.getElementById('idea-notes');
    ta.oninput = () => {
      clearTimeout(t);
      t = setTimeout(async () => { idea.notes = ta.value; await save(); document.getElementById('idea-notes-saved').textContent = 'Enregistré ✓'; }, 600);
    };
  }

  // Micro
  if (has('micro')) {
    document.getElementById('idea-rec-btn').onclick = () => toggleIdeaRecording(idea.id);
    setupIdeaDictation(idea, save);
    renderIdeaAudios(idea.id);
  }

  // Photos
  if (has('photos')) {
    const pickIn = document.getElementById('idea-photo-input');
    const camIn = document.getElementById('idea-cam-input');
    document.getElementById('idea-photo-pick').onclick = () => pickIn.click();
    document.getElementById('idea-photo-cam').onclick = () => camIn.click();
    const handle = async (files) => {
      for (const f of Array.from(files)) {
        try {
          const dataUrl = await resizeImageToDataUrl(f, 1280, 0.85);
          await mediaPut({ id: newId('ph'), ideaId: idea.id, type: 'photo', data: dataUrl, createdAt: Date.now() });
        } catch (err) { showToast('Photo non ajoutée : ' + err.message); }
      }
      pickIn.value = ''; camIn.value = '';
      renderIdeaPhotos(idea.id);
    };
    pickIn.onchange = (e) => handle(e.target.files);
    camIn.onchange = (e) => handle(e.target.files);
    renderIdeaPhotos(idea.id);
  }

  // Liste simple réutilisable (tâches, améliorations)
  const setupList = (listKey, inputId, addId, listId) => {
    const render = () => {
      const box = document.getElementById(listId);
      const items = idea[listKey];
      box.innerHTML = items.length ? items.map((it, i) => `
        <div class="card">
          <label style="display:flex;align-items:center;gap:10px;flex:1;">
            <input type="checkbox" data-li-done="${i}" ${it.done ? 'checked' : ''} />
            <span style="${it.done ? 'text-decoration:line-through;opacity:.6;' : ''}">${escapeHtml(it.text)}</span>
          </label>
          <button class="small danger" data-li-del="${i}">✕</button>
        </div>`).join('') : '<p class="meta">Rien pour l\'instant.</p>';
      box.querySelectorAll('[data-li-done]').forEach(cb => {
        cb.onchange = async () => { items[cb.dataset.liDone].done = cb.checked; await save(); render(); };
      });
      box.querySelectorAll('[data-li-del]').forEach(b => {
        b.onclick = async () => { items.splice(Number(b.dataset.liDel), 1); await save(); render(); };
      });
    };
    const add = async () => {
      const inp = document.getElementById(inputId);
      if (!inp.value.trim()) return;
      idea[listKey].push({ text: inp.value.trim(), done: false });
      inp.value = '';
      await save(); render();
    };
    document.getElementById(addId).onclick = add;
    document.getElementById(inputId).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    render();
  };
  if (has('checklist')) setupList('checklist', 'idea-task-input', 'idea-task-add', 'idea-task-list');
  setupList('improvements', 'idea-imp-input', 'idea-imp-add', 'idea-imp-list');

  // Liens
  if (has('links')) {
    const render = () => {
      const box = document.getElementById('idea-link-list');
      box.innerHTML = idea.links.length ? idea.links.map((l, i) => `
        <div class="card">
          <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" style="flex:1;word-break:break-all;">${escapeHtml(l.label || l.url)}</a>
          <button class="small danger" data-link-del="${i}">✕</button>
        </div>`).join('') : '<p class="meta">Aucun lien.</p>';
      box.querySelectorAll('[data-link-del]').forEach(b => {
        b.onclick = async () => { idea.links.splice(Number(b.dataset.linkDel), 1); await save(); render(); };
      });
    };
    document.getElementById('idea-link-add').onclick = async () => {
      let url = document.getElementById('idea-link-url').value.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      idea.links.push({ url, label: document.getElementById('idea-link-label').value.trim() });
      document.getElementById('idea-link-url').value = '';
      document.getElementById('idea-link-label').value = '';
      await save(); render();
    };
    render();
  }

  // Copier pour Claude
  document.getElementById('idea-copy-claude').onclick = async () => {
    const mods = idea.modules.map(k => (IDEA_MODULES.find(m => m.key === k) || {label: k}).label).join(', ');
    const imps = idea.improvements.filter(i => !i.done).map(i => '- ' + i.text).join('\n') || '- (aucune pour l\'instant)';
    const text = `Better Man AI, section "Mes idées"\nIdée : ${idea.title}\nDescription : ${idea.description || '-'}\nÉléments actuels : ${mods || '-'}\nAméliorations que je veux :\n${imps}`;
    try { await navigator.clipboard.writeText(text); showToast('Copié ! Colle-le dans ta conversation avec Claude 📋'); }
    catch { prompt('Copie ce texte :', text); }
  };

  // Ajouter / retirer des éléments à cette idée
  const modsBox = document.getElementById('idea-edit-mods');
  modsBox.innerHTML = IDEA_MODULES.map(m => `
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
      <input type="checkbox" data-edit-mod="${m.key}" ${has(m.key) ? 'checked' : ''} /> <span>${m.label}</span>
    </label>`).join('');
  modsBox.querySelectorAll('[data-edit-mod]').forEach(cb => {
    cb.onchange = async () => {
      idea.modules = IDEA_MODULES.map(m => m.key).filter(k => modsBox.querySelector(`[data-edit-mod="${k}"]`).checked);
      await save();
      openIdea(idea.id);
    };
  });

  // Supprimer l'idée
  document.getElementById('idea-delete').onclick = async () => {
    if (!confirm(`Supprimer l'idée "${idea.title}" et tout son contenu ?`)) return;
    const media = await mediaForIdea(idea.id);
    for (const m of media) await mediaDel(m.id);
    await ideaDel(idea.id);
    showToast('Idée supprimée');
    loadIdeas();
  };
}

// --- Enregistrement vocal des idées ---
// Robuste sur mobile : format choisi selon le navigateur (MP4/AAC d'abord, lisible
// partout y compris sur iPhone), stockage en ArrayBuffer (Safari gère mal les Blob
// dans IndexedDB), données récupérées chaque seconde, messages d'erreur précis.
const IDEA_REC_MAX_SEC = 15 * 60;
var ideaRecAudioCtx = null;
var ideaRecLevelRaf = null;

function pickRecorderMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  return ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    .find(t => MediaRecorder.isTypeSupported(t)) || '';
}

function micErrorMessage(err) {
  const inApp = /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok/i.test(navigator.userAgent);
  if (inApp) return "Le micro ne marche pas dans le navigateur intégré de cette app (WhatsApp, Instagram…). Ouvre Better Man AI dans Safari ou Chrome.";
  switch (err && err.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return isIOS()
        ? "Micro refusé. Sur iPhone : Réglages → Safari → Micro → « Autoriser », puis recharge la page (ou touche « aA » à côté de l'adresse → Réglages du site → Micro)."
        : "Micro refusé. Touche l'icône 🔒 à côté de l'adresse → Autorisations → Micro → Autoriser, puis recharge la page.";
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return "Aucun micro détecté sur cet appareil.";
    case 'NotReadableError':
    case 'TrackStartError':
      return "Le micro est déjà utilisé par une autre app (appel, mémo vocal…). Ferme-la puis réessaie.";
    case 'SecurityError':
      return "Le micro n'est disponible que sur une adresse sécurisée (https).";
    default:
      return `Impossible de démarrer le micro (${(err && (err.name || err.message)) || 'erreur inconnue'}).`;
  }
}

function setRecStatus(text, isError) {
  const el = document.getElementById('idea-rec-status');
  if (el) { el.textContent = text; el.classList.toggle('error', !!isError); }
}

function startLevelMeter(stream) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ideaRecAudioCtx = new Ctx();
    const analyser = ideaRecAudioCtx.createAnalyser();
    analyser.fftSize = 256;
    ideaRecAudioCtx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      const bar = document.getElementById('idea-rec-level');
      if (bar) bar.style.width = Math.min(100, Math.round(peak / 128 * 180)) + '%';
      ideaRecLevelRaf = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) { /* jauge facultative */ }
}
function stopLevelMeter() {
  cancelAnimationFrame(ideaRecLevelRaf);
  try { ideaRecAudioCtx && ideaRecAudioCtx.close(); } catch (e) { /* déjà fermé */ }
  ideaRecAudioCtx = null;
  const bar = document.getElementById('idea-rec-level');
  if (bar) bar.style.width = '0%';
}

async function toggleIdeaRecording(ideaId) {
  const btn = document.getElementById('idea-rec-btn');
  if (ideaRecorder) { stopIdeaRecording(false); return; }
  if (!window.isSecureContext) { setRecStatus(micErrorMessage({ name: 'SecurityError' }), true); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    setRecStatus(isIOS() ? "Enregistrement non supporté : mets à jour iOS (14.3 ou plus) et utilise Safari." : "Enregistrement non supporté par ce navigateur. Essaie Chrome, Safari ou Firefox à jour.", true);
    return;
  }
  btn.disabled = true;
  setRecStatus('Demande d\'accès au micro…');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (err) {
    btn.disabled = false;
    setRecStatus(micErrorMessage(err), true);
    return;
  }
  try {
    const mimeType = pickRecorderMime();
    ideaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (err) {
    stream.getTracks().forEach(t => t.stop());
    btn.disabled = false;
    setRecStatus(micErrorMessage(err), true);
    return;
  }
  ideaRecChunks = [];
  const recorder = ideaRecorder;
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) ideaRecChunks.push(e.data); };
  recorder.onerror = (e) => setRecStatus(micErrorMessage(e.error), true);
  recorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    stopLevelMeter();
    const discard = recorder._discard;
    const duration = Math.round((Date.now() - ideaRecStart) / 1000);
    const type = (recorder.mimeType || ideaRecChunks[0]?.type || 'audio/webm').split(';')[0];
    const blob = new Blob(ideaRecChunks, { type });
    ideaRecChunks = [];
    if (ideaRecorder === recorder) ideaRecorder = null;
    if (discard) return;
    if (!blob.size) { setRecStatus("L'enregistrement est vide : vérifie que le micro capte bien le son, puis réessaie.", true); return; }
    try {
      const data = await blob.arrayBuffer();
      await mediaPut({ id: newId('au'), ideaId, type: 'audio', data, mime: type, size: blob.size, duration, createdAt: Date.now() });
      setRecStatus(`✅ Enregistrement sauvegardé (${duration} s).`);
      showToast('Enregistrement sauvegardé 🎤');
    } catch (err) {
      setRecStatus(`Enregistrement non sauvegardé : ${err.message || err.name}. Mémoire de l'appareil pleine ?`, true);
    }
    if (document.getElementById('idea-audio-list')) renderIdeaAudios(ideaId);
  };
  ideaRecStart = Date.now();
  try {
    recorder.start(1000); // récupère les données chaque seconde : rien n'est perdu si la page passe en arrière-plan
  } catch (err) {
    stream.getTracks().forEach(t => t.stop());
    ideaRecorder = null;
    btn.disabled = false;
    setRecStatus(micErrorMessage(err), true);
    return;
  }
  btn.disabled = false;
  btn.textContent = '⏹️ Arrêter';
  btn.classList.add('recording');
  setRecStatus('🔴 Enregistrement en cours… touche « Arrêter » quand tu as fini.');
  startLevelMeter(stream);
  ideaRecTimer = setInterval(() => {
    const sec = Math.floor((Date.now() - ideaRecStart) / 1000);
    const t = document.getElementById('idea-rec-time');
    if (t) t.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    if (sec >= IDEA_REC_MAX_SEC) { stopIdeaRecording(false); showToast('Enregistrement arrêté après 15 minutes.'); }
  }, 250);
}

function stopIdeaRecording(discard) {
  clearInterval(ideaRecTimer);
  if (ideaRecorder && ideaRecorder.state !== 'inactive') {
    ideaRecorder._discard = !!discard;
    ideaRecorder.stop();
  }
  const btn = document.getElementById('idea-rec-btn');
  if (btn) { btn.textContent = '🎤 Enregistrer'; btn.classList.remove('recording'); }
  const t = document.getElementById('idea-rec-time');
  if (t) t.textContent = '00:00';
}

// Les anciens enregistrements étaient des Blob ; les nouveaux, des ArrayBuffer.
function audioBlobOf(a) {
  if (a.blob) return a.blob;
  return new Blob([a.data], { type: a.mime || 'audio/webm' });
}

async function renderIdeaAudios(ideaId) {
  const box = document.getElementById('idea-audio-list');
  if (!box) return;
  box.querySelectorAll('audio').forEach(el => { if (el.src.startsWith('blob:')) URL.revokeObjectURL(el.src); });
  const items = (await mediaForIdea(ideaId)).filter(m => m.type === 'audio').sort((a, b) => b.createdAt - a.createdAt);
  const probe = document.createElement('audio');
  box.innerHTML = items.length ? items.map(a => {
    const blob = audioBlobOf(a);
    const url = URL.createObjectURL(blob);
    const playable = !blob.type || probe.canPlayType(blob.type) !== '';
    const ext = (blob.type.split('/')[1] || 'webm').replace('mpeg', 'mp3');
    return `
    <div class="card rec-item">
      <audio controls preload="metadata" src="${url}"></audio>
      <div class="rec-item-meta">
        <span class="meta">${new Date(a.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${a.duration || 0} s</span>
        <a class="small-link" href="${url}" download="idee-${new Date(a.createdAt).toISOString().slice(0, 16).replace(/[T:]/g, '-')}.${ext}">⬇️ Télécharger</a>
        <button class="small danger" data-del-au="${a.id}">✕</button>
      </div>
      ${playable ? '' : '<p class="meta">⚠️ Ce format ne se lit pas sur ce navigateur (enregistré sur un autre appareil). Télécharge-le pour l\'écouter.</p>'}
    </div>`;
  }).join('') : '<p class="meta">Aucun enregistrement.</p>';
  box.querySelectorAll('[data-del-au]').forEach(b => {
    b.onclick = async () => { if (confirm('Supprimer cet enregistrement ?')) { await mediaDel(b.dataset.delAu); renderIdeaAudios(ideaId); } };
  });
}

// Dictée : la voix est transcrite en texte (reconnaissance vocale du navigateur, gratuite).
var ideaDictation = null;
function setupIdeaDictation(idea, save) {
  const btn = document.getElementById('idea-dictate-btn');
  const status = document.getElementById('idea-dictate-status');
  const wrap = document.getElementById('idea-dictation');
  const ta = document.getElementById('idea-dictation-text');
  let saveTimer;
  ta.oninput = () => { clearTimeout(saveTimer); saveTimer = setTimeout(async () => { idea.dictation = ta.value; await save(); }, 500); };
  if (!SpeechRecognitionAPI) {
    btn.disabled = true;
    status.textContent = isIOS() ? 'Dictée : utilise plutôt le 🎙️ du clavier de l\'iPhone dans une zone de texte.' : 'Dictée non disponible sur ce navigateur (essaie Chrome).';
    return;
  }
  btn.onclick = () => {
    if (ideaDictation) { ideaDictation.stop(); return; }
    if (ideaRecorder) { status.textContent = 'Arrête d\'abord l\'enregistrement en cours.'; return; }
    const rec = new SpeechRecognitionAPI();
    ideaDictation = rec;
    rec.lang = getAppLangBCP47();
    rec.continuous = true;
    rec.interimResults = true;
    const base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
    let finalText = '';
    wrap.classList.remove('hidden');
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      ta.value = base + finalText + interim;
    };
    rec.onerror = (e) => {
      const messages = { 'not-allowed': micErrorMessage({ name: 'NotAllowedError' }), 'no-speech': 'Aucune voix détectée, réessaie en parlant plus près.', 'network': 'La dictée a besoin d\'une connexion Internet.', 'audio-capture': 'Aucun micro détecté.' };
      status.textContent = messages[e.error] || `Erreur de dictée (${e.error}).`;
    };
    rec.onend = async () => {
      ideaDictation = null;
      btn.textContent = '✍️ Dicter (voix → texte)';
      idea.dictation = (base + finalText).trim();
      ta.value = idea.dictation;
      await save();
      if (!status.textContent.startsWith('Erreur') && idea.dictation) status.textContent = '✅ Texte enregistré.';
    };
    try { rec.start(); } catch (err) { ideaDictation = null; status.textContent = micErrorMessage(err); return; }
    btn.textContent = '⏹️ Arrêter la dictée';
    status.textContent = '🎙️ Je t\'écoute… parle normalement.';
  };
}

async function renderIdeaPhotos(ideaId) {
  const box = document.getElementById('idea-photo-grid');
  if (!box) return;
  const items = (await mediaForIdea(ideaId)).filter(m => m.type === 'photo').sort((a, b) => b.createdAt - a.createdAt);
  box.innerHTML = items.length ? items.map(p => `
    <div style="position:relative;border-radius:10px;overflow:hidden;">
      <img src="${p.data}" data-view-ph="${p.id}" style="width:100%;aspect-ratio:1;object-fit:cover;object-position:center;cursor:pointer;display:block;" />
      <button class="small danger" data-del-ph="${p.id}" style="position:absolute;top:4px;right:4px;padding:2px 7px;">✕</button>
    </div>`).join('') : '<p class="meta">Aucune photo.</p>';
  box.querySelectorAll('[data-view-ph]').forEach(img => {
    img.onclick = () => {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;z-index:9999;';
      ov.innerHTML = `<img src="${img.src}" style="max-width:94vw;max-height:90vh;border-radius:10px;" />`;
      ov.onclick = () => ov.remove();
      document.body.appendChild(ov);
    };
  });
  box.querySelectorAll('[data-del-ph]').forEach(b => {
    b.onclick = async (e) => { e.stopPropagation(); if (confirm('Supprimer cette photo ?')) { await mediaDel(b.dataset.delPh); renderIdeaPhotos(ideaId); } };
  });
}


// --- PÉPITES : idées courtes à lire en 1 minute (façon Deepstash, gratuit) ---
const pepState = { domain: 'all', theme: '', limit: 10 };

function pepiteCardHTML(p, opts = {}) {
  const label = DOMAIN_LABELS[p.domain] || p.domain;
  return `
    <div class="pep-card" data-pep-id="${escapeHtml(p.id)}">
      <div class="pep-top">
        <span class="pep-domain">${escapeHtml(label)}</span>
        ${p.theme ? `<span class="pep-theme">${escapeHtml(p.theme)}</span>` : ''}
        ${p.isNew ? '<span class="pep-new">🆕 Nouveau</span>' : ''}
        ${p.seen ? '<span class="meta">déjà lue</span>' : ''}
        ${p.custom ? '<span class="meta">ma pépite</span>' : ''}
      </div>
      <div class="pep-title">${escapeHtml(p.title)}</div>
      <div class="pep-text">${escapeHtml(p.text)}</div>
      ${p.action ? `<div class="pep-action">👉 ${escapeHtml(p.action)}</div>` : ''}
      <div class="pep-source">${escapeHtml(p.source || '')}</div>
      ${opts.compact ? '' : speakerHTML(`${p.title}. ${p.text} ${p.action ? 'Action : ' + p.action : ''}`)}
      ${opts.compact ? '' : `
      <div class="pep-buttons">
        <button type="button" class="small" data-pep-save="${escapeHtml(p.id)}">${p.saved ? `🔖 ${escapeHtml(p.stash)}` : '🔖 Garder'}</button>
        <button type="button" class="small" data-pep-apply="habit" data-id="${escapeHtml(p.id)}">✅ En habitude</button>
        <button type="button" class="small" data-pep-apply="goal" data-id="${escapeHtml(p.id)}">🎯 En objectif</button>
        <button type="button" class="small" data-pep-share="${escapeHtml(p.id)}">📤 Partager</button>
        ${p.custom ? `<button type="button" class="small danger" data-pep-del="${escapeHtml(p.id)}">Supprimer</button>` : ''}
      </div>`}
    </div>
  `;
}

// Les cartes affichées sont gardées en mémoire pour le partage / la sauvegarde.
const pepCache = {};
function rememberPepites(list) { list.forEach(p => { pepCache[p.id] = p; }); }

function bindPepiteButtons(root, reload) {
  root.querySelectorAll('[data-pep-save]').forEach(btn => {
    btn.onclick = async () => {
      const p = pepCache[btn.dataset.pepSave];
      const stash = prompt('Dans quelle collection ? (ex : Favoris, Couple, Travail)', p?.stash || 'Favoris');
      if (stash === null) return;
      try { await api(`/pepites/${btn.dataset.pepSave}/save`, { method: 'POST', body: { stash } }); showToast('🔖 Pépite gardée — elle reviendra en révision.'); reload(); loadPepiteStats(); }
      catch (e) { showToast(escapeHtml(e.message)); }
    };
  });
  root.querySelectorAll('[data-pep-apply]').forEach(btn => {
    btn.onclick = async () => {
      const p = pepCache[btn.dataset.id];
      const as = btn.dataset.pepApply;
      const title = prompt(as === 'habit' ? 'Nom de la nouvelle habitude :' : 'Nom du nouvel objectif :', p?.action || p?.title || '');
      if (!title) return;
      try { await api(`/pepites/${btn.dataset.id}/apply`, { method: 'POST', body: { as, title } }); showToast(as === 'habit' ? '✅ Habitude créée !' : '🎯 Objectif créé !'); }
      catch (e) { showToast(escapeHtml(e.message)); }
    };
  });
  root.querySelectorAll('[data-pep-share]').forEach(btn => {
    btn.onclick = async () => {
      const p = pepCache[btn.dataset.pepShare];
      if (!p) return;
      const text = `✨ ${p.title}\n\n${p.text}${p.action ? `\n\n👉 ${p.action}` : ''}\n\n— ${p.source || ''}`;
      try {
        if (navigator.share) await navigator.share({ title: p.title, text });
        else { await navigator.clipboard.writeText(text); showToast('📋 Copiée dans le presse-papier.'); }
      } catch (e) { /* partage annulé */ }
    };
  });
  root.querySelectorAll('[data-pep-del]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Supprimer cette pépite ?')) return;
      await api(`/pepites/custom/${btn.dataset.pepDel}`, { method: 'DELETE' });
      reload(); loadPepiteStats();
    };
  });
}

// Marque comme lues les cartes réellement affichées à l'écran.
let pepObserver = null;
function observePepitesSeen(root) {
  if (!('IntersectionObserver' in window)) return;
  if (pepObserver) pepObserver.disconnect();
  pepObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.dataset.pepId;
      pepObserver.unobserve(entry.target);
      setTimeout(() => api(`/pepites/${id}/seen`, { method: 'POST' }).then(loadPepiteStats).catch(() => {}), 1500);
    });
  }, { threshold: 0.6 });
  root.querySelectorAll('.pep-card').forEach(c => pepObserver.observe(c));
}

async function loadDailyPepite() {
  const el = document.getElementById('daily-pepite');
  if (!el) return;
  try {
    const p = await api('/pepites/daily');
    el.innerHTML = `<strong>${escapeHtml(p.title)}</strong><br>${escapeHtml(p.text)}${p.action ? `<br><em>👉 ${escapeHtml(p.action)}</em>` : ''}`;
  } catch (e) { el.textContent = 'Pépite indisponible pour le moment.'; }
}

async function loadPepiteStats() {
  try {
    const st = await api('/pepites/stats');
    document.getElementById('pep-stats').innerHTML = `
      <span>📖 ${st.read} lues${st.readToday ? ` (${st.readToday} aujourd'hui)` : ''}</span>
      <span>🔥 ${st.streak} jour${st.streak > 1 ? 's' : ''} de série</span>
      <span>🔖 ${st.saved} gardées</span>
      <span>🏆 ${st.mastered} maîtrisées</span>`;
    document.getElementById('pep-review-count').textContent = st.dueReview ? `(${st.dueReview})` : '';
  } catch (e) { /* stats non bloquantes */ }
}

function switchPepTab(tab) {
  document.querySelectorAll('.pep-tab').forEach(b => b.classList.toggle('active', b.dataset.pepTab === tab));
  document.querySelectorAll('[data-pep-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.pepPanel !== tab));
  if (tab === 'feed') loadPepiteFeed();
  if (tab === 'review') loadPepiteReview();
  if (tab === 'stashes') loadPepiteStashes();
  if (tab === 'create') loadPepiteCreate();
}
document.querySelectorAll('.pep-tab').forEach(b => { b.onclick = () => switchPepTab(b.dataset.pepTab); });

async function loadPepites() {
  loadPepiteStats();
  const chips = document.getElementById('pep-domain-chips');
  if (!chips.dataset.ready) {
    const domains = await api('/pepites/domains').catch(() => []);
    chips.innerHTML = `<button class="pep-chip active" data-pep-domain="all">Pour moi</button>` +
      domains.filter(d => d.count).map(d => `<button class="pep-chip" data-pep-domain="${d.domain}">${escapeHtml(DOMAIN_LABELS[d.domain] || d.domain)}</button>`).join('');
    chips.querySelectorAll('[data-pep-domain]').forEach(c => {
      c.onclick = () => {
        chips.querySelectorAll('.pep-chip').forEach(x => x.classList.toggle('active', x === c));
        pepState.domain = c.dataset.pepDomain; pepState.limit = 10;
        loadPepiteFeed();
      };
    });
    chips.dataset.ready = '1';

    // Thèmes : un clic filtre, un second clic retire le filtre.
    const themeChips = document.getElementById('pep-theme-chips');
    const themes = await api('/pepites/themes').catch(() => []);
    themeChips.innerHTML = themes.map(t => `<button class="pep-chip theme" data-pep-theme="${escapeHtml(t.theme)}" data-label="${escapeHtml(t.label || t.theme)}">${escapeHtml(t.label || t.theme)} (${t.count})</button>`).join('');
    themeChips.querySelectorAll('[data-pep-theme]').forEach(c => {
      c.onclick = () => {
        const on = pepState.theme !== c.dataset.pepTheme;
        themeChips.querySelectorAll('.pep-chip').forEach(x => x.classList.toggle('active', on && x === c));
        pepState.theme = on ? c.dataset.pepTheme : ''; pepState.themeLabel = c.dataset.label; pepState.limit = 10;
        loadPepiteFeed();
      };
    });
  }
  switchPepTab('feed');
}

async function loadPepiteFeed() {
  const el = document.getElementById('pep-feed');
  try {
    const data = await api(`/pepites/feed?domain=${encodeURIComponent(pepState.domain)}&theme=${encodeURIComponent(pepState.theme)}&limit=${pepState.limit}`);
    rememberPepites(data.items);
    document.getElementById('pep-focus').textContent = data.focusDomains.length
      ? `Mis en avant pour toi : ${data.focusDomains.map(d => DOMAIN_LABELS[d] || d).join(', ')} (domaines peu travaillés ces 14 derniers jours). ${data.unseen} idée(s) jamais lue(s).`
      : `${pepState.theme ? `Thème « ${pepState.themeLabel || pepState.theme} » — ` : ''}${data.unseen} idée(s) jamais lue(s) sur ${data.total}.`;
    el.innerHTML = data.items.map(p => pepiteCardHTML(p)).join('') || '<p class="meta">Aucune pépite ici pour l\'instant.</p>';
    document.getElementById('pep-more').classList.toggle('hidden', data.items.length >= data.total);
    bindPepiteButtons(el, loadPepiteFeed);
    observePepitesSeen(el);
  } catch (e) { el.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`; }
}
document.getElementById('pep-more').onclick = () => { pepState.limit += 10; loadPepiteFeed(); };

async function loadPepiteReview() {
  const el = document.getElementById('pep-review');
  const due = await api('/pepites/review');
  if (!due.length) {
    el.innerHTML = '<p class="meta">Rien à réviser aujourd\'hui 🎉 Garde des pépites pour qu\'elles reviennent ici (J1 → J3 → J7 → J14 → J30).</p>';
    return;
  }
  const p = due[0];
  el.innerHTML = `
    <p class="meta">${due.length} pépite(s) à réviser. Essaie de te rappeler l'idée avant de la révéler.</p>
    <div class="pep-card">
      <div class="pep-top"><span class="pep-domain">${escapeHtml(DOMAIN_LABELS[p.domain] || p.domain)}</span><span class="meta">étape ${p.stage + 1}/5</span></div>
      <div class="pep-title">${escapeHtml(p.title)}</div>
      <div id="pep-review-hidden" class="hidden">
        <div class="pep-text">${escapeHtml(p.text)}</div>
        ${p.action ? `<div class="pep-action">👉 ${escapeHtml(p.action)}</div>` : ''}
        ${p.note ? `<div class="pep-my-note">📝 <em>${escapeHtml(p.note)}</em></div>` : ''}
        <p class="meta">L'as-tu appliquée ou t'en souvenais-tu ?</p>
        <div class="pep-buttons">
          <button type="button" data-pep-rev="1">👍 Je m'en souvenais</button>
          <button type="button" class="secondary" data-pep-rev="0">🔁 À revoir</button>
        </div>
      </div>
      <button type="button" id="pep-reveal">Révéler l'idée</button>
    </div>`;
  document.getElementById('pep-reveal').onclick = (e) => {
    e.target.remove();
    document.getElementById('pep-review-hidden').classList.remove('hidden');
  };
  el.querySelectorAll('[data-pep-rev]').forEach(b => {
    b.onclick = async () => {
      await api(`/pepites/saves/${p.saveId}/review`, { method: 'POST', body: { remembered: b.dataset.pepRev === '1' } });
      loadPepiteStats();
      loadPepiteReview();
    };
  });
}

async function loadPepiteStashes() {
  const el = document.getElementById('pep-stashes');
  const stashes = await api('/pepites/stashes');
  if (!stashes.length) { el.innerHTML = '<p class="meta">Aucune collection. Appuie sur 🔖 Garder sur une pépite pour commencer.</p>'; return; }
  el.innerHTML = stashes.map(s => `
    <div class="card-block">
      <h3>🔖 ${escapeHtml(s.name)} (${s.items.length})</h3>
      ${s.items.map(p => `
        <div class="pep-stash-item">
          ${pepiteCardHTML(p, { compact: true })}
          <textarea class="pep-note" data-pep-note="${escapeHtml(p.saveId)}" placeholder="📝 Ce que j'en retiens, comment je vais l'appliquer…">${escapeHtml(p.note || '')}</textarea>
          <div class="meta">${p.mastered ? '🏆 Maîtrisée' : `Prochaine révision : ${escapeHtml(p.nextReview || '')}`}
            <button type="button" class="small danger" data-pep-unsave="${escapeHtml(p.saveId)}">Retirer</button></div>
        </div>`).join('')}
    </div>`).join('');
  el.querySelectorAll('[data-pep-note]').forEach(ta => {
    let t;
    ta.oninput = () => { clearTimeout(t); t = setTimeout(() => api(`/pepites/saves/${ta.dataset.pepNote}`, { method: 'PATCH', body: { note: ta.value } }).catch(() => {}), 600); };
  });
  el.querySelectorAll('[data-pep-unsave]').forEach(b => {
    b.onclick = async () => { await api(`/pepites/saves/${b.dataset.pepUnsave}`, { method: 'DELETE' }); loadPepiteStashes(); loadPepiteStats(); };
  });
}

async function loadPepiteCreate() {
  const sel = document.getElementById('pep-c-domain');
  if (!sel.options.length) sel.innerHTML = Object.entries(DOMAIN_LABELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  const bookSel = document.getElementById('pep-book-select');
  const books = await api('/library/books').catch(() => []);
  bookSel.innerHTML = '<option value="">Choisis un livre...</option>' + books.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.title)}</option>`).join('');
  if (!books.length) document.getElementById('pep-book-drafts').innerHTML = '<p class="meta">Ajoute d\'abord un livre dans 📚 Bibliothèque.</p>';
}

document.getElementById('pep-create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/pepites/custom', { method: 'POST', body: {
      title: document.getElementById('pep-c-title').value,
      text: document.getElementById('pep-c-text').value,
      source: document.getElementById('pep-c-source').value,
      action: document.getElementById('pep-c-action').value,
      domain: document.getElementById('pep-c-domain').value
    } });
    e.target.reset();
    showToast('✨ Pépite enregistrée — elle apparaît dans ton fil.');
    loadPepiteStats();
  } catch (err) { showToast(escapeHtml(err.message)); }
});

document.getElementById('pep-book-select').addEventListener('change', async (e) => {
  const out = document.getElementById('pep-book-drafts');
  if (!e.target.value) { out.innerHTML = ''; return; }
  out.innerHTML = '<p class="meta">Extraction...</p>';
  try {
    const drafts = await api(`/pepites/from-library/${e.target.value}`);
    out.innerHTML = '<p class="meta">Phrases clés repérées automatiquement (résumé statistique). Relis, reformule avec tes mots, puis garde celles qui te parlent.</p>' +
      (drafts.map((d, i) => `
        <div class="pep-card">
          <input type="text" value="${escapeHtml(d.title)}" data-draft-title="${i}" />
          <textarea data-draft-text="${i}">${escapeHtml(d.text)}</textarea>
          <button type="button" class="small" data-draft-save="${i}" data-source="${escapeHtml(d.source)}">✨ En faire une pépite</button>
        </div>`).join('') || '<p class="meta">Texte trop court pour extraire des idées.</p>');
    out.querySelectorAll('[data-draft-save]').forEach(b => {
      b.onclick = async () => {
        const i = b.dataset.draftSave;
        await api('/pepites/custom', { method: 'POST', body: {
          title: out.querySelector(`[data-draft-title="${i}"]`).value,
          text: out.querySelector(`[data-draft-text="${i}"]`).value,
          source: b.dataset.source
        } });
        b.textContent = '✔ Enregistrée'; b.disabled = true;
        loadPepiteStats();
      };
    });
  } catch (err) { out.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`; }
});


// --- NOTIFICATIONS : cloche dans l'app + notifications push sur l'appareil ---
const notifPanel = document.getElementById('notif-panel');
let notifData = null;
const NOTIF_SEEN_KEY = 'bm_notif_seen';

function notifSeenToday() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTIF_SEEN_KEY) || '{}');
    return saved.date === new Date().toISOString().slice(0, 10) ? saved.kinds || [] : [];
  } catch (e) { return []; }
}
function markNotifsSeen() {
  try { localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10), kinds: (notifData?.items || []).map(i => i.kind) })); } catch (e) { /* stockage indisponible */ }
  renderNotifBadge();
}
function renderNotifBadge() {
  const badge = document.getElementById('notif-badge');
  const seen = notifSeenToday();
  const unseen = (notifData?.items || []).filter(i => !seen.includes(i.kind)).length;
  badge.textContent = unseen;
  badge.classList.toggle('hidden', unseen === 0);
}

async function loadNotifications() {
  try { notifData = await api('/notifications'); } catch (e) { return; }
  renderNotifBadge();
  const list = document.getElementById('notif-list');
  list.innerHTML = notifData.items.length
    ? notifData.items.map(i => `
        <button type="button" class="notif-item" data-notif-view="${escapeHtml(i.view)}">
          <span class="notif-icon">${i.icon}</span>
          <span><strong>${escapeHtml(i.title)}</strong><span class="notif-body">${escapeHtml(i.body)}</span></span>
        </button>`).join('')
    : '<p class="meta">Rien pour le moment 🎉 Active d\'autres rappels dans les réglages.</p>';
  list.querySelectorAll('[data-notif-view]').forEach(b => {
    b.onclick = () => { notifPanel.classList.add('hidden'); switchView(b.dataset.notifView); };
  });
}

document.getElementById('notif-btn').onclick = (e) => {
  e.stopPropagation();
  profileDropdown.classList.add('hidden');
  const opening = notifPanel.classList.contains('hidden');
  notifPanel.classList.toggle('hidden');
  if (opening) { loadNotifications().then(markNotifsSeen); }
};
document.addEventListener('click', (e) => {
  if (!notifPanel.classList.contains('hidden') && !e.target.closest('.notif-wrap')) notifPanel.classList.add('hidden');
});
document.getElementById('notif-settings-link').onclick = () => {
  notifPanel.classList.add('hidden');
  switchView('account');
  setTimeout(() => document.getElementById('notif-card').scrollIntoView({ behavior: 'smooth' }), 80);
};

// Le service worker demande d'ouvrir une section quand on touche une notification.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'open-view' && document.getElementById('view-' + e.data.view)) switchView(e.data.view);
  });
}

// --- Réglages des notifications (onglet Compte) ---
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function renderNotifSettings() {
  if (!notifData) { await loadNotifications(); if (!notifData) return; }
  const { prefs, types } = notifData;
  const box = document.getElementById('notif-types');
  box.innerHTML = Object.entries(types).map(([key, label]) => `
    <label class="notif-type"><input type="checkbox" data-notif-type="${key}" ${prefs.types[key] ? 'checked' : ''} /> ${escapeHtml(label)}</label>`).join('');
  document.getElementById('notif-time').value = prefs.time;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('notif-tz').textContent = `Fuseau horaire : ${tz}`;
  const save = async (silent) => {
    const body = { time: document.getElementById('notif-time').value, tz, types: {} };
    box.querySelectorAll('[data-notif-type]').forEach(c => { body.types[c.dataset.notifType] = c.checked; });
    try {
      notifData.prefs = await api('/notifications/prefs', { method: 'PUT', body });
      if (silent !== true) { showToast('🔔 Préférences enregistrées'); loadNotifications(); }
    } catch (err) { showToast(escapeHtml(err.message)); }
  };
  box.querySelectorAll('[data-notif-type]').forEach(c => { c.onchange = save; });
  document.getElementById('notif-time').onchange = save;
  // Le fuseau de l'appareil sert à envoyer le rappel à la bonne heure locale.
  if (prefs.tz !== tz) save(true);
  renderPushState();
}

async function renderPushState() {
  const status = document.getElementById('notif-push-status');
  const btn = document.getElementById('notif-push-btn');
  const test = document.getElementById('notif-test-btn');
  const help = document.getElementById('notif-push-help');
  help.textContent = '';
  if (!pushSupported()) {
    btn.disabled = true; test.disabled = true;
    status.textContent = '— non disponible sur ce navigateur';
    help.textContent = isIOS() && !isStandalone()
      ? 'Sur iPhone : touche le bouton Partager ⬆️ puis « Sur l\'écran d\'accueil », ouvre l\'app depuis l\'icône, puis reviens ici (iOS 16.4 ou plus).'
      : 'Essaie avec Chrome, Edge, Firefox ou Safari récent. La cloche 🔔 en haut fonctionne partout.';
    return;
  }
  const sub = await currentPushSubscription();
  const denied = Notification.permission === 'denied';
  btn.disabled = denied;
  test.disabled = !sub;
  btn.textContent = sub ? '🔕 Désactiver sur cet appareil' : '📲 Activer les notifications';
  status.textContent = denied ? '— bloquées' : sub ? '— activées ✅' : '— désactivées';
  if (denied) help.textContent = 'Les notifications sont bloquées pour ce site : autorise-les dans les réglages du navigateur (icône 🔒 à côté de l\'adresse), puis recharge la page.';
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

document.getElementById('notif-push-btn').onclick = async () => {
  const btn = document.getElementById('notif-push-btn');
  btn.disabled = true;
  try {
    const existing = await currentPushSubscription();
    if (existing) {
      await api('/notifications/unsubscribe', { method: 'POST', body: { endpoint: existing.endpoint } });
      await existing.unsubscribe();
      showToast('🔕 Notifications désactivées sur cet appareil');
    } else {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { showToast('Notifications non autorisées.'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(notifData.push.publicKey) });
      await api('/notifications/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      showToast('📲 Notifications activées !');
    }
  } catch (err) {
    showToast(escapeHtml(err.message || 'Impossible d\'activer les notifications.'));
  } finally {
    btn.disabled = false;
    renderPushState();
  }
};

document.getElementById('notif-test-btn').onclick = async () => {
  try { const r = await api('/notifications/test', { method: 'POST' }); showToast(r.sent ? '🔔 Notification de test envoyée' : 'Envoi impossible, réactive les notifications.'); }
  catch (err) { showToast(escapeHtml(err.message)); }
};


// --- Plans de lecture ---
async function loadBiblePlans() {
  const box = document.getElementById('bible-plans');
  let data;
  try { data = await api('/bible/plans'); } catch (e) { box.innerHTML = `<p class="error">${escapeHtml(e.message)}</p>`; return; }
  const mineKeys = new Set(data.mine.map(p => p.planKey));
  box.innerHTML = `
    ${data.mine.map(p => `
      <div class="plan-item">
        <div class="plan-head"><strong>${escapeHtml(p.label)}</strong><span class="meta">${p.doneCount}/${p.days} jours · ${p.percent} %</span></div>
        <span class="mem-progress plan-progress"><span style="width:${p.percent}%"></span></span>
        ${p.finished ? '<p>🏆 Plan terminé, bravo !</p>' : `
          <p class="plan-today">📖 Jour ${p.next.day + 1} : <strong>${escapeHtml(p.next.label)}</strong></p>
          ${p.late > 1 ? `<p class="meta">Tu as ${p.late - 1} jour(s) de retard : pas de souci, continue simplement où tu en es.</p>` : ''}
          <div class="quiz-actions">
            <button type="button" class="small" data-plan-read="${p.next.first.book}:${p.next.first.chapter}">📖 Lire</button>
            <button type="button" data-plan-done="${p.id}:${p.next.day}">✅ Marquer comme lu</button>
          </div>`}
        <button type="button" class="link-btn plan-stop" data-plan-stop="${p.id}">Arrêter ce plan</button>
      </div>`).join('')}
    <details class="plan-catalog" ${data.mine.length ? '' : 'open'}>
      <summary>${data.mine.length ? '➕ Commencer un autre plan' : 'Choisis un plan pour lire la Bible chaque jour :'}</summary>
      ${data.catalog.filter(c => !mineKeys.has(c.key)).map(c => `
        <div class="plan-choice">
          <span><strong>${escapeHtml(c.label)}</strong><span class="meta"> · ${c.chapters} chapitres, ~${Math.max(1, Math.round(c.chapters / c.days))} par jour</span></span>
          <button type="button" class="small" data-plan-start="${c.key}">Commencer</button>
        </div>`).join('') || '<p class="meta">Tu suis déjà tous les plans.</p>'}
    </details>`;
  box.querySelectorAll('[data-plan-start]').forEach(b => {
    b.onclick = async () => { await api('/bible/plans', { method: 'POST', body: { planKey: b.dataset.planStart } }); showToast('📅 Plan commencé !'); loadBiblePlans(); };
  });
  box.querySelectorAll('[data-plan-read]').forEach(b => {
    b.onclick = () => {
      const [book, chapter] = b.dataset.planRead.split(':').map(Number);
      const name = bibleBooks?.[book]?.name;
      if (name) runBibleLookup(`${name} ${chapter}`, true);
      else initBibleFinder().then(() => runBibleLookup(`${bibleBooks[book].name} ${chapter}`, true));
    };
  });
  box.querySelectorAll('[data-plan-done]').forEach(b => {
    b.onclick = async () => {
      const [id, day] = b.dataset.planDone.split(':');
      await api(`/bible/plans/${id}/days/${day}`, { method: 'POST', body: { done: true } });
      showToast('✅ Lecture du jour faite !');
      loadBiblePlans();
    };
  });
  box.querySelectorAll('[data-plan-stop]').forEach(b => {
    b.onclick = async () => { if (!confirm('Arrêter ce plan ? Ta progression sera effacée.')) return; await api(`/bible/plans/${b.dataset.planStop}`, { method: 'DELETE' }); loadBiblePlans(); };
  });
}

// --- Versets favoris avec note personnelle ---
var bibleFavorites = [];
var bibleFavRefs = new Set();
async function loadBibleFavorites() {
  const box = document.getElementById('bible-favorites');
  try { bibleFavorites = await api('/bible/favorites'); } catch (e) { return; }
  bibleFavRefs = new Set(bibleFavorites.map(f => f.ref));
  box.innerHTML = bibleFavorites.length ? bibleFavorites.map(f => `
    <div class="fav-item">
      <div class="bible-verse-text">${escapeHtml(f.text)}</div>
      <div class="bible-verse-meta">
        <span class="verse-ref">${escapeHtml(f.ref)}</span>
        <button type="button" class="small" data-add-mem="${escapeHtml(f.ref)}">➕ Mémoriser</button>
        <button type="button" class="small" data-read-ref="${escapeHtml(f.ref)}">📖 Chapitre</button>
        <button type="button" class="small danger" data-fav-del="${f.id}">✕</button>
      </div>
      <textarea class="fav-note" data-fav-note="${f.id}" placeholder="📝 Ce que ce verset me dit…">${escapeHtml(f.note || '')}</textarea>
    </div>`).join('')
    : '<p class="meta">Aucun favori. Touche « ☆ Favori » sur un verset trouvé dans la recherche ou le lecteur.</p>';
  bindAddMemButtons(box);
  box.querySelectorAll('[data-fav-del]').forEach(b => {
    b.onclick = async () => { await api(`/bible/favorites/${b.dataset.favDel}`, { method: 'DELETE' }); loadBibleFavorites(); };
  });
  box.querySelectorAll('[data-fav-note]').forEach(ta => {
    let t;
    ta.oninput = () => { clearTimeout(t); t = setTimeout(() => api(`/bible/favorites/${ta.dataset.favNote}`, { method: 'PATCH', body: { note: ta.value } }).catch(() => {}), 600); };
  });
}


// --- Pépites en mode lecture : une carte plein écran à la fois (comme des « stories ») ---
var pepStory = { items: [], index: 0 };
async function openPepStory() {
  let data;
  try { data = await api(`/pepites/feed?domain=${encodeURIComponent(pepState.domain)}&theme=${encodeURIComponent(pepState.theme)}&limit=30`); }
  catch (e) { showToast(escapeHtml(e.message)); return; }
  if (!data.items.length) { showToast('Aucune pépite à afficher.'); return; }
  rememberPepites(data.items);
  pepStory = { items: data.items, index: 0 };
  document.getElementById('pep-story').classList.remove('hidden');
  document.body.classList.add('no-scroll');
  renderPepStory();
}
function closePepStory() {
  document.getElementById('pep-story').classList.add('hidden');
  document.body.classList.remove('no-scroll');
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  loadPepiteStats();
  if (!document.getElementById('view-pepites').classList.contains('hidden')) loadPepiteFeed();
}
function renderPepStory() {
  const { items, index } = pepStory;
  const p = items[index];
  document.getElementById('pep-story-bar').innerHTML = items.map((_, i) => `<span class="${i < index ? 'done' : i === index ? 'now' : ''}"></span>`).join('');
  document.getElementById('pep-story-card').innerHTML = `
    <div class="pep-top">
      <span class="pep-domain">${escapeHtml(DOMAIN_LABELS[p.domain] || p.domain)}</span>
      ${p.theme ? `<span class="pep-theme">${escapeHtml(p.theme)}</span>` : ''}
      <span class="meta">${index + 1} / ${items.length}</span>
    </div>
    <div class="pep-title">${escapeHtml(p.title)}</div>
    <div class="pep-text">${escapeHtml(p.text)}</div>
    ${p.action ? `<div class="pep-action">👉 ${escapeHtml(p.action)}</div>` : ''}
    <div class="pep-source">${escapeHtml(p.source || '')}</div>
    ${speakerHTML(`${p.title}. ${p.text} ${p.action ? 'Action : ' + p.action : ''}`)}`;
  document.getElementById('pep-story-prev').disabled = index === 0;
  document.getElementById('pep-story-next').textContent = index === items.length - 1 ? 'Terminer ✓' : 'Suivante ▶';
  document.getElementById('pep-story-save').textContent = pepCache[p.id]?.saved ? `🔖 ${pepCache[p.id].stash}` : '🔖 Garder';
  api(`/pepites/${p.id}/seen`, { method: 'POST' }).catch(() => {});
}
function pepStoryGo(delta) {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  const next = pepStory.index + delta;
  if (next >= pepStory.items.length) { closePepStory(); showToast(`✨ ${pepStory.items.length} pépites lues, bravo !`); return; }
  if (next < 0) return;
  pepStory.index = next;
  renderPepStory();
}
document.getElementById('pep-story-btn').onclick = openPepStory;
document.getElementById('pep-story-close').onclick = closePepStory;
document.getElementById('pep-story-next').onclick = () => pepStoryGo(1);
document.getElementById('pep-story-prev').onclick = () => pepStoryGo(-1);
document.getElementById('pep-story-save').onclick = async () => {
  const p = pepStory.items[pepStory.index];
  const stash = prompt('Dans quelle collection ? (ex : Favoris, Couple, Travail)', pepCache[p.id]?.stash || 'Favoris');
  if (stash === null) return;
  try {
    const save = await api(`/pepites/${p.id}/save`, { method: 'POST', body: { stash } });
    pepCache[p.id] = { ...p, saved: true, stash: save.stash, saveId: save.id };
    renderPepStory();
    showToast('🔖 Pépite gardée');
  } catch (e) { showToast(escapeHtml(e.message)); }
};
// Glisser vers la gauche/droite pour changer de pépite ; flèches et Échap au clavier.
(function () {
  const el = document.getElementById('pep-story');
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) pepStoryGo(dx < 0 ? 1 : -1);
    x0 = null;
  });
  document.addEventListener('keydown', (e) => {
    if (el.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') pepStoryGo(1);
    if (e.key === 'ArrowLeft') pepStoryGo(-1);
    if (e.key === 'Escape') closePepStory();
  });
})();
