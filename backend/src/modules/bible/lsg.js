// Bible Louis Segond 1910 complète (domaine public), chargée à la demande :
// le fichier (≈4,5 Mo) n'est lu qu'à la première recherche, pas au démarrage.
// Recherche par référence (« Jean 3:16 », « Ps 23 », « 1 Co 13:4-7 ») ou par
// mots-clés (tous les mots doivent apparaître, sans tenir compte des accents).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let BIBLE = null;
let INDEX = null; // [{ b, c, v, norm }] pour la recherche plein texte (c et v comptés à partir de 0)

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[’']/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

function load() {
  if (!BIBLE) BIBLE = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'lsg1910.json'), 'utf-8'));
  return BIBLE;
}
function index() {
  if (!INDEX) {
    INDEX = [];
    load().books.forEach((book, b) => book.chapters.forEach((verses, c) => verses.forEach((text, v) => {
      INDEX.push({ b, c, v, norm: ` ${norm(text)} ` });
    })));
  }
  return INDEX;
}

// Abréviations courantes (en plus des noms complets et de leurs débuts).
const ALIASES = {
  gn: 'Genèse', gen: 'Genèse', ex: 'Exode', lv: 'Lévitique', lev: 'Lévitique', nb: 'Nombres', dt: 'Deutéronome', deut: 'Deutéronome',
  jos: 'Josué', jg: 'Juges', rt: 'Ruth', '1s': '1 Samuel', '2s': '2 Samuel', '1r': '1 Rois', '2r': '2 Rois',
  '1ch': '1 Chroniques', '2ch': '2 Chroniques', esd: 'Esdras', ne: 'Néhémie', neh: 'Néhémie', est: 'Esther', jb: 'Job',
  ps: 'Psaumes', psaume: 'Psaumes', pr: 'Proverbes', prov: 'Proverbes', ec: 'Ecclésiaste', ecc: 'Ecclésiaste', eccl: 'Ecclésiaste', qo: 'Ecclésiaste',
  ct: 'Cantique des cantiques', cant: 'Cantique des cantiques', cantique: 'Cantique des cantiques',
  es: 'Ésaïe', esa: 'Ésaïe', is: 'Ésaïe', isaie: 'Ésaïe', jr: 'Jérémie', jer: 'Jérémie', lm: 'Lamentations', lam: 'Lamentations',
  ez: 'Ézéchiel', ezech: 'Ézéchiel', dn: 'Daniel', dan: 'Daniel', os: 'Osée', jl: 'Joël', am: 'Amos', ab: 'Abdias', abd: 'Abdias',
  jon: 'Jonas', mi: 'Michée', mic: 'Michée', na: 'Nahum', ha: 'Habacuc', hab: 'Habacuc', habakuk: 'Habacuc', so: 'Sophonie', soph: 'Sophonie',
  ag: 'Aggée', za: 'Zacharie', zach: 'Zacharie', ml: 'Malachie', mal: 'Malachie',
  mt: 'Matthieu', matt: 'Matthieu', mc: 'Marc', mr: 'Marc', lc: 'Luc', jn: 'Jean', ac: 'Actes des Apôtres', act: 'Actes des Apôtres', actes: 'Actes des Apôtres',
  rm: 'Romains', rom: 'Romains', '1co': '1 Corinthiens', '2co': '2 Corinthiens', '1cor': '1 Corinthiens', '2cor': '2 Corinthiens',
  ga: 'Galates', gal: 'Galates', ep: 'Éphésiens', eph: 'Éphésiens', ph: 'Philippiens', phil: 'Philippiens', col: 'Colossiens',
  '1th': '1 Thessaloniciens', '2th': '2 Thessaloniciens', '1tm': '1 Timothée', '2tm': '2 Timothée', '1tim': '1 Timothée', '2tim': '2 Timothée',
  tt: 'Tite', tit: 'Tite', phm: 'Philémon', philem: 'Philémon', he: 'Hébreux', heb: 'Hébreux', jc: 'Jacques', jac: 'Jacques', jq: 'Jacques',
  '1p': '1 Pierre', '2p': '2 Pierre', '1pi': '1 Pierre', '2pi': '2 Pierre', '1jn': '1 Jean', '2jn': '2 Jean', '3jn': '3 Jean',
  jud: 'Jude', ap: 'Apocalypse', apo: 'Apocalypse', apoc: 'Apocalypse'
};

export function books() {
  return load().books.map((b, i) => ({ index: i, name: b.name, chapters: b.chapters.length }));
}

function findBook(raw) {
  const key = norm(raw).replace(/\s+/g, '');
  if (!key) return -1;
  const list = load().books;
  const keyOf = (name) => norm(name).replace(/\s+/g, '');
  if (ALIASES[key]) return list.findIndex(b => b.name === ALIASES[key]);
  const exact = list.findIndex(b => keyOf(b.name) === key);
  if (exact !== -1) return exact;
  // Début de nom (« philip » → Philippiens), au moins 3 caractères.
  if (key.replace(/^\d/, '').length < 3) return -1;
  return list.findIndex(b => keyOf(b.name).startsWith(key));
}

