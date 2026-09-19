# ROADMAP — Better Man AI

## ✅ Phase 1 — FAIT (ce dépôt)
- [x] Authentification (inscription/connexion, JWT, hash bcrypt)
- [x] Profils utilisateur
- [x] Séparation des données par utilisateur (journal, habitudes, objectifs, chats)
- [x] Espace Admin (gestion des comptes, sans accès au contenu privé)
- [x] Dashboard (vue "Daily")
- [x] AI Coach avec chat privé (provider local gratuit, interface remplaçable)
- [x] Objectifs (8 catégories du cahier des charges)
- [x] Habitudes (suivi quotidien)
- [x] Daily missions (générées à partir des habitudes/objectifs en attente)
- [x] Journal libre

## ✅ Phase 2 — FAIT — Progression, voix, Bible, mémorisation
- [x] Graphiques de progression (habitudes 14 jours, objectifs, mémorisation — mini bar chart SVG/CSS, sans librairie externe)
- [x] Weekly review automatique (règles simples, pas d'appel IA nécessaire)
- [x] Détection de tendances dans le journal (comptage de mots-clés sur 14 jours, transparent, pas un diagnostic)
- [x] Lecture à voix haute (Web Speech API du navigateur, gratuite) avec
      Play/Pause/Stop/Vitesse (x0.75 à x2), appliquée au verset du jour, à la
      lecture du jour, à la question du jour, aux réponses du coach et aux
      entrées de journal
- [x] Espace Bible : verset du jour, lecture du jour, question du jour, quiz à trous
- [x] Recherche par thème + "Que dit la Bible sur X ?" avec séparation stricte
      TEXTE BIBLIQUE / APPLICATION (jamais présentée comme le texte)
- [x] Système de mémorisation biblique par répétition espacée (J1 lire → J2
      mots manquants → J3 réciter → J7 test → J14 révision → J30 révision
      finale → maîtrisé), intégré à la mission du jour
- [x] Jeu de ~35 versets (Louis Segond 1910, domaine public) couvrant colère,
      pardon, patience, amour, finances, travail, relations, peur, intimité...

## ✅ Phase 3 — FAIT — Situation réelle, domaines, gamification, communication, finances
- [x] **Mode Situation réelle** (fonctionnalité phare) : décris une situation vécue,
      reçois des questions de réflexion + une action concrète, et détection
      automatique de schémas répétitifs sur 30 jours
- [x] Questionnaire de profil personnel (26 champs, complétable progressivement)
- [x] Scores de progression par domaine de vie (11 domaines : émotionnel,
      relationnel, physique, mental, financier, professionnel, social,
      communication, discipline, intime, spirituel), sur 4 périodes
- [x] Gamification : XP (calculé depuis l'activité réelle), 7 niveaux nommés,
      badges, streaks — jamais présentés comme une mesure de valeur personnelle
- [x] Communication : "Que puis-je lui répondre ?" (6 tons) + analyse de
      conversation (jamais de prise de parti automatique)
- [x] Coach financier : transactions, résumé mensuel par catégorie, objectifs d'épargne
- [x] Revue mensuelle avec comparaison au mois précédent
- [x] "What's New" (historique des versions)
- [x] Confidentialité : export JSON complet des données, suppression du
      compte par l'utilisateur (mot de passe requis), verrouillage local par
      code PIN (stocké uniquement dans le navigateur)
- [x] Les habitudes et objectifs sont désormais rattachés à un domaine de vie

## ✅ Phase 4 — FAIT — Bibliothèque, vidéothèque, Teach Me, learning engine
- [x] Bibliothèque de livres : texte collé, ou upload PDF/TXT (EPUB/DOCX en Phase 5)
- [x] Résumé, mots-clés et flashcards générés localement (résumé extractif par
      fréquence de mots, aucune API payante)
- [x] Suivi de la position de lecture par livre
- [x] Vidéothèque : lien + transcription optionnelle fournie par l'utilisateur
      (l'app ne télécharge/transcrit rien automatiquement), avec les mêmes
      outils d'apprentissage que la bibliothèque
- [x] "Teach Me" : programme progressif en 5 niveaux (fondations →
      compréhension → pratique → application réelle → maîtrise), validation
      séquentielle obligatoire (impossible de sauter un niveau)
- [x] Learning engine : auto-évaluation facile/moyen/difficile après chaque
      contenu, agrégée en "sujets à réviser" vs "sujets maîtrisés"

## ✅ Phase 5 — FAIT — Recherche web, EPUB/DOCX, statut système
- [x] Recherche web avec citation systématique des sources, via une interface
      SearchProvider remplaçable (même principe que le coach IA)
- [x] Séparation stricte INFORMATION TROUVÉE SUR INTERNET / ANALYSE
- [x] Provider par défaut ("local") honnête : indique clairement l'absence
      d'accès Internet plutôt que d'inventer des résultats ou des sources
- [x] Provider Brave Search prêt à l'emploi (palier gratuit disponible, clé
      API à configurer dans `.env`)
- [x] Bibliothèque : support EPUB (dézippage + nettoyage HTML) et DOCX (via
      `mammoth`), en plus de PDF et TXT
- [x] Statut système pour l'administrateur (version, Node.js, uptime,
      volumétrie des données) — base du "système de mise à jour"

## ✅ Phase 6 — FAIT — IA locale, meilleures voix, audio continu, intimité 18+
- [x] IA locale via Ollama (provider `ollama`, gratuit, auto-hébergé) avec
      repli propre et message honnête si Ollama n'est pas lancé sur la machine
- [x] Meilleures voix : sélecteur parmi les voix disponibles du navigateur,
      préférence sauvegardée localement
- [x] Lecture audio continue des livres, reprise depuis la position
      sauvegardée, avec Pause/Stop/Reprendre depuis le début
- [x] Section Intimité 18+ : contrôle d'accès explicite (double confirmation
      âge + consentement, révocable à tout moment), 6 sujets éducatifs
      (communication, consentement, désir vs pression, anxiété de
      performance, santé générale, préférences), suggestions de messages
      (squelettes à personnaliser, jamais de contenu explicite tout fait),
      journal privé **séparé** du journal général
