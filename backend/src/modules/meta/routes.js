import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

// Historique des versions. Mets à jour cette liste à chaque nouvelle phase :
// c'est ce que l'écran "What's New" affiche à l'utilisateur.
const VERSIONS = [
  {
    version: '0.7.0',
    date: '2026-09-18',
    title: 'Phase 7 — Physique, Style, Adaptation automatique',
    features: [
      "Physique : mesures (poids, tour de taille) avec tendance sur 30 jours, journal d'entraînements, objectifs progressifs 30j/60j/90j/6mois/1an",
      "Style et présentation : 8 domaines de réflexion, détection des angles morts (domaines jamais notés)",
      "Adaptation automatique : analyse à la demande détectant habitudes à durcir/alléger, domaines négligés, objectifs anciens à réévaluer, surcharge, semaines à forte friction"
    ],
    fixes: ["Adaptation automatique : le déclencheur \"réduire la charge\" ignorait à tort les habitudes de moins de 14 jours au lieu de 7"],
    improvements: []
  },
  {
    version: '0.6.0',
    date: '2026-09-18',
    title: 'Phase 6 — IA locale, meilleures voix, audio continu, intimité 18+',
    features: [
      "IA locale via Ollama, avec repli propre si non disponible",
      "Sélecteur de voix pour la lecture audio, préférence sauvegardée",
      "Lecture audio continue des livres avec reprise de position",
      "Section Intimité 18+ avec double confirmation d'accès (âge + consentement), 6 sujets éducatifs, journal privé dédié",
      "Base de données PostgreSQL optionnelle, pour un hébergement serverless (Vercel...)"
    ],
    fixes: [
      "Un compte supprimé ou désactivé gardait un token JWT valide jusqu'à 30 jours — corrigé",
      "La suppression de compte oubliait plusieurs collections récentes — centralisé dans purgeUserData()",
      "Le repli du coach IA affichait [object Promise] au lieu du message de secours"
    ],
    improvements: []
  },
  {
    version: '0.5.0',
    date: '2026-09-17',
    title: 'Phase 5 — Recherche web, EPUB/DOCX, statut système',
    features: [
      "Recherche web avec citation systématique des sources (nécessite une clé API gratuite Brave Search, sinon message honnête indiquant l'absence d'accès Internet)",
      "Séparation stricte INFORMATION TROUVÉE / ANALYSE sur les résultats de recherche",
      "Bibliothèque : support EPUB et DOCX (en plus de PDF et TXT)",
      "Statut système pour l'administrateur (version, uptime, volumétrie des données)"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.4.0',
    date: '2026-09-17',
    title: 'Phase 4 — Bibliothèque, vidéothèque, Teach Me, learning engine',
    features: [
      "Bibliothèque personnelle : ajoute un livre (texte collé, PDF ou TXT), avec résumé, mots-clés et flashcards générés localement",
      "Suivi de la position de lecture par livre",
      "Vidéothèque : ajoute une vidéo (lien) avec transcription optionnelle pour générer résumé/flashcards/quiz",
      "Teach Me : programme progressif en 5 niveaux pour n'importe quel sujet (fondations → maîtrise)",
      "Learning engine : auto-évaluation facile/moyen/difficile, sujets à réviser vs maîtrisés"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.3.0',
    date: '2026-09-17',
    title: 'Phase 3 — Situation réelle, domaines, gamification, communication, finances',
    features: [
      "Mode Situation réelle : décris une situation vécue, reçois des questions de réflexion et une action concrète",
      "Détection de schémas répétitifs sur tes situations (30 derniers jours)",
      "Questionnaire de profil personnel (onboarding)",
      "Scores de progression par domaine de vie (aujourd'hui / semaine / mois / depuis le début)",
      "Gamification : XP, niveaux (7 paliers), badges, streaks",
      "Communication : suggestions de réponse (6 tons) et analyse de conversation",
      "Coach financier : transactions, résumé mensuel, objectifs d'épargne",
      "Export et suppression de tes propres données"
    ],
    fixes: [],
    improvements: ["Les habitudes et objectifs sont désormais rattachés à un domaine de vie"]
  },
  {
    version: '0.2.0',
    date: '2026-09-17',
    title: 'Phase 2 — Bible, mémorisation, voix, progression',
    features: [
      "Espace Bible (verset/lecture/question du jour, recherche, quiz)",
      "Mémorisation biblique par répétition espacée",
      "Lecture à voix haute (Web Speech API)",
      "Revue hebdomadaire et détection de tendances dans le journal"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.1.0',
    date: '2026-09-17',
    title: 'Phase 1 — MVP',
    features: [
      "Authentification, profils, séparation des données par utilisateur",
      "Dashboard, AI Coach, objectifs, habitudes, daily missions, journal",
      "Espace administrateur"
    ],
    fixes: [],
    improvements: []
  }
];

router.get('/whats-new', (req, res) => {
  res.json(VERSIONS);
});

const APP_VERSION = VERSIONS[0].version;
const START_TIME = Date.now();

// Statut système simple pour l'administrateur : version, disponibilité,
// volumétrie. Sert de socle honnête au "système de mise à jour" du cahier
// des charges (pas de déploiement auto, mais une visibilité claire sur l'état
// de l'app avant toute mise à jour manuelle).
router.get('/system-status', requireAdmin, async (req, res) => {
  await db.read();
  res.json({
    version: APP_VERSION,
    nodeVersion: process.version,
    uptimeSeconds: Math.round((Date.now() - START_TIME) / 1000),
    counts: {
      users: db.data.users.length,
      journalEntries: db.data.journalEntries.length,
      habits: db.data.habits.length,
      goals: db.data.goals.length,
      situations: db.data.situations.length,
      libraryItems: db.data.libraryItems.length,
      videos: db.data.videos.length
    }
  });
});

export default router;
