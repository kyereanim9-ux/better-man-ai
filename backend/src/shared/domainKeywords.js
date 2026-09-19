import { stripAccents } from './textNormalize.js';

// Dictionnaire mot-clé -> domaine, partagé entre les modules situations,
// domains et progress. Volontairement simple (comptage de mots), transparent,
// jamais présenté comme une analyse psychologique.
//
// Les motifs sont écrits SANS accents : le texte de l'utilisateur est
// désaccentué avant comparaison (voir stripAccents), pour rester robuste
// même si la personne tape vite sur mobile sans accents ("enerve" au lieu
// de "énervé") — cas très fréquent en usage réel, découvert en testant.
export const DOMAIN_KEYWORDS = {
  emotionnel: /colere|frustr|enerv|triste|peur|jaloux|jalousie|stress|anxieux|honte/i,
  relationnel: /copine|copain|partenaire|couple|dispute|conflit|relation/i,
  communication: /message|texto|sms|appel|conversation|repondre|reponse/i,
  professionnel: /travail|boulot|collegue|patron|entretien|reunion/i,
  financier: /argent|depense|facture|budget|dette|salaire/i,
  physique: /sport|fatigue|sommeil|corps|entrainement/i,
  discipline: /procrastin|distraction|telephone|ecran|habitude/i,
  social: /ami|amis|groupe|soiree|social/i,
  intime: /sexe|intimite|desir|attirance/i,
  mental: /pensee|mental|concentration|motivation/i,
  spirituel: /dieu|priere|bible|spirituel/i
};

export function detectDomains(text, fallback = []) {
  const normalized = stripAccents(text);
  const found = Object.entries(DOMAIN_KEYWORDS)
    .filter(([, regex]) => regex.test(normalized))
    .map(([domain]) => domain);
  return found.length ? found : fallback;
}