- [x] **Corrections de bugs découvertes en testant cette phase :**
  - Un compte supprimé ou désactivé par l'admin gardait un token JWT valide
    jusqu'à expiration (30 jours) — corrigé : chaque requête vérifie
    maintenant que le compte existe toujours et est actif
  - La suppression de compte (admin et self-service) oubliait plusieurs
    collections ajoutées depuis la Phase 2 (finance, bibliothèque, vidéos,
    Teach Me, learning, intimité) — centralisé dans `purgeUserData()`
  - Le repli du coach IA (Ollama/Anthropic indisponible) affichait
    `[object Promise]` au lieu du message de secours, faute d'un `await`
    manquant

## ✅ Phase 7 — FAIT — Physique, Style, Adaptation automatique
- [x] **Physique** : mesures (poids, tour de taille) avec tendance sur 30
      jours, journal d'entraînements (type, durée, séries/répétitions),
      objectifs progressifs (30j / 60j / 90j / 6 mois / 1 an)
- [x] **Style et présentation** : 8 domaines de réflexion (vêtements,
      hygiène, coiffure, parfum, soins de la peau, posture, langage
      corporel, présentation générale), avec détection des "angles morts"
      (domaines jamais notés) — volontairement réflexif, jamais prescriptif
      sur un "look" imposé
- [x] **Adaptation automatique** : analyse à la demande (pas de tâche
      planifiée — voir note ci-dessous) qui détecte : habitudes maîtrisées
      à durcir, habitudes en échec à alléger, domaines de vie négligés
      depuis 30 jours, objectifs actifs anciens à réévaluer, surcharge
      d'objectifs actifs, semaines à forte friction (beaucoup de Situations
      réelles) — testée avec des données artificielles pour valider chaque
      déclencheur, y compris un bug de seuil corrigé en testant
      (l'habitude "reduce_load" était ignorée avant 14 jours d'existence
      au lieu de 7)

