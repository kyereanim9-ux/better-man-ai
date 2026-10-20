// --- JEUX BIBLIQUES ---
// Les jeux sont générés à partir du texte choisi (toute la Bible, un livre, un
// chapitre, des versets, mes versets ou une liste de révision) et des
// questions préparées du serveur (/api/games/content). Tout le hasard passe
// par game.rng : dans un défi, la même graine donne la même partie à tous.
const game = {
  cfg: { source: 'bible' }, pool: null, content: null, books: null, studySets: null,
  rng: Math.random, challenge: null, session: null, timers: []
};

const GAME_LIST = [
  { key: 'order', cat: 'Écritures', icon: '🧩', name: 'Remettre dans l\'ordre', desc: 'Reconstitue le verset mot par mot' },
  { key: 'blanks', cat: 'Écritures', icon: '🧠', name: 'Versets à trous', desc: 'Retrouve les mots qui manquent' },
  { key: 'reference', cat: 'Écritures', icon: '📍', name: 'Trouver la référence', desc: 'Quel livre, quel chapitre, quel verset ?' },
  { key: 'memory', cat: 'Écritures', icon: '🃏', name: 'Memory', desc: 'Associe chaque référence à son verset' },
  { key: 'hangman', cat: 'Lettres', icon: '🔤', name: 'Le pendu', desc: 'Devine le mot caché lettre par lettre' },
  { key: 'wordsearch', cat: 'Lettres', icon: '🔎', name: 'Mots cachés', desc: 'Retrouve les mots dans la grille' },
  { key: 'anagram', cat: 'Lettres', icon: '🔀', name: 'Anagrammes', desc: 'Remets les lettres dans l\'ordre' },
  { key: 'truefalse', cat: 'Quiz', icon: '✅', name: 'Vrai ou faux', desc: 'Le verset est-il exact ?' },
  { key: 'trivia', cat: 'Quiz', icon: '❓', name: 'Quiz biblique', desc: 'Questions sur les histoires de la Bible' },
  { key: 'quotes', cat: 'Quiz', icon: '💬', name: 'Qui a dit ?', desc: 'Retrouve qui a prononcé ces paroles' },
  { key: 'riddles', cat: 'Quiz', icon: '🕵️', name: 'Qui suis-je ?', desc: 'Devine le personnage avec les indices' },
  { key: 'adventure', cat: 'Enfants', icon: '🗺️', name: 'L\'aventure de la Bible', desc: 'Un parcours d\'étapes faciles, avec des étoiles' }
];
// Jeux qui utilisent le texte choisi (les autres utilisent les questions préparées).
const TEXT_GAMES = new Set(['order', 'blanks', 'reference', 'memory', 'hangman', 'wordsearch', 'anagram', 'truefalse']);
const GAME_STOP = new Set(['les', 'des', 'une', 'que', 'qui', 'est', 'pas', 'par', 'pour', 'dans', 'avec', 'sur', 'son', 'ses', 'mais', 'vous', 'nous', 'ils', 'elle', 'elles', 'leur', 'leurs', 'tout', 'tous', 'toute', 'cette', 'celui', 'ceux', 'comme', 'point', 'aussi', 'ainsi', 'sont', 'votre', 'notre', 'car', 'lui', 'moi', 'toi', 'été', 'fut', 'était', 'afin', 'quand', 'dont', 'alors', 'donc']);

function seededRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gRand = (n) => Math.floor(game.rng() * n);
const gPick = (list) => list[gRand(list.length)];
function gShuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = gRand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const gNorm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
// Mot « jouable » : sans ponctuation ni article élidé (l’, d’, qu’…).
const gClean = (w) => String(w).replace(/^[«(“"]+|[»)”".,;:!?]+$/g, '').replace(/^(?:[a-zA-ZÀ-ÿ]{1,2}|qu|jusqu|lorsqu|puisqu)[’']/i, '');
function gKeywords(text, min = 4, max = 10) {
  const seen = new Set();
  return text.split(/\s+/).map(gClean).filter(w => {
    const n = gNorm(w);
    if (n.length < min || n.length > max || /[-\d]/.test(w) || GAME_STOP.has(w.toLowerCase()) || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}
function gClearTimers() { game.timers.forEach(clearTimeout); game.timers = []; }
function gLater(fn, ms) { game.timers.push(setTimeout(fn, ms)); }

// --- Écran d'accueil des jeux ---
async function loadGames() {
  gClearTimers();
  document.getElementById('games-home').classList.remove('hidden');
  document.getElementById('game-area').classList.add('hidden');
  if (!game.books) {
    try {
      [game.books, game.content] = await Promise.all([api('/bible/books'), api('/games/content')]);
    } catch (err) { showToast(escapeHtml(err.message)); return; }
    const sel = document.getElementById('games-book');
    sel.innerHTML = game.books.map(b => `<option value="${b.index}">${escapeHtml(b.name)}</option>`).join('');
    sel.value = '42';
  }
  try {
    game.studySets = await api('/study');
    document.getElementById('games-study').innerHTML = game.studySets.map(s => `<option value="${s.id}">${escapeHtml(s.title)}</option>`).join('');
  } catch { game.studySets = []; }
  updateGamesSourceFields();
  renderGamesGrid();
  loadGameChallenges();
}

function updateGamesSourceFields() {
  const src = document.getElementById('games-source').value;
  const book = game.books?.[Number(document.getElementById('games-book').value)];
  document.getElementById('games-book-row').classList.toggle('hidden', !['book', 'chapter'].includes(src));
  document.getElementById('games-chapter-row').classList.toggle('hidden', src !== 'chapter');
  document.getElementById('games-study-row').classList.toggle('hidden', src !== 'study');
  if (book) document.getElementById('games-chapter').max = book.chapters;
}
['games-source', 'games-book'].forEach(id => document.getElementById(id).addEventListener('change', updateGamesSourceFields));

function readGamesSource() {
  const cfg = { source: document.getElementById('games-source').value };
  if (['book', 'chapter'].includes(cfg.source)) cfg.book = document.getElementById('games-book').value;
  if (cfg.source === 'chapter') {
    cfg.chapter = document.getElementById('games-chapter').value || '1';
    const from = document.getElementById('games-from').value, to = document.getElementById('games-to').value;
    if (from) cfg.from = from;
    if (to) cfg.to = to;
  }
  if (cfg.source === 'study') cfg.set = document.getElementById('games-study').value;
  return cfg;
}

function renderGamesGrid() {
  const cats = [...new Set(GAME_LIST.map(g => g.cat))];
  document.getElementById('games-grid').innerHTML = cats.map(cat => `
    <p class="settings-group-title">${cat === 'Enfants' ? '🧒 Pour les enfants' : cat === 'Quiz' ? 'Quiz (questions préparées)' : cat === 'Lettres' ? 'Jeux de lettres' : 'Mémoriser les Écritures'}</p>
    <div class="study-modes">${GAME_LIST.filter(g => g.cat === cat).map(g => `
      <button type="button" class="study-mode" data-game="${g.key}"><span class="study-mode-icon">${g.icon}</span><strong>${g.name}</strong><span class="meta">${g.desc}</span></button>`).join('')}
    </div>`).join('');
  document.querySelectorAll('[data-game]').forEach(b => { b.onclick = () => startGame(b.dataset.game); });
}

async function loadGameChallenges() {
  const box = document.getElementById('games-challenges');
  try {
    const list = await api('/games/challenges');
    box.innerHTML = list.length ? list.slice(0, 8).map(c => {
      const g = GAME_LIST.find(x => x.key === c.game);
      return `<button type="button" class="study-set" data-challenge="${c.id}">
        <span class="study-set-title">${g?.icon || '🎮'} ${escapeHtml(g?.name || c.game)} — ${escapeHtml(c.label)}</span>
        <span class="meta">Lancé par ${escapeHtml(c.by)} · ${c.players} joueur${c.players > 1 ? 's' : ''}${c.top ? ` · meilleur : ${escapeHtml(c.top.name)} (${c.top.score})` : ''}${c.played ? ' · ✅ déjà joué' : ''}</span>
      </button>`;
    }).join('') : '<p class="meta">Aucun défi pour l\'instant. Termine une partie et appuie sur « Défier les autres ».</p>';
    box.querySelectorAll('[data-challenge]').forEach(b => { b.onclick = () => playChallenge(b.dataset.challenge); });
  } catch { box.innerHTML = ''; }
}

async function playChallenge(id) {
  try {
    const ch = await api(`/games/challenges/${id}`);
    startGame(ch.game, ch);
  } catch (err) { showToast(escapeHtml(err.message)); }
}

// --- Lancement d'une partie ---
async function startGame(key, challenge = null) {
  gClearTimers();
  game.challenge = challenge;
  const seed = challenge ? challenge.config.seed : Math.floor(Math.random() * 2 ** 31);
  game.rng = seededRng(seed);
  game.cfg = challenge ? { ...challenge.config } : readGamesSource();
  delete game.cfg.seed;
  const area = document.getElementById('game-area');
  document.getElementById('games-home').classList.add('hidden');
  area.classList.remove('hidden');
  area.innerHTML = '<p class="meta">Préparation de la partie…</p>';
  window.scrollTo({ top: 0 });
  game.pool = { label: 'Questions préparées', verses: [] };
  if (TEXT_GAMES.has(key) || key === 'adventure') {
    const params = new URLSearchParams({ ...game.cfg, seed, count: 40 });
    try { game.pool = await api(`/games/pool?${params}`); } catch (err) {
      area.innerHTML = `<div class="pep-card"><p>${escapeHtml(err.message)}</p><button type="button" id="game-back">← Retour aux jeux</button></div>`;
      area.querySelector('#game-back').onclick = loadGames;
      return;
    }
  }
  game.session = { key, score: 0, max: 0, round: 0, rounds: [], label: TEXT_GAMES.has(key) ? game.pool.label : 'Questions préparées' };
  const setup = GAME_SETUP[key];
  const rounds = setup();
  if (!rounds.length) {
    area.innerHTML = `<div class="pep-card"><p>Pas assez de texte pour ce jeu avec « ${escapeHtml(game.pool.label)} ». Choisis un passage plus long ou toute la Bible.</p><button type="button" id="game-back">← Retour aux jeux</button></div>`;
    area.querySelector('#game-back').onclick = loadGames;
    return;
  }
  game.session.rounds = rounds;
  nextGameRound();
}

function gameHeader() {
  const s = game.session;
  const g = GAME_LIST.find(x => x.key === s.key);
  return `<div class="study-progress"><span>${g.icon} ${g.name}${game.challenge ? ' · 🏆 défi' : ''}</span><span>${Math.min(s.round + 1, s.rounds.length)} / ${s.rounds.length} · ⭐ ${s.score}</span><button type="button" class="link-btn" data-game-quit>Arrêter</button></div>
    <div class="meta game-source">📖 ${escapeHtml(s.label)}</div>`;
}
function bindGameQuit(el) { el.querySelector('[data-game-quit]')?.addEventListener('click', () => finishGame(true)); }

function nextGameRound() {
  const s = game.session;
  if (!s) return;
  if (s.round >= s.rounds.length) return finishGame();
  const area = document.getElementById('game-area');
  GAME_PLAY[s.key](s.rounds[s.round], area);
  bindGameQuit(area);
}
function gameRoundDone(points, max) {
  const s = game.session;
  s.score += points;
  s.max += max;
  s.round++;
  gLater(nextGameRound, 900);
}
function gameFeedback(area, ok, html) {
  const fb = area.querySelector('.game-feedback');
  if (fb) fb.innerHTML = `<div class="study-verdict ${ok ? 'right' : 'wrong'}">${ok ? '✓ Bravo !' : '✗ Raté'}</div>${html || ''}`;
}

async function finishGame(quit = false) {
  gClearTimers();
  const s = game.session;
  if (!s) return loadGames();
  game.session = null;
  const area = document.getElementById('game-area');
  if (quit && !s.round) return loadGames();
  let saved = null;
  try {
    saved = await api('/games/scores', { method: 'POST', body: { game: s.key, score: s.score, max: Math.max(s.max, 1), label: s.label, challenge: game.challenge?.id } });
  } catch { /* score non enregistré : la partie reste affichée */ }
  const g = GAME_LIST.find(x => x.key === s.key);
  const pct = s.max ? s.score / s.max : 0;
  area.innerHTML = `<div class="pep-card study-card">
    <div class="pep-title">${pct >= 0.9 ? '🎉 Excellent !' : pct >= 0.6 ? '💪 Bien joué !' : '📖 On continue !'}</div>
    <div class="study-score">⭐ ${s.score} / ${s.max}</div>
    <div class="meta">${g.icon} ${g.name} · ${escapeHtml(s.label)}${saved?.record ? ' · 🏅 nouveau record !' : saved?.best ? ` · ton record : ${saved.best}` : ''}</div>
    <div class="pep-buttons">
      <button type="button" id="game-again">🔁 Rejouer</button>
      ${!game.challenge && game.cfg.source !== 'mine' ? '<button type="button" class="secondary" id="game-challenge">🏆 Défier les autres</button>' : ''}
      <button type="button" class="secondary" id="game-home">← Jeux</button>
    </div>
    <div class="card-block"><h3>🏆 ${game.challenge ? 'Classement du défi' : 'Meilleurs scores'}</h3><div id="game-ranking" class="meta">Chargement…</div></div>
  </div>`;
  area.querySelector('#game-again').onclick = () => startGame(s.key, game.challenge);
  area.querySelector('#game-home').onclick = loadGames;
  area.querySelector('#game-challenge')?.addEventListener('click', async () => {
    try {
      const ch = await api('/games/challenges', { method: 'POST', body: { game: s.key, config: game.cfg, label: s.label } });
      showToast('Défi créé 🏆 Tous les utilisateurs le voient dans Jeux.');
      startGame(s.key, ch);
    } catch (err) { showToast(escapeHtml(err.message)); }
  });
  try {
    const rows = game.challenge ? (await api(`/games/challenges/${game.challenge.id}`)).ranking : await api(`/games/leaderboard?game=${s.key}`);
    area.querySelector('#game-ranking').innerHTML = rows.length
      ? rows.map((r, k) => `<div class="study-rank${r.me ? ' me' : ''}"><span>${['🥇', '🥈', '🥉'][k] || `${k + 1}.`} ${escapeHtml(r.name)}${r.me ? ' (toi)' : ''}</span><span>${r.score}</span></div>`).join('')
      : 'Personne n\'a encore joué.';
  } catch { area.querySelector('#game-ranking').textContent = ''; }
}

// --- Préparation des manches (une fonction par jeu) ---
const verses = () => game.pool.verses;
function verseSegment(v, maxWords = 14) {
  const words = v.text.split(/\s+/);
  if (words.length <= maxWords) return words;
  const start = gRand(words.length - maxWords + 1);
  return words.slice(start, start + maxWords);
}
const GAME_SETUP = {
  order: () => gShuffle(verses()).slice(0, 5).map(v => ({ v, words: verseSegment(v, game.pool.cards ? 10 : 12) })),
  blanks: () => gShuffle(verses()).map(v => {
    const words = v.text.split(/\s+/);
    const keys = gShuffle(words.map((w, i) => i).filter(i => gKeywords(words[i], 4, 14).length)).slice(0, Math.min(4, Math.max(1, Math.floor(words.length / 5)))).sort((a, b) => a - b);
    return keys.length ? { v, words, keys } : null;
  }).filter(Boolean).slice(0, 5),
  reference: () => {
    const list = verses();
    if (list.length < 2) return [];
    return gShuffle(list).slice(0, 8).map(v => {
      const others = gShuffle(list.filter(x => x.ref !== v.ref)).slice(0, 3).map(x => x.ref);
      return { v, options: gShuffle([v.ref, ...others]) };
    });
  },
  memory: () => {
    const list = gShuffle(verses()).slice(0, 6);
    if (list.length < 3) return [];
    return [{ pairs: list.map((v, i) => ({ id: i, ref: v.ref, text: v.text.split(/\s+/).slice(0, 7).join(' ') + '…' })) }];
  },
  hangman: () => gShuffle(verses()).map(v => {
    const w = gPick(gKeywords(v.text, 5, 12).filter(x => gNorm(x).length >= 5) || []);
    return w ? { v, word: w, letters: gNorm(w) } : null;
  }).filter(Boolean).slice(0, 5),
  wordsearch: () => {
    const words = [];
    for (const v of gShuffle(verses())) {
      for (const w of gKeywords(v.text, 4, 9)) {
        const n = gNorm(w);
        if (n.length >= 4 && n.length <= 9 && !words.some(x => x.n === n)) words.push({ w, n });
        if (words.length >= 8) break;
      }
      if (words.length >= 8) break;
    }
    return words.length >= 4 ? [{ grid: buildWordGrid(words.map(x => x.n)), words }] : [];
  },
  anagram: () => gShuffle(verses()).map(v => {
    const w = gPick(gKeywords(v.text, 5, 10));
    if (!w) return null;
    const n = gNorm(w);
    let mixed = n;
    for (let i = 0; i < 5 && mixed === n; i++) mixed = gShuffle(n.split('')).join('');
    return { v, word: w, n, mixed };
  }).filter(Boolean).slice(0, 6),
  truefalse: () => {
    const list = verses();
    const pool = list.flatMap(v => gKeywords(v.text, 5, 12));
    if (pool.length < 4) return [];
    return gShuffle(list).slice(0, 10).map(v => {
      const keys = gKeywords(v.text, 5, 12);
      const real = game.rng() < 0.5 || !keys.length;
      if (real) return { v, shown: v.text, real: true };
      const target = gPick(keys);
      const swap = gPick(pool.filter(x => gNorm(x) !== gNorm(target))) || target;
      // Remplace le mot entier (pas un morceau d'un autre mot).
      let done = false;
      const shown = v.text.split(/(\s+)/).map(t => {
        if (done || gClean(t) !== target) return t;
        done = true;
        return t.replace(target, swap);
      }).join('');
      return { v, shown, real: false, target, swap };
    });
  },
  trivia: () => gShuffle(game.content.trivia).slice(0, 10).map(t => ({ q: t.q, ref: t.ref, a: t.a, options: gShuffle([t.a, ...t.w]) })),
  quotes: () => {
    const who = [...new Set(game.content.quotes.map(q => q.who))];
    return gShuffle(game.content.quotes).slice(0, 8).map(q => ({ ...q, options: gShuffle([q.who, ...gShuffle(who.filter(w => w !== q.who)).slice(0, 3)]) }));
  },
  riddles: () => {
    const names = game.content.riddles.map(r => r.answer);
    return gShuffle(game.content.riddles).slice(0, 6).map(r => ({ ...r, options: gShuffle([r.answer, ...gShuffle(names.filter(n => n !== r.answer)).slice(0, 3)]) }));
  },
  adventure: () => {
    // Parcours de 8 étapes faciles : questions pour enfants, devinettes, petits versets à remettre en ordre.
    const steps = [];
    const kidsTrivia = gShuffle(game.content.trivia.filter(t => t.kids));
    const kidsRiddles = gShuffle(game.content.riddles.filter(r => r.kids));
    const names = game.content.riddles.map(r => r.answer);
    const shortVerses = gShuffle(verses().filter(v => v.text.split(/\s+/).length <= 14));
    const plan = ['trivia', 'riddle', 'order', 'trivia', 'riddle', 'trivia', 'order', 'trivia'];
    for (const kind of plan) {
      if (kind === 'trivia' && kidsTrivia.length) { const t = kidsTrivia.pop(); steps.push({ kind, q: t.q, a: t.a, options: gShuffle([t.a, ...t.w]) }); }
      else if (kind === 'riddle' && kidsRiddles.length) { const r = kidsRiddles.pop(); steps.push({ kind, clues: r.clues, a: r.answer, options: gShuffle([r.answer, ...gShuffle(names.filter(n => n !== r.answer)).slice(0, 2)]) }); }
      else if (kind === 'order' && shortVerses.length) { const v = shortVerses.pop(); steps.push({ kind, v, words: v.text.split(/\s+/).slice(0, 6) }); }
      else if (kidsTrivia.length) { const t = kidsTrivia.pop(); steps.push({ kind: 'trivia', q: t.q, a: t.a, options: gShuffle([t.a, ...t.w]) }); }
    }
    return steps;
  }
};

// Grille de mots cachés 10×10 : horizontal, vertical, diagonal (et à l'envers).
function buildWordGrid(words) {
  const size = 10;
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const dirs = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [1, -1]];
  const placed = [];
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    for (let tries = 0; tries < 200; tries++) {
      const [dr, dc] = gPick(dirs);
      const r = gRand(size), c = gRand(size);
      const er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
      if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
      let ok = true;
      for (let i = 0; i < w.length && ok; i++) { const ch = grid[r + dr * i][c + dc * i]; ok = !ch || ch === w[i]; }
      if (!ok) continue;
      for (let i = 0; i < w.length; i++) grid[r + dr * i][c + dc * i] = w[i];
      placed.push({ w, r, c, dr, dc });
      break;
    }
  }
  const abc = 'ABCDEFGHIJKLMNOPRSTUVE';
  for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = abc[gRand(abc.length)];
  return { grid, placed };
}

// --- Déroulement de chaque jeu ---
function optionButtons(options) {
  return `<div class="study-options-list">${options.map((o, k) => `<button type="button" class="study-option" data-opt="${k}">${escapeHtml(o)}</button>`).join('')}</div>`;
}
// QCM générique : marque la bonne réponse, compte les points, passe à la suite.
function bindOptions(area, options, answer, onDone, explain = '') {
  area.querySelectorAll('[data-opt]').forEach(b => {
    b.onclick = () => {
      const ok = options[Number(b.dataset.opt)] === answer;
      area.querySelectorAll('[data-opt]').forEach(x => {
        x.disabled = true;
        if (options[Number(x.dataset.opt)] === answer) x.classList.add('right');
      });
      if (!ok) b.classList.add('wrong');
      gameFeedback(area, ok, explain);
      onDone(ok);
    };
  });
}

function playOrder(r, area, kids = false) {
  const target = r.words;
  const chips = gShuffle(target.map((w, i) => ({ w, i })));
  let pos = 0, errors = 0;
  area.innerHTML = `<div class="pep-card study-card${kids ? ' kids' : ''}">${kids ? '' : gameHeader()}
    <div class="meta">Touche les mots dans le bon ordre${game.pool.cards ? '' : ` · ${escapeHtml(r.v.ref)}`}.</div>
    ${game.pool.cards ? `<div class="study-q">${escapeHtml(r.v.ref)}</div>` : ''}
    <div class="game-built"></div>
    <div class="game-chips">${chips.map((c, k) => `<button type="button" class="game-chip" data-chip="${k}">${escapeHtml(c.w)}</button>`).join('')}</div>
    <div class="game-feedback"></div></div>`;
  const built = area.querySelector('.game-built');
  area.querySelectorAll('[data-chip]').forEach(b => {
    b.onclick = () => {
      const c = chips[Number(b.dataset.chip)];
      // Accepte aussi un mot identique placé ailleurs (« et », « de »…).
      if (gNorm(c.w) === gNorm(target[pos])) {
        b.disabled = true; b.classList.add('right');
        built.insertAdjacentHTML('beforeend', `<span>${escapeHtml(target[pos])} </span>`);
        pos++;
        if (pos === target.length) {
          const pts = errors === 0 ? 2 : errors <= 2 ? 1 : 0;
          gameFeedback(area, pts > 0, `<div class="meta">${errors} erreur${errors > 1 ? 's' : ''}</div>`);
          (kids ? adventureStepDone : gameRoundDone)(pts, 2);
        }
      } else {
        errors++;
        b.classList.add('wrong'); gLater(() => b.classList.remove('wrong'), 400);
      }
    };
  });
}

const GAME_PLAY = {
  order: (r, area) => playOrder(r, area),
  blanks: (r, area) => {
    const bank = gShuffle(r.keys.map(i => gClean(r.words[i])));
    let next = 0, errors = 0;
    const render = () => r.words.map((w, i) => {
      const k = r.keys.indexOf(i);
      if (k === -1) return escapeHtml(w);
      return k < next ? `<span class="quiz-blank">${escapeHtml(w)}</span>` : `<span class="game-hole${k === next ? ' current' : ''}">____</span>`;
    }).join(' ');
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}
      <div class="meta">${escapeHtml(r.v.ref)} · touche les mots manquants dans l'ordre.</div>
      <div class="quiz-prompt game-text">${render()}</div>
      <div class="game-chips">${bank.map((w, k) => `<button type="button" class="game-chip" data-bank="${k}">${escapeHtml(w)}</button>`).join('')}</div>
      <div class="game-feedback"></div></div>`;
    area.querySelectorAll('[data-bank]').forEach(b => {
      b.onclick = () => {
        if (gNorm(bank[Number(b.dataset.bank)]) === gNorm(gClean(r.words[r.keys[next]]))) {
          b.disabled = true; b.classList.add('right'); next++;
          area.querySelector('.game-text').innerHTML = render();
          if (next === r.keys.length) { gameFeedback(area, errors === 0); gameRoundDone(errors === 0 ? 2 : 1, 2); }
        } else { errors++; b.classList.add('wrong'); gLater(() => b.classList.remove('wrong'), 400); }
      };
    });
  },
  reference: (r, area) => {
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}
      <div class="meta">${game.pool.cards ? 'À quelle question correspond cette réponse ?' : 'Où se trouve ce verset ?'}</div>
      <div class="study-a">${escapeHtml(r.v.text)}</div>${optionButtons(r.options)}<div class="game-feedback"></div></div>`;
    bindOptions(area, r.options, r.v.ref, ok => gameRoundDone(ok ? 1 : 0, 1));
  },
  memory: (r, area) => {
    const cards = gShuffle(r.pairs.flatMap(p => [{ id: p.id, label: p.ref, kind: 'ref' }, { id: p.id, label: p.text, kind: 'text' }]));
    let open = [], found = 0, moves = 0;
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}
      <div class="meta">Retourne deux cartes : trouve chaque ${game.pool.cards ? 'question et sa réponse' : 'référence et son verset'}.</div>
      <div class="game-memory">${cards.map((c, k) => `<button type="button" class="game-card" data-card="${k}"><span>${escapeHtml(c.label)}</span></button>`).join('')}</div>
      <div class="meta" id="game-moves">Coups : 0</div><div class="game-feedback"></div></div>`;
    area.querySelectorAll('[data-card]').forEach(b => {
      b.onclick = () => {
        if (open.length === 2 || b.classList.contains('open') || b.classList.contains('right')) return;
        b.classList.add('open');
        open.push(b);
        if (open.length < 2) return;
        moves++;
        area.querySelector('#game-moves').textContent = `Coups : ${moves}`;
        const [x, y] = open.map(e => cards[Number(e.dataset.card)]);
        if (x.id === y.id && x.kind !== y.kind) {
          open.forEach(e => { e.classList.remove('open'); e.classList.add('right'); });
          open = [];
          if (++found === r.pairs.length) {
            const pts = Math.max(1, r.pairs.length * 2 - Math.max(0, moves - r.pairs.length));
            gameFeedback(area, true, `<div class="meta">${moves} coups</div>`);
            gameRoundDone(pts, r.pairs.length * 2);
          }
        } else gLater(() => { open.forEach(e => e.classList.remove('open')); open = []; }, 900);
      };
    });
  },
  hangman: (r, area) => {
    const guessed = new Set();
    let lives = 6;
    const hint = r.v.text.replace(r.word, '____');
    const draw = () => {
      const shown = r.letters.split('').map(l => (guessed.has(l) ? l : '_')).join(' ');
      area.querySelector('.game-word').textContent = shown;
      area.querySelector('.game-lives').textContent = '❤️'.repeat(lives) + '🤍'.repeat(6 - lives);
    };
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}
      <div class="meta">${game.pool.cards ? escapeHtml(r.v.ref) : `Indice — ${escapeHtml(r.v.ref)}`}</div>
      <div class="study-a">${escapeHtml(hint)}</div>
      <div class="game-word"></div><div class="game-lives"></div>
      <div class="game-keyboard">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => `<button type="button" data-key="${l}">${l}</button>`).join('')}</div>
      <div class="game-feedback"></div></div>`;
    draw();
    area.querySelectorAll('[data-key]').forEach(b => {
      b.onclick = () => {
        const l = b.dataset.key;
        b.disabled = true;
        guessed.add(l);
        if (!r.letters.includes(l)) { lives--; b.classList.add('wrong'); } else b.classList.add('right');
        draw();
        const won = r.letters.split('').every(x => guessed.has(x));
        if (won || lives === 0) {
          area.querySelectorAll('[data-key]').forEach(k => { k.disabled = true; });
          gameFeedback(area, won, `<div class="meta">Le mot était : <strong>${escapeHtml(r.word)}</strong></div>`);
          gameRoundDone(won ? Math.max(1, Math.ceil(lives / 2)) : 0, 3);
        }
      };
    });
  },
  wordsearch: (r, area) => {
    const { grid, placed } = r.grid;
    const found = new Set();
    let first = null;
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}
      <div class="meta">Touche la première puis la dernière lettre d'un mot.</div>
      <div class="game-grid">${grid.map((row, ri) => row.map((ch, ci) => `<button type="button" class="game-cell" data-r="${ri}" data-c="${ci}">${ch}</button>`).join('')).join('')}</div>
      <div class="game-wordlist">${placed.map(p => `<span data-word="${p.w}">${p.w}</span>`).join('')}</div>
      <div class="pep-buttons"><button type="button" class="secondary" id="game-ws-stop">J'ai fini</button></div>
      <div class="game-feedback"></div></div>`;
    const cell = (ri, ci) => area.querySelector(`[data-r="${ri}"][data-c="${ci}"]`);
    const end = () => {
      gameFeedback(area, found.size === placed.length, `<div class="meta">${found.size} / ${placed.length} mots trouvés</div>`);
      game.session.score += found.size; game.session.max += placed.length; game.session.round++;
      gLater(nextGameRound, 1200);
    };
    area.querySelector('#game-ws-stop').onclick = end;
    area.querySelectorAll('.game-cell').forEach(b => {
      b.onclick = () => {
        const ri = Number(b.dataset.r), ci = Number(b.dataset.c);
        if (!first) { first = [ri, ci]; b.classList.add('picked'); return; }
        cell(...first).classList.remove('picked');
        const hit = placed.find(p => !found.has(p.w) && (
          (p.r === first[0] && p.c === first[1] && p.r + p.dr * (p.w.length - 1) === ri && p.c + p.dc * (p.w.length - 1) === ci) ||
          (p.r === ri && p.c === ci && p.r + p.dr * (p.w.length - 1) === first[0] && p.c + p.dc * (p.w.length - 1) === first[1])));
        first = null;
        if (!hit) { b.classList.add('wrong'); gLater(() => b.classList.remove('wrong'), 400); return; }
        found.add(hit.w);
        for (let i = 0; i < hit.w.length; i++) cell(hit.r + hit.dr * i, hit.c + hit.dc * i).classList.add('right');
        area.querySelector(`[data-word="${hit.w}"]`).classList.add('found');
        if (found.size === placed.length) end();
      };
    });
  },
  anagram: (r, area) => {
    let typed = '';
    const letters = r.mixed.split('');
    const used = new Set();
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}
      <div class="meta">Remets les lettres dans l'ordre · indice — ${escapeHtml(r.v.ref)}</div>
      <div class="study-a">${escapeHtml(r.v.text.replace(r.word, '____'))}</div>
      <div class="game-word" id="game-typed">&nbsp;</div>
      <div class="game-chips">${letters.map((l, k) => `<button type="button" class="game-chip letter" data-l="${k}">${l}</button>`).join('')}</div>
      <div class="pep-buttons"><button type="button" class="secondary" id="game-erase">⌫ Effacer</button></div>
      <div class="game-feedback"></div></div>`;
    const show = () => { area.querySelector('#game-typed').textContent = typed || ' '; };
    area.querySelectorAll('[data-l]').forEach(b => {
      b.onclick = () => {
        used.add(b.dataset.l); b.disabled = true;
        typed += letters[Number(b.dataset.l)];
        show();
        if (typed.length === letters.length) {
          const ok = typed === r.n;
          area.querySelectorAll('[data-l]').forEach(x => { x.disabled = true; });
          gameFeedback(area, ok, `<div class="meta">Le mot était : <strong>${escapeHtml(r.word)}</strong></div>`);
          gameRoundDone(ok ? 1 : 0, 1);
        }
      };
    });
    area.querySelector('#game-erase').onclick = () => {
      typed = '';
      used.clear();
      area.querySelectorAll('[data-l]').forEach(x => { x.disabled = false; });
      show();
    };
  },
  truefalse: (r, area) => {
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}
      <div class="meta">Ce verset est-il exact ?${game.pool.cards ? '' : ` · ${escapeHtml(r.v.ref)}`}</div>
      ${game.pool.cards ? `<div class="study-q">${escapeHtml(r.v.ref)}</div>` : ''}
      <div class="study-a">${escapeHtml(r.shown)}</div>
      <div class="study-grade pep-buttons"><button type="button" class="study-right" data-tf="1">Vrai</button><button type="button" class="study-wrong" data-tf="0">Faux</button></div>
      <div class="game-feedback"></div></div>`;
    area.querySelectorAll('[data-tf]').forEach(b => {
      b.onclick = () => {
        area.querySelectorAll('[data-tf]').forEach(x => { x.disabled = true; });
        const ok = (b.dataset.tf === '1') === r.real;
        gameFeedback(area, ok, r.real ? '<div class="meta">Le verset était exact.</div>' : `<div class="meta">« ${escapeHtml(r.swap)} » remplaçait « <strong>${escapeHtml(r.target)}</strong> ».</div>`);
        gameRoundDone(ok ? 1 : 0, 1);
      };
    });
  },
  trivia: (r, area) => {
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}<div class="study-q">${escapeHtml(r.q)}</div>${optionButtons(r.options)}<div class="game-feedback"></div></div>`;
    bindOptions(area, r.options, r.a, ok => gameRoundDone(ok ? 1 : 0, 1), r.ref ? `<div class="meta">📖 ${escapeHtml(r.ref)}</div>` : '');
  },
  quotes: (r, area) => {
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}<div class="meta">Qui a dit :</div><div class="study-a">« ${escapeHtml(r.quote)} »</div>${optionButtons(r.options)}<div class="game-feedback"></div></div>`;
    bindOptions(area, r.options, r.who, ok => gameRoundDone(ok ? 1 : 0, 1), `<div class="meta">📖 ${escapeHtml(r.ref)}</div>`);
  },
  riddles: (r, area) => {
    let shown = 1;
    const draw = () => {
      area.querySelector('.game-clues').innerHTML = r.clues.slice(0, shown).map((c, k) => `<div class="game-clue">💡 Indice ${k + 1} : ${escapeHtml(c)}</div>`).join('');
      area.querySelector('#game-more').classList.toggle('hidden', shown >= r.clues.length);
    };
    area.innerHTML = `<div class="pep-card study-card">${gameHeader()}<div class="study-q">Qui suis-je ?</div><div class="game-clues"></div>
      <button type="button" class="link-btn" id="game-more">+ Un autre indice (moins de points)</button>
      ${optionButtons(r.options)}<div class="game-feedback"></div></div>`;
    draw();
    area.querySelector('#game-more').onclick = () => { shown++; draw(); };
    bindOptions(area, r.options, r.answer, ok => { area.querySelector('#game-more').classList.add('hidden'); gameRoundDone(ok ? 4 - shown : 0, 3); }, `<div class="meta">📖 ${escapeHtml(r.ref)}</div>`);
  },
  adventure: (r, area) => {
    const s = game.session;
    const path = s.rounds.map((st, k) => `<span class="adv-step${k < s.round ? ' done' : k === s.round ? ' here' : ''}">${k < s.round ? '⭐' : k === s.round ? '🧒' : ['🌳', '⛰️', '🏠', '🌊', '🐑', '🌟', '🏰', '🎁'][k % 8]}</span>`).join('<span class="adv-line"></span>');
    const head = `<div class="study-progress"><span>🗺️ L'aventure de la Bible</span><span>⭐ ${s.score}</span><button type="button" class="link-btn" data-game-quit>Arrêter</button></div><div class="adv-path">${path}</div>`;
    if (r.kind === 'order') {
      playOrder({ v: r.v, words: r.words }, area, true);
      area.querySelector('.pep-card').insertAdjacentHTML('afterbegin', head + '<div class="adv-title">🧩 Remets les mots du verset dans l\'ordre !</div>');
      return;
    }
    area.innerHTML = `<div class="pep-card study-card kids">${head}
      ${r.kind === 'riddle' ? `<div class="adv-title">🕵️ Qui suis-je ?</div>${r.clues.map(c => `<div class="game-clue">💡 ${escapeHtml(c)}</div>`).join('')}` : `<div class="adv-title">❓ ${escapeHtml(r.q)}</div>`}
      ${optionButtons(r.options)}<div class="game-feedback"></div></div>`;
    bindOptions(area, r.options, r.a, ok => adventureStepDone(ok ? 1 : 0, 1));
  }
};
// Dans l'aventure, chaque étape réussie rapporte une étoile.
function adventureStepDone(points) { gameRoundDone(points > 0 ? 1 : 0, 1); }
