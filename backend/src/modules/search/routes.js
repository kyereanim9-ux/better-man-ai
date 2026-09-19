import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { performSearch } from './searchProvider.js';

const router = Router();
router.use(requireAuth);

// Distingue toujours clairement INFORMATION TROUVÉE (citée, avec source) et
// ANALYSE (commentaire de l'app) — jamais l'inverse, et jamais de source inventée.
router.post('/query', async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'Requête de recherche vide.' });

  const result = await performSearch(query);
  res.json({
    query: result.query,
    hasInternetAccess: result.hasInternetAccess,
    informationTrouvee: result.results,
    note: result.note
  });
});

router.get('/status', (req, res) => {
  const provider = process.env.SEARCH_PROVIDER || 'local';
  res.json({
    provider,
    configured: provider !== 'local' && !!process.env.SEARCH_API_KEY
  });
});

export default router;
