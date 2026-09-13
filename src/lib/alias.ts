// ==============================================================================
// StarRuby.in Banking System — Party Alias Normalization & Similarity
// ==============================================================================

/**
 * Auto-normalizes raw party names:
 * - Converts to lowercase
 * - Strips punctuation, dots, commas, slashes, dashes
 * - Collapses consecutive whitespaces
 */
export function normalizeAlias(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,\-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trigram (3-gram) similarity algorithm mirroring PostgreSQL's pg_trgm.similarity()
 * Returns a float between 0.0 (completely distinct) and 1.0 (exact match).
 */
export function calculateTrigramSimilarity(str1: string, str2: string): number {
  const s1 = normalizeAlias(str1);
  const s2 = normalizeAlias(str2);

  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  // Generate trigrams with leading and trailing spaces as pg_trgm does
  const getTrigrams = (text: string): Set<string> => {
    const padded = `  ${text} `;
    const trigrams = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) {
      trigrams.add(padded.slice(i, i + 3));
    }
    return trigrams;
  };

  const tri1 = getTrigrams(s1);
  const tri2 = getTrigrams(s2);

  let intersection = 0;
  tri1.forEach(t => {
    if (tri2.has(t)) intersection++;
  });

  const union = tri1.size + tri2.size - intersection;
  return union === 0 ? 0 : Number((intersection / union).toFixed(4));
}