## ✅ Améliorations qualité — passe de test de bout en bout
Après la Phase 7, un test de bout en bout (chaîne complète journal → habitudes
→ objectifs → situations → domaines → gamification, avec des vraies données
qui s'enchaînent plutôt que des tests isolés par module) a révélé un problème
réel : **la détection de mots-clés (domaines de vie, thèmes bibliques,
tendances journal) était sensible aux accents**. Un texte tapé sans accents
("enerve" au lieu de "énervé" — très courant sur mobile ou en tapant vite) ne
déclenchait presque aucune détection, avec repli silencieux sur une valeur par
défaut peu informative.

Corrigé : toute comparaison texte-libre / mots-clés désaccentue maintenant les
deux côtés avant de comparer (nouvel utilitaire partagé
`src/shared/textNormalize.js`, fonction `stripAccents`), dans :
- `shared/domainKeywords.js` (détection de domaine — situations, journal, progress)
- `modules/progress/routes.js` (tendances journal)
- `modules/bible/routes.js` (recherche par thème, "Que dit la Bible sur...")

Retesté avec et sans accents sur chaque endpoint concerné : la détection
retrouve maintenant les mêmes résultats dans les deux cas. Non-régression
vérifiée sur l'ensemble de l'app après coup.

## ✅ Améliorations qualité — passe de test de bout en bout
Après la Phase 7, un test de bout en bout (chaîne complète journal → habitudes
→ objectifs → situations → domaines → gamification, avec des vraies données
qui s'enchaînent plutôt que des tests isolés par module) a révélé un problème
réel : **la détection de mots-clés (domaines de vie, thèmes bibliques,
tendances journal) était sensible aux accents**. Un texte tapé sans accents
("enerve" au lieu de "énervé" — très courant sur mobile ou en tapant vite) ne
déclenchait presque aucune détection, avec repli silencieux sur une valeur par
défaut peu informative.

Corrigé : toute comparaison texte-libre / mots-clés désaccentue maintenant les
deux côtés avant de comparer (nouvel utilitaire partagé
`src/shared/textNormalize.js`, fonction `stripAccents`), dans :
- `shared/domainKeywords.js` (détection de domaine — situations, journal, progress)
- `modules/progress/routes.js` (tendances journal)
- `modules/bible/routes.js` (recherche par thème, "Que dit la Bible sur...")

Retesté avec et sans accents sur chaque endpoint concerné : la détection
retrouve maintenant les mêmes résultats dans les deux cas. Non-régression
vérifiée sur l'ensemble de l'app après coup.

Une deuxième passe a vérifié Teach Me (impossible de sauter un niveau),
Intimité (accès bien bloqué tant que les deux confirmations ne sont pas
données), Bibliothèque (texte trop court dégrade proprement, pas de crash),
Finance (arithmétique du résumé vérifiée au centime), et Admin (désactivation
d'un compte coupe l'accès immédiatement, même avec un token encore valide) —
rien à corriger.

Un audit croisé frontend/backend (chaque appel `api(...)` du frontend comparé
à chaque route réellement montée côté serveur) a révélé trois fonctionnalités
back-end complètes mais **invisibles côté utilisateur**, jamais branchées au
frontend :
- `/progress/monthly-review` (revue mensuelle, Phase 3) — ajoutée dans
  l'onglet Progression, à côté de la revue hebdomadaire
- `/users/me` GET+PATCH (modifier son nom) — ajoutée dans l'onglet Compte
- `/videos/:id/transcript` PATCH — une vidéo créée sans transcription ne
  pouvait jamais en recevoir une après coup, alors même que le message
  d'aide affiché ("Édite la vidéo pour en ajouter une") promettait une
  fonctionnalité qui n'existait nulle part. Ajout d'un formulaire de
  transcription directement dans le détail de la vidéo.

Les trois ont été testées de bout en bout (création → ajout/modification →
vérification que l'effet en aval fonctionne, ex : le study-pack se génère
bien après l'ajout d'une transcription). Un second passage de l'audit croisé
confirme qu'aucune route backend ne reste orpheline.

Une relecture du code (pas de l'API cette fois) a trouvé un problème de
fond plus subtil : **le formulaire de création d'habitude n'avait aucun
sélecteur de domaine**, alors que le backend prend bien un champ `domain`
(avec repli silencieux sur "discipline"). Résultat : toute habitude créée
via l'interface — "Lire la Bible", "Faire du sport", peu importe — atterrissait
dans le domaine "discipline", faussant les scores de domaines de vie ET les
suggestions du module Adaptation ("domaine négligé" pouvait se déclencher à
tort pour "spirituel" ou "physique" alors que l'utilisateur y était bien
actif, juste mal classé). Corrigé : sélecteur de domaine ajouté au
formulaire de création, et une route `PATCH /habits/:id` (nouvelle, avec
sélecteur sur chaque carte d'habitude) permet de corriger le domaine des
habitudes déjà créées. Testé de bout en bout : création avec domaine
explicite → le bon domaine progresse dans les scores ; correction d'une
habitude mal classée → le changement est bien pris en compte ensuite.

Un problème apparenté a été trouvé du côté de l'intégration inter-modules :
**les entraînements du module Physique (Phase 7) ne remontaient jamais dans
les scores de domaines ni dans le module Adaptation** — quelqu'un qui
enregistre des séances tous les jours dans l'onglet Physique voyait son
score de domaine "physique" rester bloqué à zéro, et pouvait même recevoir
une suggestion "réintroduis le domaine physique, aucune activité détectée
depuis 30 jours" alors qu'il s'entraînait activement. Corrigé dans les deux
endroits (`domains/routes.js` et `adaptation/routes.js`) : les entraînements
comptent désormais pour le domaine physique. Testé de bout en bout : score
physique à 0 avant tout entraînement, positif après un log, et la fausse
suggestion "domaine négligé" ne se déclenche plus.

En cherchant le même type de trou ailleurs, deux autres modules avaient
exactement le même problème : **les transactions financières (Phase 3) ne
remontaient jamais dans le domaine "financier"**, et **le journal privé
Intimité (Phase 6) ne remontait jamais dans le domaine "intime"**. Même
correctif appliqué aux deux endroits, même test de bout en bout (score à 0
avant activité, positif après, plus de fausse alerte "domaine négligé").

## Refonte visuelle complète de l'accueil (Phase 8)
Refonte demandée par l'utilisateur : interface premium, chaleureuse, avec
progression visible immédiatement. Réalisée en gardant la stack vanilla
JS/HTML/CSS (pas de React) pour ne pas complexifier le déploiement — un
système de variables CSS assure la même flexibilité de personnalisation.

- **Système de design** : variables CSS pour thème (sombre premium par
  défaut / clair) et couleur d'accent (bleu, violet, vert, orange),
  changeables depuis Compte → Apparence, mémorisées en `localStorage`,
  appliquées instantanément sans rechargement.
- **Nouvel accueil (tableau de bord)** : carte XP/Niveau en haut (niveau,
  nom du niveau, barre de progression, série de jours), grande carte
  "Mission du jour" avec habitudes/objectifs/versets cochables
  directement (déclenche les vrais endpoints `/habits/:id/done`,
  `/goals/:id` PATCH, `/bible/memorization/:id/advance`), toast animé
  "+XP Mission terminée 🎉" à chaque case cochée.
- **Carte Coach IA** et **carte Bible** (verset du jour) mises en avant,
  au-dessus du reste.
- **Navigation par catégories** (Moi / Coaching / Apprendre / Corps &
  Style / Vie) sous forme de cartes avec icône, description et, quand
  disponible, le score du domaine cette semaine — remplace l'ancienne
  grille plate de boutons identiques. Aucune fonctionnalité retirée :
  les 23 vues existantes restent toutes accessibles, juste réorganisées.
- **Mini-graphique de progression** sur l'accueil (top 4 domaines de la
  semaine, réutilise `/domains/scores`).
- **En-tête repensé** : salutation avec prénom + phrase du jour (change
  chaque jour, choisie par hash de la date), avatar avec initiale,
  menu déroulant profil (Mon profil / Apparence / Nouveautés / Admin si
  applicable / Déconnexion) à la place du bouton "Déconnexion" brut.
- **Navigation basse fixe (mobile)** : Accueil / Missions / Coach /
  Apprendre / Profil, visible uniquement sous 900px de large.
- Testé de bout en bout : structure de `/daily` vérifiée compatible
  avec le rendu des missions, tous les endpoints utilisés par le nouveau
  tableau de bord répondent 200, non-régression sur les autres vues
  (habitudes, objectifs, finance, physique, style, teach, bibliothèque,
  vidéos, intimité, progression) confirmée après la refonte.

## Phase 9 — Journal intelligent, Relations, Bilan du soir, sport, skincare, repas
Suite à un audit complet des deux cahiers des charges d'origine contre le code
réel, 4 lacunes identifiées ont été comblées, plus plusieurs demandes
nouvelles :

- **Journal avec analyse locale** : chaque entrée détecte maintenant les
  domaines concernés (mêmes mots-clés que Situation, insensibles aux
  accents) et propose jusqu'à 5 questions de réflexion adaptées — affichées
  sous chaque entrée dans l'interface.
- **Coach relationnel (`/relationships`)** : un espace par relation
  importante, avec le cadre explicite "ce que tu sais / ce que tu supposes
  seulement / ce qu'il faudrait demander" pour chaque entrée (sujet,
  conflit, moment positif, besoin exprimé) — l'app ne diagnostique jamais
  ce que l'autre personne pense.
- **Bilan du soir** : 4 questions (accompli / difficile / appris /
  différemment demain), une entrée par jour (upsert), intégré à l'accueil.
- **Récitation biblique** : bouton 🎤 sur les versets à réviser, utilise la
  reconnaissance vocale native du navigateur (`SpeechRecognition`, gratuite,
  dégrade proprement si non supportée), calcule un pourcentage de
  correspondance approximatif par recoupement de mots.
- **Générateur de séance sport** (`/physique/workout-suggestion`) : à
  règles fixes (pas d'IA), selon lieu (maison/salle) et matériel
  (aucun/élastiques/haltères), toujours choisi par l'utilisateur.
- **Photos de progression physique** : comparaison visuelle datée,
  **jamais de note ni de verdict généré par l'IA** — décision délibérée
  après discussion avec l'utilisateur sur les risques d'une IA qui "juge"
  un corps sur photo.
- **Suivi skincare coréen** : routine matin/soir (10 étapes classiques),
  coché au jour le jour — pas d'analyse de peau par photo, même logique
  de prudence que ci-dessus.
- **Journal photo des repas** (`/nutrition`) : photo + description
  manuelle. Explicitement **pas d'analyse automatique du contenu** —
  aucune IA de vision connectée dans l'architecture 0€ ; l'app le dit
  clairement dans sa réponse API et dans l'interface plutôt que de laisser
  croire à une reconnaissance qui n'existe pas.

Testé de bout en bout (backend complet + non-régression sur 19 endpoints
existants) avant et après câblage frontend.

## Automatisations / nouvelles intégrations — non construites
Ces deux points du cahier des charges restent volontairement hors scope :
une app 100% gratuite et auto-hébergée n'a pas de serveur toujours actif pour
déclencher des tâches planifiées (cron) sans un minimum d'infrastructure
payante, et "nouvelles intégrations" est trop vague pour être construit sans
un besoin précis. À réévaluer si un vrai cas d'usage se présente.

## Notes de suivi
- Chaque nouvelle phase doit : construire → tester → corriger → documenter
  avant de passer à la suivante (règle de développement du cahier des charges).
- Ne jamais casser un module existant : vérifier les dépendances avant tout
  changement important dans `db.js` ou `middleware/auth.js`, utilisés par
  tous les modules.
