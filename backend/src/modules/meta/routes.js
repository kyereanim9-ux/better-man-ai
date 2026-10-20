import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { db } from '../../db.js';

const router = Router();
router.use(requireAuth);

// Historique des versions. Mets à jour cette liste à chaque nouvelle phase :
// c'est ce que l'écran "What's New" affiche à l'utilisateur.
const VERSIONS = [
  {
    version: '0.12.1',
    date: '2026-10-20',
    title: '8 nouvelles pépites',
    features: ["8 nouvelles pépites : Paternité (2), Gestion du temps (2), Pour les hommes, Soutenir les femmes, Amitié et Travail"],
    fixes: [],
    improvements: []
  },
  {
    version: '0.12.0',
    date: '2026-10-19',
    title: 'Mot de passe oublié',
    features: [
      "« Mot de passe oublié ? » sur la page de connexion : un lien valable 1 heure est envoyé à l'email du compte pour choisir un nouveau mot de passe",
      "Admin : bouton « 🔑 Lien mot de passe » pour générer ce lien et l'envoyer soi-même (SMS, WhatsApp…)"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.11.2',
    date: '2026-10-19',
    title: 'Coach IA réparé et une seule adresse',
    features: [],
    fixes: [
      "Coach IA : Gemini ne répondait plus (modèle retiré par Google, erreur 404) — utilise maintenant toujours le modèle Gemini actuel",
      "Analyse photo et repas : même correction (l'ancien modèle Gemini 1.5 n'existait plus)",
      "Rappels du matin : envoyés de nouveau (l'envoi n'appelait pas la bonne adresse)"
    ],
    improvements: ["L'ancienne adresse de l'app renvoie automatiquement vers la nouvelle : rien à changer sur les téléphones"]
  },
  {
    version: '0.11.1',
    date: '2026-10-19',
    title: '8 nouvelles pépites',
    features: ["8 nouvelles pépites : Paternité (3), Gestion du temps (2), Travail (2) et Amitié"],
    fixes: [],
    improvements: []
  },
  {
    version: '0.11.0',
    date: '2026-10-18',
    title: 'Réglages rangés, titres de l\'Apocalypse et apparence plus soignée',
    features: [
      "La liste « 22e examen de vérification de scellage — Titres de l'Apocalypse » est disponible pour tout le monde dans 📝 Révisions",
      "Les listes de révision sont visibles par tous les utilisateurs de l'app (ou privées au choix), avec un classement de ceux qui révisent"
    ],
    fixes: [
      "Associer : deux cartes avec la même réponse (Apocalypse 2 et 3) sont toutes les deux acceptées",
      "Bilan du soir : les champs s'affichaient en colonnes très étroites"
    ],
    improvements: [
      "Réglages réorganisés : une liste claire (Notifications, Apparence, Langue, Menu, Verrouillage, Données) qui ouvre chaque rubrique séparément",
      "Police Inter et fond qui couvre tout l'écran pour un rendu plus professionnel"
    ]
  },
  {
    version: '0.10.0',
    date: '2026-10-18',
    title: 'Révisions : apprendre pour ses tests, en groupe',
    features: [
      "Nouvelle rubrique 📝 Révisions : colle ta liste (une ligne = question | réponse), avec la date du test et un compte à rebours",
      "« Préremplir les chapitres » d'un livre de la Bible (ex. Apocalypse 1 à 22) : il ne reste qu'à écrire les titres",
      "8 méthodes : à revoir aujourd'hui (répétition espacée), cartes à retourner, écrire ou dicter au micro, QCM, associer, examen blanc noté sur 20, écoute à voix haute, fiche à réponses cachées",
      "Réponses écrites vérifiées avec tolérance (accents, petits mots, fautes de frappe) et mots manquants surlignés",
      "Astuce personnelle sur chaque carte (image, mot-clé…) et guide des méthodes de mémorisation",
      "Partage au groupe avec un code : chacun a sa progression, avec un classement",
      "Les rappels « Versets à réviser » comptent aussi les fiches à revoir"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.9.11',
    date: '2026-10-18',
    title: 'Nouveau logo : Sommet et étoile',
    features: ["Nouveau logo de l'app sur l'écran d'accueil et dans l'onglet du navigateur : une montagne au sommet doré et une étoile"],
    fixes: [],
    improvements: []
  },
  {
    version: '0.9.10',
    date: '2026-10-18',
    title: 'Quiz biblique : un livre au choix (Apocalypse…)',
    features: ["Quiz biblique : nouvelle option « Un livre précis » — Apocalypse par défaut, ou n'importe lequel des 66 livres"],
    fixes: ["Quiz sur toute la Bible : évite les versets sans bon mot à cacher (généalogies, listes de noms)"],
    improvements: []
  },
  {
    version: '0.9.9',
    date: '2026-10-18',
    title: 'Récitation réparée, plans de lecture, versets favoris, pépites en mode lecture',
    features: [
      "Récitation : choix « À voix haute » ou « Par écrit », correction mot par mot (vert/rouge) et validation de l'étape à partir de 80 %",
      "Plans de lecture : Bible en 1 an, Nouveau Testament en 90 jours, Évangiles en 30 jours, Psaumes en 60 jours, Proverbes en 31 jours, avec progression",
      "Versets favoris ⭐ avec une note personnelle sur chaque verset",
      "Pépites en mode lecture : une pépite à la fois en plein écran, glisser pour passer à la suivante",
      "Note personnelle « ce que j'en retiens » sur chaque pépite gardée, rappelée pendant la révision"
    ],
    fixes: [
      "Récitation : la reconnaissance vocale écoute toujours en français (elle suivait la langue de l'app), ne plante plus en appuyant deux fois sur Démarrer, fonctionne mieux sur Android",
      "Messages clairs quand la reconnaissance vocale est indisponible (iPhone : activer la Dictée, pas d'Internet, micro refusé…)"
    ],
    improvements: []
  },
  {
    version: '0.9.8',
    date: '2026-10-18',
    title: 'Mes idées : micro réparé et amélioré',
    features: [
      "Dictée : « Dicter (voix → texte) » transforme ta voix en texte modifiable dans l'idée",
      "Jauge de niveau pendant l'enregistrement, compteur, arrêt automatique après 15 minutes",
      "Bouton « Télécharger » sur chaque enregistrement"
    ],
    fixes: [
      "Enregistrements au format MP4 quand le navigateur le permet (lisible partout, y compris sur iPhone) et stockage compatible Safari",
      "Messages d'erreur précis : micro refusé (avec la marche à suivre selon le téléphone), micro absent ou déjà utilisé, navigateur intégré d'une autre app",
      "Quitter « Mes idées » pendant un enregistrement le sauvegarde au lieu de laisser le micro ouvert"
    ],
    improvements: []
  },
  {
    version: '0.9.7',
    date: '2026-10-18',
    title: 'Notifications : cloche dans l\'app et rappels sur le téléphone',
    features: [
      "Cloche 🔔 en haut de l'écran avec compteur : verset du jour, nouvelles pépites, missions et habitudes, versets à réviser, série en danger",
      "Profil → Notifications : chacun choisit ses rappels (verset du jour et nouvelles pépites activés par défaut) et l'heure du rappel du jour",
      "Notifications push sur le téléphone, même app fermée (Android, ordinateur, iPhone avec l'app ajoutée à l'écran d'accueil)",
      "L'app peut être installée sur l'écran d'accueil (icône et plein écran)"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.9.6',
    date: '2026-10-18',
    title: 'Toute la Bible : recherche, lecture et mémorisation de n\'importe quel verset',
    features: [
      "Bible Louis Segond 1910 complète (66 livres, 31 170 versets, domaine public) intégrée à l'app, sans connexion à un service extérieur",
      "Recherche par référence (Jean 3:16, Ps 23, 1 Co 13:4-7, abréviations acceptées) ou par mots-clés, avec mots surlignés",
      "Lecteur par livre et chapitre, avec chapitre précédent/suivant et lecture audio",
      "Mémoriser n'importe quel verset ou passage (jusqu'à 10 versets), ou un verset d'une autre traduction en collant son texte",
      "Bouton « Lire le chapitre » sur le verset et la lecture du jour",
      "Quiz : nouvelle source « Toute la Bible »",
      "Mémorisation : barre de progression, étape x/6 et date de la prochaine révision"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.9.5',
    date: '2026-10-18',
    title: 'Quiz biblique interactif, exercices de mémorisation et pépites du jour',
    features: [
      "Quiz biblique : une case pour écrire sa réponse, vérification (accents, majuscules et petites fautes tolérés), indice, bonne réponse affichée avec le verset complet, score de la session, choix entre tous les versets ou ses versets en mémorisation",
      "Mémorisation : exercice « S'entraîner » avec mots à compléter (de plus en plus nombreux au fil des étapes), correction mot par mot, validation de l'étape à partir de 80 %",
      "8 nouvelles pépites (319 au total), dont un nouveau thème : Paternité"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.9.4',
    date: '2026-10-17',
    title: 'Nouvelle couleur : Bordeaux',
    features: ["Apparence : nouvelle couleur d'accent Bordeaux"],
    fixes: [],
    improvements: []
  },
  {
    version: '0.9.3',
    date: '2026-10-16',
    title: 'Pépites du jour — Travail, Gestion du temps, Amitié, Pour les hommes, Soutenir les femmes, Parler à tout le monde',
    features: [
      "8 nouvelles pépites (311 au total), dont un nouveau thème : Gestion du temps"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.9.2',
    date: '2026-10-15',
    title: 'Pépites du jour — Amitié, Travail, Pour les hommes, Soutenir les femmes, Couple, Santé mentale',
    features: [
      "8 nouvelles pépites (303 au total), dont un nouveau thème : Travail"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.9.1',
    date: '2026-10-14',
    title: 'Pépites du jour — Amitié, Pour les hommes, Soutenir les femmes, Prendre soin de son corps',
    features: [
      "8 nouvelles pépites (295 au total), dont un nouveau thème : Amitié"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.9.0',
    date: '2026-10-13',
    title: 'Coach IA avec Claude + Pépites Confiance en soi et Surmonter les difficultés',
    features: [
      "Coach IA : Claude (Anthropic) devient le fournisseur prioritaire dès qu'une clé ANTHROPIC_API_KEY est configurée, avec repli automatique sur les fournisseurs gratuits puis le coach local",
      "40 nouvelles pépites (287 au total) : confiance en soi et surmonter les difficultés",
      "Nouveaux thèmes filtrables : Confiance en soi et Surmonter les difficultés"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.8.4',
    date: '2026-10-13',
    title: 'Pépites — Famille, Argent et Nouveautés',
    features: [
      "40 nouvelles pépites (247 au total) : famille (enfants, parents, traditions, héritage) et argent (budget, dettes, épargne, générosité, arnaques)",
      "Nouveaux thèmes filtrables : Famille et Argent",
      "Badge « 🆕 Nouveau » et filtre « Nouveautés » pour les pépites ajoutées ces 7 derniers jours"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.8.3',
    date: '2026-10-13',
    title: 'Pépites — Bible et Leadership',
    features: [
      "40 nouvelles pépites (207 au total) : comment lire et étudier la Bible, leçons de personnages bibliques, et leadership (serviteur, délégation, responsabilité, former d'autres leaders...)",
      "Nouveaux thèmes filtrables : Bible et Leadership"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.8.2',
    date: '2026-10-13',
    title: 'Pépites — Foi et Prière',
    features: [
      "41 nouvelles pépites sur la foi et la prière (167 au total), chacune avec sa référence biblique",
      "Nouveaux thèmes filtrables : Foi et Prière"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.8.1',
    date: '2026-10-13',
    title: 'Pépites — 62 nouvelles idées et filtres par thème',
    features: [
      "62 nouvelles pépites (126 au total) : écouter sans juger, parler à tout le monde, santé mentale, organiser ses pensées, prendre soin de son corps, pour les hommes, soutenir les femmes, couple",
      "Filtre par thème dans le fil des Pépites"
    ],
    fixes: [],
    improvements: []
  },
  {
    version: '0.8.0',
    date: '2026-10-13',
    title: 'Pépites — des idées puissantes en 1 minute',
    features: [
      "Pépites : 64 idées courtes (discipline, mental, émotions, couple, communication, physique, finances, travail, social, foi...), à lire en 1 minute",
      "Fil « Pour moi » qui met en avant tes domaines les moins travaillés ces 14 derniers jours",
      "Pépite du jour sur l'Accueil",
      "Collections : garde tes pépites préférées par thème",
      "Révision espacée des pépites gardées (J1 → J3 → J7 → J14 → J30 → maîtrisée)",
      "Passer à l'action : transforme une pépite en habitude ou en objectif en un clic",
      "Crée tes propres pépites, ou extrais-les d'un livre de ta bibliothèque",
      "Écoute audio et partage de chaque pépite"
    ],
    fixes: [],
    improvements: []
  },
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
