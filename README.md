# Better Man AI — Phase 1

Coach personnel intelligent. Ce dépôt contient la **Phase 1** telle que définie
dans le cahier des charges : authentification, profils, dashboard, AI Coach
(chat), objectifs, habitudes, daily missions, journal.

Coût actuel : **0 €**. Tout tourne en local avec des outils gratuits/open source.

---

## 1. Structure du projet

```
better-man-ai/
├── backend/                  → API (Node.js + Express)
│   ├── src/
│   │   ├── server.js         → point d'entrée
│   │   ├── db.js             → couche base de données (LowDB, remplaçable)
│   │   ├── middleware/auth.js
│   │   └── modules/
│   │       ├── auth/         → inscription / connexion
│   │       ├── users/        → profil utilisateur
│   │       ├── admin/        → gestion des comptes (sans accès au contenu privé)
│   │       ├── chat/         → conversations privées + AI Coach
│   │       ├── coach/        → interface AIProvider (local, gratuit) + providers/
│   │       ├── journal/
│   │       ├── habits/       → habitudes (avec domaine de vie optionnel)
│   │       ├── goals/        → objectifs (par domaine de vie)
│   │       ├── daily/        → génère la mission du jour
│   │       ├── bible/        → verset/lecture/question du jour, mémorisation
│   │       ├── progress/     → revue hebdo/mensuelle, tendances, graphiques
│   │       ├── situations/   → mode "Situation réelle" + schémas répétitifs
│   │       ├── onboarding/   → questionnaire de profil initial
│   │       ├── domains/      → scores de progression par domaine de vie
│   │       ├── gamification/ → XP, niveaux, badges, streaks
│   │       ├── communication/→ suggestions de réponse, analyse de conversation
│   │       ├── finance/      → transactions, résumé mensuel, épargne
│   │       ├── meta/         → historique des versions (What's New)
│   │       ├── privacy/      → export et suppression des données
│   │       ├── pepites/      → idées courtes à lire en 1 min (façon Deepstash)
│   │       ├── library/      → bibliothèque de livres (upload, résumé, flashcards)
│   │       ├── videos/       → vidéothèque (lien + transcription optionnelle)
│   │       ├── teach/        → "Teach Me" (programme progressif 5 niveaux)
│   │       ├── learning/     → learning engine (auto-évaluation, sujets à réviser)
│   │       ├── search/       → recherche web (interface SearchProvider remplaçable)
│   │       ├── intimacy/     → section 18+ (accès contrôlé, contenu éducatif, journal dédié)
│   │       ├── physique/     → mesures, entraînements, objectifs progressifs
│   │       ├── style/        → réflexion présentation personnelle (8 domaines)
│   │       └── adaptation/   → analyse à la demande, suggestions d'ajustement
│   ├── src/shared/           → utilitaires partagés entre modules (ex: détection de domaine)
│   ├── data/                 → fichier db.json (créé automatiquement, jamais commité)
│   ├── .env.example
│   └── package.json
└── frontend/                 → interface web simple (aucun outil de build requis)
    ├── index.html
    ├── style.css
    └── app.js
```

Chaque module backend est indépendant (`/auth`, `/users`, `/admin`, `/coach`,
`/chat`, `/journal`, `/habits`, `/goals`, `/daily`) : tu peux ajouter un
nouveau module (Bible, bibliothèque, vidéos...) en Phase 2/3 sans casser les
modules existants.

---

## 2. Installation

