import 'dotenv/config';
import { app } from './app.js';
import { initDB } from './db.js';

const PORT = process.env.PORT || 4000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Better Man AI démarré sur http://localhost:${PORT} (frontend + API sur le même port)`);
  });
});
