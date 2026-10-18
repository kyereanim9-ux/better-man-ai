// Notifications : rappels calculés selon les préférences de chaque utilisateur.
// - Dans l'app : la cloche affiche les rappels du moment (computeItems).
// - Sur le téléphone : notifications push (Web Push, gratuit). Les clés VAPID
//   viennent de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY si elles sont définies,
//   sinon elles sont générées une fois et gardées dans la base (appConfig) :
//   rien à configurer pour que ça marche.
// - Envoi programmé : runNotificationCron() est appelée toutes les 15 min par
//   une tâche GitHub Actions (POST /api/notifications/cron) et, en local, par
//   un minuteur dans server.js. Chaque rappel part au plus une fois par jour.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import { db } from '../../db.js';
import { computeStatus } from '../bible/spacedRepetition.js';
import { verseOfDay } from '../bible/routes.js';
import { computeStreak } from '../gamification/routes.js';
import { studyDue } from '../study/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PEPITES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pepites', 'data', 'pepites.json'), 'utf-8'));

export const NOTIF_TYPES = {
  verseOfDay: { label: 'Verset du jour', default: true },
  pepites: { label: 'Nouvelles pépites', default: true },
  missions: { label: 'Missions et habitudes', default: false },
  verses: { label: 'Versets et fiches de révision à revoir', default: false },
  streak: { label: 'Série en danger (vers 20h)', default: false }
};
const STREAK_HOUR = '20:00';
// Si l'envoi programmé a pris du retard, on n'envoie plus le rappel du jour
// au-delà de 3 h après l'heure choisie (pas de « rappel du matin » à 23 h).
const LATE_LIMIT_MIN = 180;

export function getPrefs(user) {
  const saved = user.notifPrefs || {};
  const types = {};
  for (const [key, def] of Object.entries(NOTIF_TYPES)) types[key] = saved.types?.[key] ?? def.default;
  return { types, time: saved.time || '08:00', tz: saved.tz || 'Europe/Paris' };
}

export function sanitizePrefs(body, current) {
  const types = { ...current.types };
  for (const key of Object.keys(NOTIF_TYPES)) if (typeof body?.types?.[key] === 'boolean') types[key] = body.types[key];
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(body?.time) ? body.time : current.time;
  let tz = current.tz;
  try { if (body?.tz) { new Intl.DateTimeFormat('fr-FR', { timeZone: body.tz }); tz = body.tz; } } catch { /* fuseau invalide ignoré */ }
  return { types, time, tz };
}

// Date (AAAA-MM-JJ) et heure (HH:MM) locales dans le fuseau de l'utilisateur.
export function localNow(tz, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// Rappels du moment pour un utilisateur, selon ses préférences.
export function computeItems(uid, prefs) {
  const items = [];
  const today = new Date().toISOString().slice(0, 10); // même convention que les habitudes
  const habits = db.data.habits.filter(h => h.userId === uid);

  if (prefs.types.verseOfDay) {
    const v = verseOfDay();
    items.push({ kind: 'verseOfDay', icon: '📖', title: `Verset du jour — ${v.ref}`, body: v.text, view: 'bible' });
  }
  if (prefs.types.pepites) {
    const seen = new Set(db.data.pepiteViews.filter(v => v.userId === uid).map(v => v.pepiteId));
    const since = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const fresh = PEPITES.filter(p => p.addedAt && p.addedAt >= since && !seen.has(p.id));
    if (fresh.length) {
      items.push({ kind: 'pepites', icon: '✨', title: `${fresh.length} nouvelle${fresh.length > 1 ? 's' : ''} pépite${fresh.length > 1 ? 's' : ''}`, body: fresh.slice(0, 3).map(p => p.title).join(' · '), view: 'pepites' });
    }
  }
  if (prefs.types.missions) {
    const pending = habits.filter(h => !h.doneDates.includes(today));
    const goals = db.data.goals.filter(g => g.userId === uid && g.status === 'active');
    if (pending.length) {
      items.push({ kind: 'missions', icon: '✅', title: `${pending.length} habitude${pending.length > 1 ? 's' : ''} à faire aujourd'hui`, body: pending.slice(0, 3).map(h => h.title).join(' · '), view: 'habits' });
    } else if (goals.length) {
      items.push({ kind: 'missions', icon: '🎯', title: 'Ta mission du jour t\'attend', body: goals.slice(0, 2).map(g => g.title).join(' · '), view: 'daily' });
    }
  }
  if (prefs.types.verses) {
    const due = db.data.bibleMemorization.filter(m => m.userId === uid).map(computeStatus).filter(m => m.isDue);
    if (due.length) {
      items.push({ kind: 'verses', icon: '🧠', title: `${due.length} verset${due.length > 1 ? 's' : ''} à réviser`, body: due.slice(0, 3).map(m => m.ref).join(' · '), view: 'bible' });
    }
    const study = studyDue(uid);
    const cards = study.reduce((n, x) => n + x.due, 0);
    if (cards) {
      items.push({ kind: 'study', icon: '📝', title: `${cards} fiche${cards > 1 ? 's' : ''} de révision à revoir`, body: study.slice(0, 3).map(x => `${x.title} (${x.due})`).join(' · '), view: 'study' });
    }
  }
  if (prefs.types.streak) {
    const streak = computeStreak(habits);
    const doneToday = habits.some(h => h.doneDates.includes(today));
    if (streak > 0 && !doneToday) {
      items.push({ kind: 'streak', icon: '🔥', title: `Ta série de ${streak} jour${streak > 1 ? 's' : ''} est en danger`, body: 'Fais au moins une habitude aujourd\'hui pour la garder.', view: 'habits' });
    }
  }
  return items;
}

// --- Web Push ---
let vapidReady = false;
export async function getVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  // Ne relit la base que si elle n'est pas encore chargée : une relecture au
  // milieu de runNotificationCron effacerait les marqueurs « déjà envoyé ».
  if (!db.data) await db.read();
  if (!db.data.appConfig.vapid) {
    db.data.appConfig.vapid = webpush.generateVAPIDKeys();
    await db.write();
  }
  return db.data.appConfig.vapid;
}
async function ensureVapid() {
  if (vapidReady) return;
  const keys = await getVapidKeys();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@better-man-ai.app', keys.publicKey, keys.privateKey);
  vapidReady = true;
}