Prérequis : [Node.js](https://nodejs.org) version 18 ou plus (gratuit).

```bash
cd better-man-ai/backend
npm install
cp .env.example .env
```

Ouvre `.env` et vérifie que `JWT_SECRET` contient bien une chaîne longue et
aléatoire (change la valeur par défaut, surtout si tu déploies un jour en ligne).

---

## 3. Lancer le projet

Depuis `better-man-ai/backend` :

```bash
npm start
```

Tu dois voir : `Better Man AI démarré sur http://localhost:4000 (frontend + API sur le même port)`

Ouvre ensuite **http://localhost:4000** dans ton navigateur — le backend
sert directement le frontend, rien d'autre à lancer.

---

## 3bis. Obtenir un lien public temporaire (tunnel)

Pour que quelqu'un d'autre (ou toi depuis ton téléphone) accède à l'app en
dehors de ton réseau local, expose le port 4000 avec un tunnel gratuit.
Deux options simples :

**Avec ngrok** (https://ngrok.com, compte gratuit requis) :
```bash
ngrok http 4000
```
Le terminal affiche un lien du type `https://xxxx.ngrok-free.app` — c'est
ton lien public temporaire. Il change à chaque redémarrage du tunnel (sauf
domaine fixe sur un compte payant), et cesse de fonctionner dès que tu
arrêtes `ngrok` ou ton ordinateur.

**Avec Cloudflare Tunnel** (gratuit, sans compte pour un lien rapide) :
```bash
cloudflared tunnel --url http://localhost:4000
```
Fonctionne sur le même principe, lien affiché dans le terminal.

**Important** : ton ordinateur doit rester allumé et `npm start` doit
continuer de tourner pour que le lien reste actif. Pour un lien permanent
(sans dépendre de ta machine), il faut un vrai hébergement — voir la note
ci-dessous.

> Note sur un hébergement permanent : la base de données de cette app est un
> simple fichier JSON local (`data/db.json`), ce qui est parfait pour un
> usage local à 0 €, mais beaucoup d'hébergeurs gratuits (Render, etc.) ont
> un système de fichiers non-persistant qui effacerait ce fichier à chaque
> redémarrage. `backend/src/db.js` est conçu pour être remplacé par une vraie
> base hébergée (ex : Postgres gratuit sur Neon/Supabase) sans toucher au
> reste du code, si tu veux passer à un hébergement permanent plus tard.

---

## 4. Tester chaque fonctionnalité

1. **Créer un compte** : ouvre le frontend, onglet "Créer un compte". Le tout
   premier compte créé devient automatiquement **administrateur**.
2. **Dashboard / Daily** : après connexion, l'onglet "🔄 Daily" affiche ta
   mission du jour (vide au départ, se remplit avec tes habitudes/objectifs).
3. **AI Coach** : onglet "💬 Coach" → "+ Nouvelle conversation" → écris un
   message. Le coach répond en mode local (gratuit, basé sur des règles de
   coaching réflexif — voir section 6 ci-dessous pour brancher un vrai LLM).
4. **Journal** : onglet "📓 Journal", écris librement, enregistre.
5. **Habitudes** : onglet "✅ Habitudes", ajoute une habitude, marque-la
   "faite aujourd'hui".
6. **Objectifs** : onglet "🎯 Objectifs", ajoute un objectif avec une
   catégorie (émotionnel, relationnel, physique...).
7. **Admin** (visible uniquement si tu es le premier compte créé) : onglet
   "🛠️ Admin", tu vois la liste des comptes et peux activer/désactiver un
   compte — sans jamais voir le contenu privé (journal, chats) des autres
   utilisateurs.
8. **Isolation des données** : crée un deuxième compte dans un autre
   navigateur (ou onglet privé) et vérifie qu'il ne voit ni le journal, ni les
   habitudes, ni les conversations du premier compte.

---

## 5. Sécurité et séparation des données

- Chaque route (sauf `/auth/register` et `/auth/login`) exige un token JWT
  valide (`middleware/auth.js`).
- Chaque requête sur le journal, les habitudes, les objectifs et les
  conversations filtre systématiquement par `userId` — un utilisateur ne peut
  jamais lire ou modifier les données d'un autre.
- L'espace `/admin` est protégé par un rôle (`requireAdmin`) et ne renvoie que
  des métadonnées de compte (email, nom, rôle, actif/inactif) — jamais le
  contenu privé.
- Les mots de passe sont hashés avec bcrypt, jamais stockés en clair.

---

## 6. Remplacer le coach IA gratuit par un vrai modèle (plus tard)

Le fichier `backend/src/modules/coach/aiProvider.js` définit une interface
unique. Pour brancher un vrai modèle IA (Anthropic, ou un modèle local comme
Ollama) :

1. Crée un fichier dans `modules/coach/providers/` avec une fonction
   `async reply(messages, context) -> string`.
2. Ajoute-le dans le `switch` de `aiProvider.js`.
3. Change `AI_PROVIDER` dans `.env`.

Aucune autre partie de l'application (routes, frontend) n'a besoin de changer.
Un exemple d'intégration Anthropic est déjà présent en commentaire dans ce
fichier.

---

## 7. Ce qui n'est PAS encore fait (voir ROADMAP.md)

Automatisations et nouvelles intégrations restent hors scope pour une app
100% gratuite et auto-hébergée (voir ROADMAP.md pour le détail). En dehors de
ça, les 7 phases du cahier des charges initial sont couvertes.

---

## 8. Nouveautés Phase 2

- **📖 Bible** : verset/lecture/question du jour, recherche par thème,
  "Que dit la Bible sur X ?" (avec séparation stricte texte biblique /
  application), quiz à trous, mémorisation par répétition espacée.
  Le jeu de versets (Louis Segond 1910, domaine public) se trouve dans
  `backend/src/modules/bible/data/verses.json` — tu peux l'enrichir librement.
- **🔊 Lecture à voix haute** : bouton "Écouter" avec Play/Pause/Stop et
  vitesse (x0.75 à x2), basé sur la Web Speech API du navigateur (gratuite,
  fonctionne offline). Présent sur les versets, les réponses du coach et le
  journal. Si ton navigateur ne la supporte pas, un message discret
  l'indique à la place des boutons.
- **📈 Progression** : revue hebdomadaire automatique, tendances détectées
  dans le journal (comptage de mots-clés transparent, jamais un diagnostic),
  petit graphique en barres des habitudes sur 14 jours (CSS pur, aucune
  librairie externe).
- La mission du jour (`/api/daily`) inclut désormais les versets à réviser
  aujourd'hui, en plus des habitudes et objectifs.

---

## 9. Nouveautés Phase 3

- **🆘 Situation réelle** (fonctionnalité phare) : onglet "Situation".
  Décris exactement ce qui vient de se passer ("Je viens de me disputer avec
  ma copine..."), l'app détecte le(s) domaine(s) concerné(s), pose 3 à 5
  questions de réflexion, puis propose UNE action concrète — avant que tu
  répondes ou agisses. L'onglet "Schémas répétitifs" analyse tes situations
  des 30 derniers jours et signale quand un même thème revient souvent
  (≥3 fois, sur au moins 2 jours différents), pour t'aider à repérer tes
  schémas de comportement dans la durée.
- **📝 Profil** : questionnaire initial complet (âge, situation, forces,
  faiblesses, objectifs 30j/90j/1an, vision de l'homme que tu veux devenir...),
  à compléter progressivement, modifiable à tout moment.
- **📊 Domaines** : scores de progression sur 11 domaines de vie (émotionnel,
  relationnel, physique, mental, financier, professionnel, social,
  communication, discipline, intime, spirituel), calculés à partir de ton
  activité réelle (habitudes faites, objectifs atteints, journal, situations,
  mémorisation biblique), sur 4 périodes. **Ce sont des indicateurs
  d'activité, pas une mesure scientifique.**
- **🎮 Gamification** : barre XP/niveau/streak visible en permanence dans
  l'en-tête. 7 niveaux nommés (Building the Foundation → Complete
  Self-Mastery), badges de progression, série de jours actifs. L'XP est
  calculé automatiquement depuis ton activité — aucune action supplémentaire
  à faire.
- **🗣️ Communication** : "Que puis-je lui répondre ?" génère 6 brouillons de
  réponse (naturel, romantique, drôle, flirt, profond, direct) à personnaliser
  toi-même — jamais des réponses à copier-coller telles quelles.
  "Analyser une conversation" repère les tournures qui peuvent créer de la
  tension et te pose des questions de réflexion, sans jamais prendre
  automatiquement ton parti.
- **💰 Finance** : transactions (revenus/dépenses), résumé mensuel par
  catégorie, objectifs d'épargne avec suivi de progression.
- **📅 Revue mensuelle** (`/api/progress/monthly-review`) : compare le mois
  en cours au précédent et propose des questions de réflexion.
- **🆕 What's New** : historique des versions, visible dans l'onglet
  "Nouveau". À mettre à jour toi-même dans
  `backend/src/modules/meta/routes.js` à chaque évolution.
- **🔒 Confidentialité** (onglet "Compte") :
  - **Export** : télécharge toutes tes données au format JSON.
  - **Suppression de compte** : définitive, demande ton mot de passe.
  - **Verrouillage local** : protège l'accès à l'app avec un code sur cet
    appareil. Important : c'est un verrou simple côté navigateur
    (`localStorage`), pas un chiffrement — il ne protège pas contre quelqu'un
    qui aurait un accès technique à l'appareil ou au fichier `data/db.json`.
- Les habitudes acceptent désormais un champ `domain` optionnel (ex :
  `"domain": "physique"`) utilisé pour calculer les scores par domaine.

---

## 10. Nouveautés Phase 4

- **📚 Bibliothèque** : ajoute un livre par texte collé ou en important un
  fichier PDF/TXT (glisser-déposer dans le formulaire). L'app extrait le
  texte, calcule un **résumé extractif** (les phrases les plus représentatives
  du texte, par fréquence des mots — pas une vraie compréhension), des
  mots-clés, et des flashcards à trous. La position de lecture est suivie par
  livre. EPUB et DOCX ne sont pas encore supportés (voir ROADMAP).
  **Important** : l'app n'ajoute jamais de livre depuis Internet elle-même —
  tu dois fournir un contenu que tu as le droit légal d'utiliser.
- **🎬 Vidéothèque** : ajoute une vidéo par son lien. Comme l'app ne
  transcrit pas automatiquement de vidéo (ça demanderait un service payant),
  colle toi-même la transcription si tu en as une (YouTube en propose une via
  "Afficher la transcription" sous la vidéo) pour débloquer résumé/mots-clés/flashcards.
- **🎓 Teach Me** : crée un sujet (ex : "Leadership"), et suis un programme en
  5 niveaux — Fondations → Compréhension → Pratique → Application réelle →
  Maîtrise. Chaque niveau doit être validé dans l'ordre : impossible de
  sauter à la Pratique sans avoir fait les Fondations.
- **🧠 Learning engine** : après un résumé de livre/vidéo, auto-évalue-toi
  (Facile / Moyen / Difficile). L'app agrège ces auto-évaluations pour te
  montrer les sujets où tu bloques souvent ("à réviser") et ceux que tu
  maîtrises visiblement — visible en bas de l'onglet "Teach Me".
- Les nouvelles dépendances backend sont `multer` (upload de fichiers) et
  `pdf-parse` (extraction de texte PDF, pure JS, aucune dépendance native).

---

## 11. Nouveautés Phase 5

- **🌐 Recherche web** (onglet "Recherche") : par défaut, aucune recherche
  n'est possible — l'app te le dit clairement plutôt que d'inventer des
  résultats. Pour l'activer, choisis un fournisseur dans
  `backend/src/modules/search/searchProvider.js` (Brave Search est prêt à
  l'emploi) et configure dans `.env` :
  ```
  SEARCH_PROVIDER=brave
  SEARCH_API_KEY=ta_cle_api
  ```
  Crée une clé gratuite sur https://brave.com/search/api/ (palier gratuit
  disponible au moment de l'écriture — vérifie les conditions actuelles).
  Chaque résultat est toujours affiché avec sa source (titre + lien), sous
  le titre "INFORMATION TROUVÉE SUR INTERNET", jamais mélangé à une analyse.
- **📚 Bibliothèque** : accepte maintenant aussi les fichiers **EPUB**
  (dézippage + nettoyage du HTML — ne respecte pas toujours l'ordre exact
  des chapitres, suffisant pour générer résumé/flashcards) et **DOCX** (via
  `mammoth`, fiable).
- **🛠️ Admin → Statut système** : version de l'app, version de Node.js,
  disponibilité (uptime), et volumétrie des données (utilisateurs, journal,
  habitudes...). Base simple pour vérifier l'état de l'app avant une mise à jour.
- Nouvelles dépendances backend : `jszip` (lecture des EPUB) et `mammoth`
  (lecture des DOCX), toutes deux pures JS, sans dépendance native.

---

## 12. Nouveautés Phase 6

- **🧠 IA locale (Ollama)** : pour un coach plus intelligent que le mode
  local par défaut, sans payer d'API :
  1. Installe [Ollama](https://ollama.com/download) sur la machine qui
     héberge Better Man AI.
  2. `ollama pull llama3.2` (ou un autre modèle de ton choix).
  3. Dans `.env` : `AI_PROVIDER=ollama`.
  Si Ollama n'est pas lancé, le coach retombe automatiquement en mode local
  avec un message clair l'indiquant — jamais d'erreur silencieuse.
- **🔊 Voix améliorées** : le lecteur audio propose maintenant un sélecteur
  de voix parmi celles installées sur ton navigateur/OS (variable selon
  l'appareil). Ton choix est mémorisé.
- **🎧 Lecture audio continue des livres** : dans la bibliothèque, "Lire
  depuis ma position" lit le livre en continu (phrase par phrase), sauvegarde
  automatiquement ta position au fil de la lecture, et propose Pause/Stop/
  Reprendre depuis le début.
- **🔞 Intimité** (onglet dédié) : section séparée, avec double confirmation
  explicite (18 ans ou plus + activation volontaire) avant tout accès,
  révocable à tout moment depuis l'onglet lui-même. Contient 6 sujets de
  réflexion (communication, consentement, désir vs pression, anxiété de
  performance, santé générale, discussion des préférences), des suggestions
  de messages à personnaliser (jamais de contenu tout fait), et un **journal
  privé dédié**, distinct du journal général.
- **🐛 Trois bugs corrigés pendant les tests de cette phase** (détails dans
  ROADMAP.md) : un compte supprimé/désactivé gardait un token valide jusqu'à
  30 jours ; la suppression de compte oubliait certaines collections
  récentes ; le message de secours du coach IA affichait `[object Promise]`
  au lieu du texte prévu. Les trois sont corrigés et re-testés.

---

## 13. Nouveautés Phase 7

- **💪 Physique** : enregistre poids et tour de taille (avec tendance
  affichée sur 30 jours), journalise tes entraînements (type, durée,
  séries/répétitions), et fixe des objectifs progressifs sur 30j / 60j /
  90j / 6 mois / 1 an.
- **👔 Style et présentation** : 8 domaines de réflexion (vêtements,
  hygiène, coiffure, parfum, soins de la peau, posture, langage corporel,
  présentation générale), chacun avec des questions de départ. L'app
  signale les domaines sur lesquels tu n'as encore jamais écrit — un angle
  mort possible, pas un jugement. Volontairement réflexif : aucune
  prescription sur un "look" à adopter.
- **⚙️ Adaptation automatique** (onglet dédié, bouton "Analyser
  maintenant") : passe en revue ton activité récente et signale — habitude
  tenue ≥90% depuis 2 semaines → suggère de durcir ; habitude tenue ≤30% →
  suggère d'alléger ou mettre en pause ; domaine de vie sans aucune
  activité depuis 30 jours → suggère de le réintroduire ; objectif actif
  depuis plus de 60 jours → suggère de le réévaluer ; plus de 6 objectifs
  actifs à la fois → suggère de réduire la portée ; semaine avec 5+
  Situations réelles → signale une semaine à forte friction. **Important** :
  c'est une analyse à la demande, pas une tâche planifiée qui tourne toute
  seule — une app gratuite et auto-hébergée n'a pas de serveur qui reste
  actif en permanence pour ça (voir ROADMAP.md).

---

## 14. Nouveautés — Pépites (v0.8)

- **✨ Pépites** (onglet dédié + « Pépite du jour » sur l'Accueil) : des
  idées courtes à lire en 1 minute, sur le principe d'apps comme Deepstash,
  mais 100 % gratuit, sans abonnement ni limite.
  - **335 pépites** rédigées pour l'app (paraphrases inspirées de livres et
    principes connus, source toujours indiquée), réparties sur les 11
    domaines de vie, avec des **thèmes** filtrables (Écouter sans juger,
    Parler à tout le monde, Santé mentale, Organiser ses pensées, Prendre
    soin de son corps, Pour les hommes, Soutenir les femmes, Couple, Foi,
    Prière, Bible, Leadership, Famille, Argent, Confiance en soi,
    Surmonter les difficultés, Amitié, Travail, Gestion du temps, Paternité). Les pépites ajoutées
    depuis moins de 7 jours (champ `addedAt`) portent un badge « 🆕 Nouveau »
    et apparaissent dans le filtre « Nouveautés ».
    Ajoute-en librement dans
    `backend/src/modules/pepites/data/pepites.json`.
  - **Fil « Pour moi »** : les idées non lues d'abord, en mettant en avant
    les domaines où tu as le moins d'activité (habitudes/objectifs) sur 14 jours.
  - **Collections** : 🔖 garde une pépite dans la collection de ton choix.
  - **Révision espacée** : chaque pépite gardée revient à J1, J3, J7, J14,
    J30, jusqu'à être maîtrisée.
  - **Passer à l'action** : transforme l'action proposée en habitude ou en
    objectif en un clic — ce que Deepstash ne fait pas.
  - **Créer** : écris tes propres pépites, ou extrais des phrases clés d'un
    livre de ta bibliothèque pour les reformuler.
  - Lecture audio et partage sur chaque carte.

---

## 15. Quiz biblique et exercices de mémorisation (v0.9.5)

- **Quiz à trous** (onglet Bible) : écris le mot manquant puis « Vérifier ».
  La comparaison ignore accents, majuscules et ponctuation, et accepte une
  petite faute de frappe sur les mots de 5 lettres ou plus. « Indice » donne
  la première lettre, « Voir la réponse » révèle le mot ; le verset complet
  s'affiche avec le mot surligné. Score de la session, et choix entre tous les
  versets ou tes versets en mémorisation. La réponse n'est jamais envoyée au
  navigateur avant vérification (`POST /api/bible/quiz/check`).
- **🧩 S'entraîner** (Mémorisation) : le verset s'affiche avec des cases à
  remplir — 15 % des mots au jour 1, jusqu'à 75 % à la révision finale.
  Correction mot par mot ; à partir de 80 % de bonnes réponses sur un verset
  à réviser aujourd'hui, un bouton permet de valider l'étape directement.

---

## 16. Toute la Bible : recherche et mémorisation (v0.9.6)

- La **Bible Louis Segond 1910 complète** (domaine public, 31 170 versets) est
  incluse dans `backend/src/modules/bible/data/lsg1910.json` (source :
  getBible, `https://api.getbible.net/v2/ls1910.json`). Elle n'est chargée
  qu'à la première recherche — aucun service extérieur n'est appelé.
- **🔎 Chercher dans la Bible** (haut de l'onglet Bible) : une référence
  (`Jean 3:16`, `jean 3 16`, `Ps 23`, `1 Co 13:4-7`, abréviations courantes)
  ou des mots-clés (tous les mots doivent apparaître, accents ignorés).
- **Parcourir** un livre et un chapitre, avec ◀ ▶ pour changer de chapitre.
- **➕ Mémoriser** n'importe quel verset, un passage entier (jusqu'à 10
  versets), ou un **verset d'une autre traduction** en collant son texte.
- API : `GET /api/bible/books`, `GET /api/bible/lookup?q=`,
  `GET /api/bible/chapter?book=&chapter=`.
- **📅 Plans de lecture** (v0.9.9) : Bible en 1 an, NT en 90 jours,
  Évangiles en 30 jours, Psaumes en 60 jours, Proverbes en 31 jours ; chaque
  jour indique les chapitres à lire, ouvre le lecteur, et se coche « lu ».
- **⭐ Versets favoris** avec note personnelle, depuis la recherche ou le lecteur.
- **Récitation** : à voix haute (reconnaissance vocale, toujours en français)
  ou par écrit, avec correction mot par mot.

---

## 17. Notifications (v0.9.7)

- **🔔 Cloche** en haut de l'écran : les rappels du moment, avec un compteur.
  Toucher un rappel ouvre la bonne section.
- **Profil → Notifications** : chaque utilisateur choisit ses rappels —
  verset du jour et nouvelles pépites (activés par défaut), missions et
  habitudes, versets à réviser, série en danger (vers 20 h) — et l'heure de
  son rappel du jour (dans son fuseau horaire).
- **Sur le téléphone** (notifications push, gratuites) : bouton « Activer les
  notifications » dans le même écran. Fonctionne sur Android, ordinateur, et
  iPhone/iPad (iOS 16.4+) **une fois l'app ajoutée à l'écran d'accueil**
  (Partager ⬆️ → « Sur l'écran d'accueil »).
- **Clés** : rien à configurer, l'app génère ses clés VAPID au premier usage
  et les garde dans la base (ou utilise `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
  si elles sont définies).
- **Envoi programmé** : sur Vercel (serverless), le fichier
  `.github/workflows/notifications.yml` appelle l'app toutes les 15 min
  (adresse par défaut : celle de Vercel ; une variable GitHub `APP_URL` peut
  la remplacer). (Optionnel : définir `CRON_SECRET` dans Vercel **et** dans les secrets
  GitHub pour réserver l'appel à GitHub.) En local, un minuteur intégré au
  serveur s'en charge. Chaque rappel part au plus une fois par jour, et
  jamais plus de 3 h après l'heure choisie.

---

## 18. Coach IA avec Claude (v0.9)

Le Coach IA peut utiliser **Claude** (Anthropic) comme moteur principal :

1. Crée une clé API sur https://console.anthropic.com (rubrique *API Keys*).
   **Attention** : l'API est facturée à l'usage, **séparément** de
   l'abonnement Claude.ai (Pro/Max) — il faut ajouter des crédits dans la
   console.
2. Ajoute la variable `ANTHROPIC_API_KEY` (dans `.env` en local, ou dans
   Vercel → Settings → Environment Variables), puis **redéploie**.
3. Optionnel : `CLAUDE_MODEL` pour choisir un autre modèle (par défaut
   `claude-opus-5-5`).

Ne mets jamais la clé dans le code ni dans un message. Si la clé est absente,
invalide ou si Claude ne répond pas, le Coach passe automatiquement aux
fournisseurs gratuits (Gemini, Mistral...) puis au coach local. Chaque
réponse indique quel fournisseur l'a produite. L'admin peut voir l'état des
fournisseurs via `/api/chat/text-provider-status`.

---

## 19. Déploiement en ligne (Vercel + Neon)

L'app tourne sur **Vercel** : https://better-man-ai.vercel.app (aussi
https://better-man-ai-church-av-assistant.vercel.app), avec ses données dans
une base **Neon**.

- **Mise en ligne automatique** : le projet Vercel est relié au dépôt GitHub ;
  chaque fusion dans `main` est déployée toute seule. Réglages du projet :
  *Root Directory* = `backend`, *Framework* = Express (point d'entrée
  `backend/index.js`).
- **Ancienne adresse Render** (better-man-ai-web.onrender.com) : conservée
  comme simple redirection grâce à la variable `REDIRECT_TO` ; ce serveur ne
  touche plus à la base.
- **IA** : `GEMINI_API_KEY` (gratuit). Le modèle est réglé dans
  `backend/src/config/geminiModel.js` (alias toujours à jour, secours Lite en
  cas de surcharge) ; `MISTRAL_API_KEY` ajoute une deuxième IA de secours.

- **Mot de passe oublié** : emails envoyés par SMTP (gratuit avec Gmail) —
  `SMTP_USER` = l'adresse Gmail, `SMTP_PASS` = un *mot de passe d'application*
  Google (Compte Google → Sécurité → Validation en deux étapes → Mots de passe
  des applications). Sans eux, l'admin génère le lien depuis l'espace Admin.

Variables à vérifier dans Vercel (Settings → Environment Variables) :

- **`JWT_SECRET`** — une longue chaîne aléatoire. Sans elle, l'authentification échoue.
- **`DATABASE_URL`** — une base PostgreSQL gratuite (ex : [Neon](https://neon.tech))
  pour que les données survivent aux redémarrages du serveur. Sans elle, l'app
  fonctionne mais utilise `/tmp` (non persistant sur Vercel) — parfait pour
  tester l'interface, pas pour un usage réel durable.

Après avoir ajouté ou modifié une variable, il faut **redéployer** depuis le
dashboard Vercel (bouton "Redeploy") — les variables ne s'appliquent pas
rétroactivement à un déploiement déjà en ligne.