// « Jean 3:16 », « jean 3 16 », « Ps 23 », « 1 Co 13:4-7 », « Romains 8.28 »
export function parseReference(q) {
  const m = String(q || '').trim().match(/^([1-3]?\s*[^\d:.,\s][^\d:.,]*?)\s*(\d+)(?:\s*[:.,]\s*|\s+)?(\d+)?(?:\s*[-–]\s*(\d+))?\s*$/);
  if (!m) return null;
  const b = findBook(m[1]);
  if (b === -1) return null;
  const book = load().books[b];
  const c = Number(m[2]);
  if (c < 1 || c > book.chapters.length) return { error: `${book.name} a ${book.chapters.length} chapitre(s).` };
  const count = book.chapters[c - 1].length;
  let from = m[3] ? Number(m[3]) : null;
  let to = m[4] ? Number(m[4]) : from;
  if (from !== null) {
    if (from < 1 || from > count) return { error: `${book.name} ${c} a ${count} verset(s).` };
    to = Math.min(Math.max(to, from), count);
  }
  return { b, c, from, to };
}

function refLabel(b, c, from, to) {
  const name = load().books[b].name;
  if (from === null || from === undefined) return `${name} ${c}`;
  return to && to !== from ? `${name} ${c}:${from}-${to}` : `${name} ${c}:${from}`;
}

export function chapter(b, c) {
  const book = load().books[b];
  if (!book || !book.chapters[c - 1]) return null;
  return {
    book: book.name, bookIndex: b, chapter: c, chapters: book.chapters.length,
    verses: book.chapters[c - 1].map((text, i) => ({ verse: i + 1, ref: refLabel(b, c, i + 1), text }))
  };
}

// Texte d'un passage (un verset ou une plage) à partir de sa référence.
export function passage(ref) {
  const p = parseReference(ref);
  if (!p || p.error || p.from === null) return null;
  const verses = load().books[p.b].chapters[p.c - 1].slice(p.from - 1, p.to);
  return { ref: refLabel(p.b, p.c, p.from, p.to), text: verses.join(' ') };
}

export function searchText(q, limit = 50) {
  const words = norm(q).split(' ').filter(w => w.length > 1);
  if (!words.length) return { total: 0, results: [] };
  const hits = index().filter(e => words.every(w => e.norm.includes(` ${w}`)));
  return {
    total: hits.length,
    results: hits.slice(0, limit).map(e => ({ ref: refLabel(e.b, e.c + 1, e.v + 1), text: load().books[e.b].chapters[e.c][e.v] }))
  };
}

export function randomVerse() {
  const all = index();
  const e = all[Math.floor(Math.random() * all.length)];
  return { ref: refLabel(e.b, e.c + 1, e.v + 1), text: load().books[e.b].chapters[e.c][e.v] };
}

// --- Plans de lecture : liste ordonnée de chapitres répartie sur N jours ---
function chaptersOf(fromBook, toBook) {
  const list = [];
  load().books.slice(fromBook, toBook + 1).forEach((book, k) => {
    for (let c = 1; c <= book.chapters.length; c++) list.push({ b: fromBook + k, c });
  });
  return list;
}
export const PLANS = {
  'bible-1an': { label: 'Toute la Bible en 1 an', days: 365, chapters: () => chaptersOf(0, 65) },
  'nt-90j': { label: 'Nouveau Testament en 90 jours', days: 90, chapters: () => chaptersOf(39, 65) },
  'evangiles-30j': { label: 'Les 4 Évangiles en 30 jours', days: 30, chapters: () => chaptersOf(39, 42) },
  'psaumes-60j': { label: 'Les Psaumes en 60 jours', days: 60, chapters: () => chaptersOf(18, 18) },
  'proverbes-31j': { label: 'Proverbes : un chapitre par jour (31 jours)', days: 31, chapters: () => chaptersOf(19, 19) }
};

// Lecture du jour n (0 = premier jour) d'un plan : chapitres et libellé.
export function planDay(planKey, day) {
  const plan = PLANS[planKey];
  if (!plan || day < 0 || day >= plan.days) return null;
  const all = plan.chapters();
  const slice = all.slice(Math.floor(day * all.length / plan.days), Math.floor((day + 1) * all.length / plan.days));
  // Regroupe les chapitres consécutifs d'un même livre : « Genèse 1-3 ».
  const parts = [];
  for (const { b, c } of slice) {
    const last = parts[parts.length - 1];
    if (last && last.b === b && last.to === c - 1) last.to = c;
    else parts.push({ b, from: c, to: c });
  }
  const label = parts.map(p => `${load().books[p.b].name} ${p.from}${p.to !== p.from ? '-' + p.to : ''}`).join(', ');
  return { day, label, first: slice[0] ? { book: slice[0].b, chapter: slice[0].c } : null, chapters: slice.length };
}
