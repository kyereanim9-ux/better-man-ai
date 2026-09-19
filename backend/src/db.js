// Couche d'accès aux données.
// Deux backends possibles, choisis automatiquement :
//   - Sans DATABASE_URL : fichier JSON local (lowdb) — gratuit, zéro dépendance
//     externe, parfait pour un usage local. C'est le mode par défaut.
//   - Avec DATABASE_URL : PostgreSQL (ex: Neon, Supabase — paliers gratuits
//     disponibles) — nécessaire pour un hébergement serverless (Vercel...) où
//     le disque n'est pas persistant entre les requêtes.
// Dans les deux cas, le reste de l'app n'utilise que `db.data`, `db.read()`
// et `db.write()` — aucune route n'a besoin de savoir quel backend est actif.

const defaultData = {
  users: [],        // { id, email, passwordHash, name, role: 'user'|'admin', active, createdAt, onboarding }
  conversations: [], // { id, userId, title, createdAt, messages: [{role, content, createdAt}] }
  journalEntries: [],// { id, userId, content, createdAt }
  habits: [],        // { id, userId, title, frequency, doneDates: [] }
  goals: [],         // { id, userId, title, category, status, createdAt }
  feedback: [],      // { id, userId, targetType, targetId, useful, comment, createdAt }
  bibleMemorization: [], // { id, userId, ref, text, stage, startedAt }
  situations: [],    // { id, userId, content, domains, questions, suggestion, createdAt }
  financeTransactions: [], // { id, userId, type, amount, category, note, date }
  financeSavingsGoals: [],  // { id, userId, title, targetAmount, savedAmount, createdAt }
  financeInvestments: [],   // { id, userId, name, type, amount, annualRatePercent, horizonMonths, note, createdAt }
  libraryItems: [],  // { id, userId, title, author, type, text, position, createdAt }
  videos: [],        // { id, userId, title, url, transcript, createdAt }
  teachTopics: [],   // { id, userId, topic, levels: [{key,label,completed}], createdAt }
  learningAttempts: [], // { id, userId, sourceType, sourceId, label, selfRating, createdAt }
  intimacyEntries: [],  // { id, userId, content, createdAt } — journal privé dédié, séparé du journal général
  physiqueMeasurements: [], // { id, userId, weight, waist, date, createdAt }
  physiqueWorkouts: [],     // { id, userId, type, durationMinutes, sets, reps, notes, date, createdAt }
  physiqueGoals: [],        // { id, userId, title, milestone, targetDate, achieved, createdAt }
  styleEntries: []          // { id, userId, area, note, createdAt }
};

// Domaines de vie utilisés partout dans l'app (scores, objectifs, habitudes,
// situations...). Centralisé ici pour rester cohérent entre modules.
export const DOMAINS = [
  'emotionnel', 'relationnel', 'physique', 'mental', 'financier',
  'professionnel', 'social', 'communication', 'discipline', 'intime', 'spirituel'
];

// S'assure que db.data ne reste jamais null et que les collections ajoutées
// par une phase ultérieure existent toujours, sans écraser les données déjà
// présentes. Partagé entre les deux backends.
function ensureShape(data) {
  if (!data) return { data: structuredClone(defaultData), changed: true };
  let changed = false;
  for (const key of Object.keys(defaultData)) {
    if (!(key in data)) { data[key] = structuredClone(defaultData[key]); changed = true; }
  }
  return { data, changed };
}

async function createLocalStore() {
  const { Low } = await import('lowdb');
  const { JSONFile } = await import('lowdb/node');
  const path = await import('path');
  const os = await import('os');
  const { fileURLToPath } = await import('url');

  // Sur Vercel (ou tout hébergement serverless) sans DATABASE_URL configuré,
  // le disque du projet est en lecture seule — seul /tmp est inscriptible,
  // mais non persistant entre les invocations. On l'utilise quand même pour
  // éviter un crash pur et simple ; consulte le README pour configurer une
  // vraie base de données si tu veux que les données survivent.
  let dataDir;
  if (process.env.VERCEL) {
    dataDir = path.join(os.tmpdir(), 'better-man-ai-data');
  } else {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    dataDir = path.join(__dirname, '..', 'data');
  }
  const file = path.join(dataDir, 'db.json');

  const adapter = new JSONFile(file);
  const low = new Low(adapter, defaultData);

  return {
    data: null,
    async read() {
      await low.read();
      const { data, changed } = ensureShape(low.data);
      low.data = data;
      this.data = data;
      if (changed) await this.write();
      return this.data;
    },
    async write() {
      low.data = this.data;
      await low.write();
    },
    async init() {
      const fs = await import('fs');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      await this.read();
      await this.write();
    }
  };
}

