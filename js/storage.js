// Saves data to the learner's Claude account when running as a Claude artifact,
// or to this browser's localStorage otherwise.
import { $ } from './dom.js';
import { state } from './state.js';
import { deepCopy } from './util.js';

// ---------- localStorage (never throws) ----------

export function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked or full: ignore
  }
}

export function lsRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function load(key, fallback) {
  try {
    return JSON.parse(lsGet(key)) || fallback;
  } catch {
    return fallback;
  }
}

// ---------- Where data lives ----------

// mode: 'loading' | 'db' (Claude account) | 'local' (this browser)
export const STORE = { mode: 'loading', nbRef: null, entriesCol: null };

export function setSync(message, className = 'hint') {
  const el = $('syncStatus');
  el.textContent = message;
  el.className = className;
}

export function syncLabel() {
  if (STORE.mode === 'db') setSync('Saved to your Claude account.', 'ok-note');
  else if (STORE.mode === 'local') setSync('Data is saved in this browser only.');
  else setSync('Loading your notebook…');
}

export function storeError(e) {
  const code = e && e.code;
  const message = code === 'quota_exceeded'
    ? 'Storage is full. Delete some old entries, then save again.'
    : `Couldn't save just now (${(e && e.message) || code || e}). Your next change will try again.`;
  setSync(message, 'err-note');
}

// ---------- Saving ----------

// The notebook (vocab, grammar, stats) is one document in the Claude account.
// Writes are coalesced: at most one in flight, and one more queued if anything changed meanwhile.
let notebookDirty = false;
let notebookWriting = false;

function flushNotebook() {
  if (notebookWriting || !notebookDirty || !STORE.nbRef) return;
  notebookDirty = false;
  notebookWriting = true;
  STORE.nbRef
    .set({ vocab: state.vocab, grammar: state.grammar, gramstats: state.gstats, updated: new Date().toISOString() })
    .then(syncLabel, storeError)
    .finally(() => {
      notebookWriting = false;
      flushNotebook();
    });
}

// Save one collection, e.g. save('dw_vocab', state.vocab).
export function save(key, value) {
  if (STORE.mode === 'db') {
    if (key === 'dw_entries') return; // entries are written one by one with persistEntry
    notebookDirty = true;
    flushNotebook();
  } else if (STORE.mode === 'local') {
    lsSet(key, JSON.stringify(value));
  }
}

// Writes to the same entry run in order.
const entryQueue = {};

export function persistEntry(entry) {
  if (STORE.mode !== 'db') {
    save('dw_entries', state.entries);
    return Promise.resolve();
  }
  const body = deepCopy(entry);
  const ref = STORE.entriesCol.doc(entry.id);
  const previous = entryQueue[entry.id] || Promise.resolve();
  entryQueue[entry.id] = previous.then(() => ref.set(body)).then(syncLabel, storeError);
  return entryQueue[entry.id];
}

// ---------- Loading ----------

export function loadLocal() {
  STORE.mode = 'local';
  state.entries = load('dw_entries', []);
  state.vocab = load('dw_vocab', []);
  state.grammar = load('dw_grammar', []);
  state.gstats = load('dw_gramstats', {});
}

// Fix up data saved by older versions of the app.
export function normalize() {
  // Give older entries unique ids (several essays per day are allowed).
  state.entries.forEach((entry, i) => {
    if (!entry.id) {
      entry.id = `e${(entry.date || '').replace(/[^0-9]/g, '')}-${i}`;
      persistEntry(entry);
    }
  });

  // Meanings are for single words only, so clear any stored on phrases.
  let changed = false;
  for (const v of state.vocab) {
    if (String(v.word || '').trim().includes(' ') && v.meaning) {
      v.meaning = '';
      changed = true;
    }
  }
  if (changed) save('dw_vocab', state.vocab);
}
