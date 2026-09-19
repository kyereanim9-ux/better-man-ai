// Copie ../frontend vers ./public au moment du build, pour que Vercel (qui
// ne connaît que ce dossier backend/, pas le dépôt entier) ait accès au
// frontend statique. Sans effet en usage local : server.js sert directement
// depuis ../frontend quand ce dossier existe (voir src/app.js).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', '..', 'frontend');
const dest = path.join(__dirname, '..', 'public');

if (!fs.existsSync(src)) {
  console.log('Pas de dossier frontend/ trouvé à côté de backend/ — rien à copier (normal si déployé depuis backend/ seul).');
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Frontend copié de ${src} vers ${dest}`);
