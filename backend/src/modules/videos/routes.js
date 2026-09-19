import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../../middleware/auth.js';
import { db } from '../../db.js';
import { extractiveSummary, keyTerms, generateFlashcards, generateComprehensionQuestions } from '../../shared/textTools.js';

const router = Router();
router.use(requireAuth);

// Cette app ne télécharge ni ne transcrit automatiquement de vidéo (ça
// nécessiterait un service payant ou un modèle lourd). L'utilisateur ajoute
// le lien et colle lui-même la transcription s'il en a une (YouTube en propose
// une via "Afficher la transcription"), ce qui débloque résumé/flashcards/quiz.
router.post('/', async (req, res) => {
  const { title, url, transcript } = req.body;
  if (!title?.trim() || !url?.trim()) return res.status(400).json({ error: 'Titre et lien requis.' });

  await db.read();
  const video = {
    id: nanoid(), userId: req.user.id, title, url, transcript: transcript || '',
    createdAt: new Date().toISOString()
  };
  db.data.videos.push(video);
  await db.write();
  res.status(201).json(video);
});

router.get('/', async (req, res) => {
  await db.read();
  const list = db.data.videos
    .filter(v => v.userId === req.user.id)
    .map(v => ({ id: v.id, title: v.title, url: v.url, hasTranscript: !!v.transcript, createdAt: v.createdAt }));
  res.json(list);
});

router.get('/:id', async (req, res) => {
  await db.read();
  const video = db.data.videos.find(v => v.id === req.params.id && v.userId === req.user.id);
  if (!video) return res.status(404).json({ error: 'Vidéo introuvable.' });
  res.json(video);
});

router.patch('/:id/transcript', async (req, res) => {
  const { transcript } = req.body;
  await db.read();
  const video = db.data.videos.find(v => v.id === req.params.id && v.userId === req.user.id);
  if (!video) return res.status(404).json({ error: 'Vidéo introuvable.' });
  video.transcript = transcript || '';
  await db.write();
  res.json(video);
});

router.delete('/:id', async (req, res) => {
  await db.read();
  const before = db.data.videos.length;
  db.data.videos = db.data.videos.filter(v => !(v.id === req.params.id && v.userId === req.user.id));
  if (db.data.videos.length === before) return res.status(404).json({ error: 'Vidéo introuvable.' });
  await db.write();
  res.json({ ok: true });
});

router.get('/:id/study-pack', async (req, res) => {
  await db.read();
  const video = db.data.videos.find(v => v.id === req.params.id && v.userId === req.user.id);
  if (!video) return res.status(404).json({ error: 'Vidéo introuvable.' });
  if (!video.transcript.trim()) {
    return res.status(400).json({ error: "Aucune transcription associée à cette vidéo. Ajoute-la pour générer résumé/flashcards/quiz." });
  }

  const summarySentences = extractiveSummary(video.transcript, 5);
  res.json({
    summary: summarySentences,
    keyTerms: keyTerms(video.transcript, 10),
    flashcards: generateFlashcards(video.transcript, 5),
    questions: generateComprehensionQuestions(summarySentences),
    note: "Généré à partir de la transcription que tu as fournie, par simple analyse de fréquence — pas une vraie compréhension du contenu."
  });
});

export default router;
