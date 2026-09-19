import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'express-async-errors'; // laisse Express attraper les erreurs async des routes automatiquement

import authRoutes from './modules/auth/routes.js';
import usersRoutes from './modules/users/routes.js';
import adminRoutes from './modules/admin/routes.js';
import chatRoutes from './modules/chat/routes.js';
import journalRoutes from './modules/journal/routes.js';
import habitsRoutes from './modules/habits/routes.js';
import goalsRoutes from './modules/goals/routes.js';
import dailyRoutes from './modules/daily/routes.js';
import bibleRoutes from './modules/bible/routes.js';
import progressRoutes from './modules/progress/routes.js';
import situationsRoutes from './modules/situations/routes.js';
import onboardingRoutes from './modules/onboarding/routes.js';
import domainsRoutes from './modules/domains/routes.js';
import gamificationRoutes from './modules/gamification/routes.js';
import communicationRoutes from './modules/communication/routes.js';
import financeRoutes from './modules/finance/routes.js';
import metaRoutes from './modules/meta/routes.js';
import privacyRoutes from './modules/privacy/routes.js';
import libraryRoutes from './modules/library/routes.js';
import videosRoutes from './modules/videos/routes.js';
import teachRoutes from './modules/teach/routes.js';
import learningRoutes from './modules/learning/routes.js';
import searchRoutes from './modules/search/routes.js';
import intimacyRoutes from './modules/intimacy/routes.js';
import physiqueRoutes from './modules/physique/routes.js';
import styleRoutes from './modules/style/routes.js';
import adaptationRoutes from './modules/adaptation/routes.js';

export const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/daily', dailyRoutes);
app.use('/api/bible', bibleRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/situations', situationsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/domains', domainsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/teach', teachRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/intimacy', intimacyRoutes);
app.use('/api/physique', physiqueRoutes);
app.use('/api/style', styleRoutes);
app.use('/api/adaptation', adaptationRoutes);

// Résolution du dossier frontend, avec gestion d'erreur explicite pour ne
// jamais planter la fonction si un chemin est introuvable en serverless.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let frontendDir;
try {
  const fsMod = await import('fs');
  const devFrontendDir = path.join(__dirname, '..', '..', 'frontend');
  const publicDir = path.join(__dirname, '..', 'public');
  frontendDir = fsMod.existsSync(devFrontendDir) ? devFrontendDir : publicDir;
  if (!fsMod.existsSync(frontendDir)) frontendDir = null;
} catch {
  frontendDir = null;
}

if (frontendDir) {
  app.use(express.static(frontendDir));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'), (err) => {
      if (err) res.status(500).json({ error: 'Frontend introuvable sur le serveur.' });
    });
  });
} else {
  app.get(/^(?!\/api).*/, (req, res) => {
    res.status(500).json({ error: 'Dossier frontend introuvable dans le déploiement (public/ non inclus).' });
  });
}

// Gestion d'erreur générique (évite de crasher le serveur sur une erreur inattendue)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur interne.' });
});
