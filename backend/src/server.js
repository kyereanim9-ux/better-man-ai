import 'dotenv/config';
import { app } from './app.js';
import { initDB } from './db.js';
import { runNotificationCron } from './modules/notifications/service.js';

const PORT = process.env.PORT || 4000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Better Man AI démarré sur http://localhost:${PORT} (frontend + API sur le même port)`);
  });
  // Serveur classique (local, Render...) : envoi des rappels toutes les 5 min.
  // Sur Vercel (serverless), c'est la tâche GitHub Actions qui s'en charge.
  // Pas quand ce serveur ne fait que rediriger vers la nouvelle adresse
  // (REDIRECT_TO) : il écrirait dans la même base en même temps que la vraie app.
  if (!process.env.REDIRECT_TO) {
    setInterval(() => runNotificationCron().catch(e => console.error('[notifications]', e.message)), 5 * 60 * 1000);
  }
});
