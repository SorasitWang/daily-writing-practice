// ---------- Dates ----------

// Local date as 'YYYY-MM-DD'.
export function dstr(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const MS_PER_DAY = 864e5;

export function dayOfYear(date) {
  return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / MS_PER_DAY);
}

// ---------- Text ----------

export function countWords(text) {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

export function splitParas(text) {
  return String(text || '')
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// A sentence ends with . ! ? or … followed by a capital letter or digit (optionally after a quote or bracket).
const SENTENCE_BREAK = /(?<=[.!?…])\s+(?=["'“‘(]?[A-Z0-9])/;

export function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(SENTENCE_BREAK)
    .map((s) => s.trim())
    .filter((s) => countWords(s) > 0);
}

// Sentence count, length range, and opening words used too often.
export function sentenceStats(text) {
  const sentences = splitSentences(text);
  if (!sentences.length) return null;

  const lengths = sentences.map(countWords);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  const openers = {};
  for (const s of sentences) {
    const first = (s.match(/[A-Za-z']+/) || [''])[0].toLowerCase();
    if (first) openers[first] = (openers[first] || 0) + 1;
  }
  const isOverused = (w) => openers[w] >= 3 || (sentences.length >= 4 && openers[w] / sentences.length >= 0.4);
  const repeated = Object.keys(openers)
    .filter(isOverused)
    .sort((a, b) => openers[b] - openers[a]);

  return {
    n: sentences.length,
    avg,
    min: Math.min(...lengths),
    max: Math.max(...lengths),
    repeated,
    openers,
  };
}

// Normalize a phrase for duplicate checks: lower case, single spaces.
export function normGram(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Small string hash (djb2), used to spot a re-review of unchanged text.
export function textHash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}

// ---------- JSON ----------

// Parse the first {...} block in a reply, or return null.
export function extractJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export const deepCopy = (value) => JSON.parse(JSON.stringify(value));

export const errorText = (e) => (e && e.message) || e;
