// Système de répétition espacée simple, conforme au cahier des charges :
// J1 Lire -> J2 Mots manquants -> J3 Réciter sans regarder -> J7 Test ->
// J14 Révision -> J30 Révision finale -> maîtrisé.
//
// On stocke seulement `stage` (index dans STAGES) et `startedAt`.
// `nextReviewDate` se recalcule à la volée : startedAt + offset du stage suivant.

export const STAGES = [
  { key: 'read', dayOffset: 0, label: 'Jour 1 — Lire le verset' },
  { key: 'fill_blanks', dayOffset: 1, label: 'Jour 2 — Compléter les mots manquants' },
  { key: 'recite', dayOffset: 2, label: 'Jour 3 — Réciter sans regarder' },
  { key: 'test', dayOffset: 6, label: 'Jour 7 — Test' },
  { key: 'review_1', dayOffset: 13, label: 'Jour 14 — Révision' },
  { key: 'review_final', dayOffset: 29, label: 'Jour 30 — Révision finale' },
  { key: 'mastered', dayOffset: null, label: 'Maîtrisé' }
];

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Renvoie l'état calculé d'un verset en mémorisation.
export function computeStatus(item) {
  const stageIndex = item.stage ?? 0;
  const stage = STAGES[stageIndex];
  const isMastered = stage.key === 'mastered';
  const nextReviewAt = isMastered ? null : addDays(item.startedAt, stage.dayOffset);
  const isDue = !isMastered && new Date(nextReviewAt) <= new Date();

  return {
    ...item,
    stageKey: stage.key,
    stageLabel: stage.label,
    nextReviewAt,
    isDue,
    status: isMastered ? 'mastered' : (isDue ? 'due' : 'in_progress')
  };
}

// Fait avancer un verset d'une étape (appelé quand l'utilisateur valide une révision).
export function advanceStage(item) {
  const nextIndex = Math.min((item.stage ?? 0) + 1, STAGES.length - 1);
  return { ...item, stage: nextIndex };
}
