import JSZip from 'jszip';

// Un EPUB est une archive zip contenant des fichiers (X)HTML pour chaque
// chapitre. Approche volontairement simple pour rester 100% gratuite et sans
// dépendance native : on dézippe, on prend les fichiers html/xhtml dans
// l'ordre où ils apparaissent dans l'archive, et on retire les balises.
// Limite connue : ne respecte pas toujours l'ordre exact de lecture "spine"
// du fichier .opf — suffisant pour générer résumé/flashcards, pas pour une
// lecture page par page parfaitement fidèle.
export async function extractEpubText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const htmlFiles = Object.keys(zip.files)
    .filter(name => /\.(xhtml|html|htm)$/i.test(name) && !zip.files[name].dir)
    .sort();

  if (!htmlFiles.length) throw new Error('Aucun contenu lisible trouvé dans cet EPUB.');

  let combined = '';
  for (const name of htmlFiles) {
    const raw = await zip.files[name].async('string');
    const text = raw
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&[a-z]+;/gi, ' ');
    combined += text + '\n\n';
  }
  return combined.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
