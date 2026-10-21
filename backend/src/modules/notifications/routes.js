import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import {
  NOTIF_TYPES, getPrefs, sanitizePrefs, computeItems, getVapidKeys, sendPushToUser, runNotificationCron
} from './service.js';

const router = Router();

// Envoi programmé, appelé toutes les 15 min (GitHub Actions) ou par le
// minuteur local. Sans danger s'il est appelé plus souvent : chaque rappel
// part au plus une fois par jour. Si CRON_SECRET est défini, il est exigé.
async function cron(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.get('x-cron-secret') !== secret && req.query.key !== secret) {
    return res.status(401).json({ error: 'Clé invalide.' });
  }
  res.json(await runNotificationCron());
}
router.post('/cron', cron);
router.get('/cron', cron);

router.use(requireAuth);

const currentUser = (req) => db.data.users.find(u => u.id === req.user.id);

// Rappels pour la cloche + préférences + état des notifications push.
router.get('/', async (req, res) => {
  await db.read();
  const user = currentUser(req);
  const prefs = getPrefs(user);
  const keys = await getVapidKeys();
  res.json({
    items: computeItems(req.user.id, prefs),
    prefs,
    types: Object.fromEntries(Object.entries(NOTIF_TYPES).map(([k, v]) => [k, v.label])),
    push: { publicKey: keys.publicKey, devices: db.data.pushSubscriptions.filter(s => s.userId === req.user.id).length }
  });
});

router.put('/prefs', async (req, res) => {
  await db.read();
  const user = currentUser(req);
  const prefs = sanitizePrefs(req.body, getPrefs(user));
  // Changer l'heure permet de recevoir le rappel du jour à la nouvelle heure.
  if (user.notifPrefs?.time !== prefs.time && user.notifState) delete user.notifState.digest;
  user.notifPrefs = prefs;
  await db.write();
  res.json(prefs);
});

router.post('/subscribe', async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) {
    return res.status(400).json({ error: 'Abonnement invalide.' });
  }
  await db.read();
  // Le même appareil se réabonne : on remplace l'ancien enregistrement, y
  // compris celui créé depuis une autre adresse de l'app (même personne, même
  // navigateur), sinon chaque rappel arriverait en double sur le téléphone.
  const userAgent = String(req.get('user-agent') || '').slice(0, 200);
  db.data.pushSubscriptions = db.data.pushSubscriptions.filter(s =>
    s.endpoint !== sub.endpoint && !(s.userId === req.user.id && userAgent && s.userAgent === userAgent));
  db.data.pushSubscriptions.push({
    id: nanoid(), userId: req.user.id, endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    userAgent, createdAt: new Date().toISOString()
  });
  const user = currentUser(req);
  if (req.body.tz && !user.notifPrefs) user.notifPrefs = sanitizePrefs({ tz: req.body.tz }, getPrefs(user));
  await db.write();
  res.status(201).json({ ok: true });
});

router.post('/unsubscribe', async (req, res) => {
  await db.read();
  db.data.pushSubscriptions = db.data.pushSubscriptions.filter(s => !(s.userId === req.user.id && s.endpoint === req.body?.endpoint));
  await db.write();
  res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  await db.read();
  const user = currentUser(req);
  const items = computeItems(req.user.id, getPrefs(user));
  const r = await sendPushToUser(req.user.id, {
    title: '🔔 Notifications activées',
    body: items.length ? `Exemple de rappel : ${items[0].icon} ${items[0].title}` : 'Tu recevras tes rappels à l\'heure choisie.',
    view: items[0]?.view || 'daily', tag: 'test'
  });
  await db.write();
  if (!r.devices) return res.status(400).json({ error: 'Aucun appareil abonné. Active d\'abord les notifications sur cet appareil.' });
  res.json(r);
});

export default router;
