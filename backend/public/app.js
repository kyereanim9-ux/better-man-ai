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
  if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
  return data;
}

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

function showMain() {
  authScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  document.getElementById('bottom-nav').classList.remove('hidden');

  const first = state.user.name.trim().split(' ')[0] || state.user.name;
  document.getElementById('greeting-text').textContent = `Bonjour ${first} 👋`;
  document.getElementById('greeting-quote').textContent = pickDailyQuote();
  document.getElementById('avatar-btn').textContent = state.user.name.trim().slice(0, 1).toUpperCase() || '?';
  document.getElementById('pd-name').textContent = state.user.name;
  document.getElementById('pd-role').textContent = state.user.role === 'admin' ? 'Administrateur' : 'Membre';
  document.getElementById('pd-admin').classList.toggle('hidden', state.user.role !== 'admin');
  document.getElementById('nav-admin').classList.toggle('hidden', state.user.role !== 'admin');

  switchView('daily');
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
  if (view === 'intimacy') loadIntimacy();
  if (view === 'progress') loadProgress();
  if (view === 'situation') loadSituation();
  if (view === 'communication') { /* rien à précharger */ }
  if (view === 'finance') loadFinance();
  if (view === 'physique') loadPhysique();
  if (view === 'style') loadStyle();
  if (view === 'adaptation') { /* chargé au clic sur "Analyser" */ }
  if (view === 'domains') loadDomains();
  if (view === 'profile-setup') loadOnboarding();
  if (view === 'whats-new') loadWhatsNew();
  if (view === 'account') loadAccount();
  if (view === 'admin') loadAdmin();
}

// --- CATÉGORIES (accueil) ---
const CATEGORIES = {
  'cat-moi': [
    { view: 'profile-setup', icon: '👤', name: 'Profil', desc: 'Ce que tu es, ce que tu vises' },
    { view: 'journal', icon: '📔', name: 'Journal', desc: 'Écris librement' },
    { view: 'goals', icon: '🎯', name: 'Objectifs', desc: 'Ce que tu veux atteindre' },
    { view: 'habits', icon: '✅', name: 'Habitudes', desc: 'Ce que tu répètes chaque jour' },
    { view: 'progress', icon: '📈', name: 'Progression', desc: 'Ton évolution dans le temps' }
  ],
  'cat-coaching': [
    { view: 'coach', icon: '🤖', name: 'Coach IA', desc: 'Réfléchis avant d\'agir' },
    { view: 'situation', icon: '🆘', name: 'Situation', desc: 'Analyse un moment précis' },
    { view: 'communication', icon: '💬', name: 'Communication', desc: 'Mieux te faire comprendre' },
    { view: 'adaptation', icon: '⚙️', name: 'Adaptation', desc: 'Ajuste ton rythme' },
    { view: 'domains', icon: '🧠', name: 'Domaines', desc: 'Vue d\'ensemble de ta vie' }
  ],
  'cat-apprendre': [
    { view: 'bible', icon: '📖', name: 'Bible', desc: 'Lire, mémoriser, appliquer' },
    { view: 'library', icon: '📚', name: 'Bibliothèque', desc: 'Tes livres et lectures' },
    { view: 'teach', icon: '🎓', name: 'Teach Me', desc: 'Apprends un sujet en 5 niveaux' },
    { view: 'videos', icon: '🎬', name: 'Vidéos', desc: 'Résumés de tes vidéos' },
    { view: 'search', icon: '🌐', name: 'Recherche', desc: 'Chercher sur le web' }
  ],
  'cat-corps': [
    { view: 'physique', icon: '💪', name: 'Physique', desc: 'Construis un corps plus fort' },
    { view: 'style', icon: '👔', name: 'Style', desc: 'Présentation et image' },
    { view: 'intimacy', icon: '🔞', name: 'Intimité', desc: 'Réservé aux adultes' }
  ],
  'cat-vie': [
    { view: 'finance', icon: '💰', name: 'Finance', desc: 'Dépenses et épargne' }
  ]
};
function renderCategories(domainScores) {
  const DOMAIN_MAP = { physique: 'physique', finance: 'financier', bible: 'spirituel', communication: 'communication', intimacy: 'intime' };
  for (const [gridId, items] of Object.entries(CATEGORIES)) {
    const el = document.getElementById(gridId);
    if (!el) continue;
    el.innerHTML = items.map(it => {
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
      <div>${escapeHtml(m.content)}</div>
      ${m.role === 'assistant' ? speakerHTML(m.content) : ''}
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

document.getElementById('message-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content) return;
  if (!state.currentConversationId) {
    const conv = await api('/chat/conversations', { method: 'POST', body: { title: content.slice(0, 30) } });
    state.currentConversationId = conv.id;
    await loadConversations();
  }
  input.value = '';
  const data = await api(`/chat/conversations/${state.currentConversationId}/messages`, {
    method: 'POST', body: { content }
  });
  const conv = await api(`/chat/conversations/${state.currentConversationId}`);
  renderMessages(conv.messages);
});

// --- JOURNAL ---
async function loadJournal() {
  const entries = await api('/journal');
  const el = document.getElementById('journal-list');
  el.innerHTML = entries.map(e => `
    <div class="card">
      <div>
        <div>${escapeHtml(e.content)}</div>
        <div class="meta">${new Date(e.createdAt).toLocaleString('fr-FR')}</div>
        ${speakerHTML(e.content)}
      </div>
      <button class="small danger" data-id="${e.id}">Supprimer</button>
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

// --- LECTEUR VOCAL (Web Speech API, gratuit, intégré au navigateur) ---
let speakerIdCounter = 0;
const SPEAKER_TEXTS = {};
const SPEECH_SUPPORTED = 'speechSynthesis' in window;

// Liste des voix disponibles sur ce navigateur/OS (varie selon l'appareil).
// Chargée de façon asynchrone par certains navigateurs (Chrome), d'où l'écoute
// de l'événement 'voiceschanged'. On privilégie les voix françaises en tête de liste.
let AVAILABLE_VOICES = [];
function refreshVoices() {
  if (!SPEECH_SUPPORTED) return;
  const voices = window.speechSynthesis.getVoices();
  AVAILABLE_VOICES = voices.sort((a, b) => {
    const aFr = a.lang.startsWith('fr') ? 0 : 1;
    const bFr = b.lang.startsWith('fr') ? 0 : 1;
    return aFr - bFr;
  });
}
if (SPEECH_SUPPORTED) {
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
  if (!SPEECH_SUPPORTED) return '<div class="speaker meta">(lecture audio non supportée par ce navigateur)</div>';
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
  utter.lang = 'fr-FR';
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

// --- BIBLE ---
async function loadBible() {
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

  loadMemorization();
}

function renderVerseBlock(verse) {
  return `
    <div>${escapeHtml(verse.text)}</div>
    <div class="verse-ref">${escapeHtml(verse.ref)}</div>
    ${speakerHTML(verse.text)}
    <button class="small" data-add-mem="${escapeHtml(verse.ref)}">➕ Ajouter à la mémorisation</button>
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
        alert(err.message);
      }
    };
  });
}

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