// Envoie à tous les appareils d'un utilisateur ; retire les abonnements expirés.
export async function sendPushToUser(uid, payload) {
  await ensureVapid();
  const subs = db.data.pushSubscriptions.filter(s => s.userId === uid);
  let sent = 0;
  const expired = new Set();
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 6 * 3600 });
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) expired.add(s.id);
      else console.error(`[notifications] envoi échoué (${err.statusCode || err.message})`);
    }
  }
  if (expired.size) db.data.pushSubscriptions = db.data.pushSubscriptions.filter(s => !expired.has(s.id));
  return { sent, expired: expired.size, devices: subs.length };
}

function digestPayload(items) {
  const main = items[0];
  return {
    title: items.length === 1 ? `${main.icon} ${main.title}` : `Better Man AI — ${items.length} rappels`,
    body: items.length === 1 ? main.body : items.map(i => `${i.icon} ${i.title}`).join('\n'),
    view: main.view,
    tag: 'daily-digest'
  };
}

// Passe en revue les utilisateurs abonnés et envoie ce qui est dû maintenant.
export async function runNotificationCron(now = new Date()) {
  await db.read();
  await ensureVapid();
  const userIds = [...new Set(db.data.pushSubscriptions.map(s => s.userId))];
  const report = { users: userIds.length, digests: 0, streaks: 0 };
  let changed = false;

  for (const uid of userIds) {
    const user = db.data.users.find(u => u.id === uid);
    if (!user || !user.active) continue;
    const prefs = getPrefs(user);
    const local = localNow(prefs.tz, now);
    const state = user.notifState || (user.notifState = {});
    const delay = minutes(local.time) - minutes(prefs.time);

    if (state.digest !== local.date && delay >= 0 && delay <= LATE_LIMIT_MIN) {
      const items = computeItems(uid, prefs).filter(i => i.kind !== 'streak');
      state.digest = local.date;
      changed = true;
      if (items.length) {
        const r = await sendPushToUser(uid, digestPayload(items));
        if (r.sent) report.digests++;
      }
    }
    const streakDelay = minutes(local.time) - minutes(STREAK_HOUR);
    if (prefs.types.streak && state.streak !== local.date && streakDelay >= 0 && streakDelay <= LATE_LIMIT_MIN) {
      const danger = computeItems(uid, { types: { streak: true } })[0];
      state.streak = local.date;
      changed = true;
      if (danger) {
        const r = await sendPushToUser(uid, { title: `${danger.icon} ${danger.title}`, body: danger.body, view: danger.view, tag: 'streak' });
        if (r.sent) report.streaks++;
      }
    }
  }
  // Écrit aussi quand des abonnements expirés ont été retirés pendant l'envoi.
  if (changed || userIds.length) await db.write();
  return report;
}
