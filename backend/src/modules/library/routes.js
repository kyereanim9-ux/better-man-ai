import { Router } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { extractiveSummary, keyTerms, generateFlashcards, generateComprehensionQuestions } from '../../shared/textTools.js';
import { extractEpubText } from '../../shared/epubExtract.js';

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// IMPORTANT : n'accepte que des fichiers que l'utilisateur a légalement le
// droit d'utiliser. L'app ne télécharge jamais de livre protégé par
// copyright depuis Internet — l'utilisateur fournit toujours le contenu lui-même.

// Upload direct de texte (copier-coller, ou fichier .txt déjà lu côté client).
router.post('/books/text', async (req, res) => {
  const { title, author, text } = req.body;
  if (!title?.trim() || !text?.trim()) return res.status(400).json({ error: 'Titre et contenu requis.' });

  await db.read();
  const book = {
    id: nanoid(), userId: req.user.id, title, author: author || '',
    type: 'txt', text, position: 0, createdAt: new Date().toISOString()
  };
  db.data.libraryItems.push(book);
  await db.write();
  res.status(201).json(toSummaryView(book));
});

// Upload de fichier (PDF ou TXT). EPUB/DOCX pas encore supportés (voir ROADMAP).
router.post('/books/upload', upload.single('file'), async (req, res) => {
  const { title, author } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
  if (!title?.trim()) return res.status(400).json({ error: 'Titre requis.' });

  const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
  let text = '';
  const type = ext;

  try {
    if (ext === 'pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text;
    } else if (ext === 'txt') {
      text = req.file.buffer.toString('utf-8');
    } else if (ext === 'epub') {
      text = await extractEpubText(req.file.buffer);
    } else if (ext === 'docx') {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else {
      return res.status(400).json({ error: `Format ".${ext}" pas encore supporté. Formats acceptés : PDF, TXT, EPUB, DOCX.` });
    }
  } catch (e) {
    return res.status(400).json({ error: `Impossible de lire ce fichier (${e.message || 'peut-être corrompu ou protégé'}).` });
  }

  if (!text.trim()) return res.status(400).json({ error: 'Aucun texte extrait de ce fichier.' });

  await db.read();
  const book = {
    id: nanoid(), userId: req.user.id, title, author: author || '',
    type, text, position: 0, createdAt: new Date().toISOString()
  };
  db.data.libraryItems.push(book);
  await db.write();
  res.status(201).json(toSummaryView(book));
});

function toSummaryView(book) {
  return {
    id: book.id, title: book.title, author: book.author, type: book.type,
    length: book.text.length, position: book.position, createdAt: book.createdAt
  };
}

router.get('/books', async (req, res) => {
  await db.read();
  res.json(db.data.libraryItems.filter(b => b.userId === req.user.id).map(toSummaryView));
});

router.get('/books/:id', async (req, res) => {
  await db.read();
  const book = db.data.libraryItems.find(b => b.id === req.params.id && b.userId === req.user.id);
  if (!book) return res.status(404).json({ error: 'Livre introuvable.' });
  res.json(book); // inclut le texte complet, pour l'affichage de lecture
});

router.patch('/books/:id/position', async (req, res) => {
  const { position } = req.body;
  await db.read();
  const book = db.data.libraryItems.find(b => b.id === req.params.id && b.userId === req.user.id);
  if (!book) return res.status(404).json({ error: 'Livre introuvable.' });
  book.position = Math.max(0, Math.min(book.text.length, Number(position) || 0));
  await db.write();
  res.json(toSummaryView(book));
});

router.delete('/books/:id', async (req, res) => {
  await db.read();
  const before = db.data.libraryItems.length;
  db.data.libraryItems = db.data.libraryItems.filter(b => !(b.id === req.params.id && b.userId === req.user.id));
  if (db.data.libraryItems.length === before) return res.status(404).json({ error: 'Livre introuvable.' });
  await db.write();
  res.json({ ok: true });
});

// --- Outils d'apprentissage générés localement (résumé, mots-clés, flashcards, quiz) ---

router.get('/books/:id/study-pack', async (req, res) => {
  await db.read();
  const book = db.data.libraryItems.find(b => b.id === req.params.id && b.userId === req.user.id);
  if (!book) return res.status(404).json({ error: 'Livre introuvable.' });

  const summarySentences = extractiveSummary(book.text, 5);
  res.json({
    summary: summarySentences,
    keyTerms: keyTerms(book.text, 10),
    flashcards: generateFlashcards(book.text, 5),
    questions: generateComprehensionQuestions(summarySentences),
    note: "Résumé et mots-clés générés par une simple analyse de fréquence, pas par une vraie compréhension du texte. Utile comme point de départ, pas comme substitut à la lecture."
  });
});

export default router;