document.getElementById('bible-quiz-btn').onclick = async () => {
  const quiz = await api('/bible/quiz');
  const el = document.getElementById('bible-quiz-result');
  el.innerHTML = `
    <p>${escapeHtml(quiz.prompt)}</p>
    <p class="meta">${quiz.answerLength} lettres — référence : ${escapeHtml(quiz.ref)}</p>
  `;
};

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
            <span>${escapeHtml(m.ref)} <span class="meta">— ${escapeHtml(m.stageLabel)}</span></span>
            <div>
              ${showAdvance ? `<button class="small" data-advance="${m.id}">Valider cette étape</button>` : ''}
              <button class="small danger" data-del-mem="${m.id}">Supprimer</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  el.innerHTML =
    renderGroup('À réviser aujourd\'hui', data.due, true) +
    renderGroup('En cours', data.inProgress, false) +
    renderGroup('Maîtrisés', data.mastered, false) ||
    '<p class="meta">Aucun verset en mémorisation. Ajoute-en un depuis le verset du jour ou une recherche.</p>';

  el.querySelectorAll('[data-advance]').forEach(btn => {
    btn.onclick = async () => { await api(`/bible/memorization/${btn.dataset.advance}/advance`, { method: 'POST' }); loadMemorization(); };
  });
  el.querySelectorAll('[data-del-mem]').forEach(btn => {
    btn.onclick = async () => { await api(`/bible/memorization/${btn.dataset.delMem}`, { method: 'DELETE' }); loadMemorization(); };
  });
}

