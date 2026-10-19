// Modèle Gemini utilisé partout (Coach IA, analyse photo, repas).
// « gemini-flash-latest » est un alias que Google fait toujours pointer vers
// son modèle Flash actuel : les anciens noms fixes (gemini-1.5-flash,
// gemini-2.5-flash) ont été retirés et répondaient 404. Modifiable sans
// toucher au code avec la variable GEMINI_MODEL.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
// Modèle de secours quand le principal est saturé (erreur 503 « high demand »,
// fréquente sur l'offre gratuite) : la version Lite, plus légère et moins demandée.
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';