// Stocke tout db.data comme un unique document JSON dans une table à une
// ligne. Volontairement simple (pas de schéma relationnel) pour ne demander
// AUCUN changement aux ~20 modules de routes qui utilisent déjà db.data.xxx —
// une vraie normalisation en tables séparées serait la prochaine étape si
// l'app grandissait beaucoup, mais n'est pas nécessaire pour un usage personnel.
async function createPostgresStore(connectionString) {
  const { default: postgres } = await import('postgres');
  const sql = postgres(connectionString, { ssl: 'require', onnotice: () => {} });

  return {
    data: null,
    async read() {
      await sql`CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, data JSONB NOT NULL)`;
      const rows = await sql`SELECT data FROM app_state WHERE id = 1`;
      const { data, changed } = ensureShape(rows[0]?.data);
      this.data = data;
      if (rows.length === 0) {
        await sql`INSERT INTO app_state (id, data) VALUES (1, ${sql.json(this.data)})`;
      } else if (changed) {
        await this.write();
      }
      return this.data;
    },
    async write() {
      await sql`
        INSERT INTO app_state (id, data) VALUES (1, ${sql.json(this.data)})
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
      `;
    },
    async init() {
      await this.read();
    }
  };
}

// Choix du backend : import dynamique (top-level await) selon la présence de
// DATABASE_URL, pour ne charger que le driver réellement utilisé.
export const db = process.env.DATABASE_URL
  ? await createPostgresStore(process.env.DATABASE_URL)
  : await createLocalStore();

export async function initDB() {
  await db.init();
}

// Supprime toutes les données d'un utilisateur, dans toutes les collections
// qui le référencent par userId. Centralisé ici pour ne JAMAIS oublier une
// collection lors d'une suppression de compte (admin ou self-service) —
// une collection non listée ici resterait orpheline après suppression.
// Appeler après db.read() ; l'appelant doit faire db.write() ensuite.
export function purgeUserData(userId) {
  db.data.users = db.data.users.filter(u => u.id !== userId);
  db.data.conversations = db.data.conversations.filter(c => c.userId !== userId);
  db.data.journalEntries = db.data.journalEntries.filter(j => j.userId !== userId);
  db.data.habits = db.data.habits.filter(h => h.userId !== userId);
  db.data.goals = db.data.goals.filter(g => g.userId !== userId);
  db.data.bibleMemorization = db.data.bibleMemorization.filter(m => m.userId !== userId);
  db.data.situations = db.data.situations.filter(s => s.userId !== userId);
  db.data.financeTransactions = db.data.financeTransactions.filter(t => t.userId !== userId);
  db.data.financeSavingsGoals = db.data.financeSavingsGoals.filter(g => g.userId !== userId);
  db.data.financeInvestments = db.data.financeInvestments.filter(i => i.userId !== userId);
  db.data.libraryItems = db.data.libraryItems.filter(b => b.userId !== userId);
  db.data.videos = db.data.videos.filter(v => v.userId !== userId);
  db.data.teachTopics = db.data.teachTopics.filter(t => t.userId !== userId);
  db.data.learningAttempts = db.data.learningAttempts.filter(a => a.userId !== userId);
  db.data.intimacyEntries = db.data.intimacyEntries.filter(e => e.userId !== userId);
  db.data.physiqueMeasurements = db.data.physiqueMeasurements.filter(m => m.userId !== userId);
  db.data.physiqueWorkouts = db.data.physiqueWorkouts.filter(w => w.userId !== userId);
  db.data.physiqueGoals = db.data.physiqueGoals.filter(g => g.userId !== userId);
  db.data.styleEntries = db.data.styleEntries.filter(e => e.userId !== userId);
}