// --- PROGRESSION ---
async function loadProgress() {
  const [review, monthly, trends, summary] = await Promise.all([
    api('/progress/weekly-review'),
    api('/progress/monthly-review'),
    api('/progress/trends'),
    api('/progress/summary')
  ]);

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
  const [summary, txs, savings] = await Promise.all([
    api('/finance/summary'), api('/finance/transactions'), api('/finance/savings-goals')
  ]);

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

// --- DOMAINES ---
const DOMAIN_LABELS = {
  emotionnel: 'Émotionnel', relationnel: 'Relationnel', physique: 'Physique', mental: 'Mental',
  financier: 'Financier', professionnel: 'Professionnel', social: 'Social', communication: 'Communication',
  discipline: 'Discipline', intime: 'Intimité', spirituel: 'Spirituel'
};

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
async function loadAccount() {
  renderLockControls();

  try {
    const me = await api('/users/me');
    document.getElementById('account-name-input').value = me.name;
  } catch { /* si indisponible, le champ reste vide, pas bloquant */ }

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
  if (!SPEECH_SUPPORTED) { statusEl.textContent = 'Lecture audio non supportée par ce navigateur.'; return; }
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
      <span>${escapeHtml(v.title)} ${v.hasTranscript ? '📝' : ''} <span class="meta">${escapeHtml(v.url)}</span></span>
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

async function openVideo(id) {
  const video = await api(`/videos/${id}`);
  const studyPack = video.transcript ? await api(`/videos/${id}/study-pack`).catch(() => null) : null;
  const block = document.getElementById('video-detail-block');
  block.classList.remove('hidden');
  document.getElementById('video-detail').innerHTML = `
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

// --- INTIMITÉ 18+ ---
async function loadIntimacy() {
  const access = await api('/intimacy/access');
  document.getElementById('intimacy-gate').classList.toggle('hidden', access.confirmed);
  document.getElementById('intimacy-content').classList.toggle('hidden', !access.confirmed);
  if (access.confirmed) {
    loadIntimacyTopics();
    loadIntimacyJournal();
  }
}

document.getElementById('intimacy-confirm-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const ageConfirmed = document.getElementById('intimacy-age-check').checked;
  const consentConfirmed = document.getElementById('intimacy-consent-check').checked;
  if (!ageConfirmed || !consentConfirmed) return;
  try {
    await api('/intimacy/confirm-access', { method: 'POST', body: { ageConfirmed, consentConfirmed } });
    loadIntimacy();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('intimacy-revoke-btn').onclick = async () => {
  await api('/intimacy/revoke-access', { method: 'POST' });
  loadIntimacy();
};

async function loadIntimacyTopics() {
  const topics = await api('/intimacy/topics');
  const el = document.getElementById('intimacy-topics');
  el.innerHTML = topics.map(t => `
    <div class="card-block">
      <h4>${escapeHtml(t.title)}</h4>
      <p>${escapeHtml(t.body)}</p>
      <ul>${t.reflectionQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>
      ${speakerHTML(t.body)}
    </div>
  `).join('');
}

document.querySelectorAll('[data-intimacy-tone]').forEach(btn => {
  btn.onclick = async () => {
    const data = await api('/intimacy/message-suggestions', { method: 'POST', body: { tone: btn.dataset.intimacyTone } });
    document.getElementById('intimacy-message-result').innerHTML = `
      <div class="card">${escapeHtml(data.suggestion)}</div>
      <p class="meta">${escapeHtml(data.note)}</p>
    `;
  };
});

document.getElementById('intimacy-journal-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('intimacy-journal-input');
  if (!input.value.trim()) return;
  await api('/intimacy/journal', { method: 'POST', body: { content: input.value } });
  input.value = '';
  loadIntimacyJournal();
});

async function loadIntimacyJournal() {
  const entries = await api('/intimacy/journal');
  const el = document.getElementById('intimacy-journal-list');
  el.innerHTML = entries.length ? entries.map(e => `
    <div class="card">
      <div>
        <div>${escapeHtml(e.content)}</div>
        <div class="meta">${new Date(e.createdAt).toLocaleString('fr-FR')}</div>
      </div>
      <button class="small danger" data-del-intj="${e.id}">Supprimer</button>
    </div>
  `).join('') : '<p class="meta">Aucune entrée pour l\'instant.</p>';

  el.querySelectorAll('[data-del-intj]').forEach(btn => {
    btn.onclick = async () => { await api(`/intimacy/journal/${btn.dataset.delIntj}`, { method: 'DELETE' }); loadIntimacyJournal(); };
  });
}

// --- PHYSIQUE ---
async function loadPhysique() {
  const [summary, measurements, workouts, goals] = await Promise.all([
    api('/physique/summary'), api('/physique/measurements'), api('/physique/workouts'), api('/physique/goals')
  ]);

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
  const [checklist, overview, entries] = await Promise.all([
    api('/style/checklist'), api('/style/overview'), api('/style/entries')
  ]);
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

// --- Init ---
checkAppLock();
if (state.token && state.user) showMain();
