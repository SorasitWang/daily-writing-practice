// Entry point: wire up every tab, draw the page, then load the learner's data.
import { initChat } from './chat.js';
import { setCoachChecked, setSampleFn, useApiKeyMode } from './coach.js';
import { $ } from './dom.js';
import { initFeedback, renderFeedback } from './feedback.js';
import { initGrammar, renderGrammarList } from './grammar.js';
import { initTabs } from './history.js';
import { renderAll } from './render.js';
import { initSettings, refreshSettingsUI, setDownloadsApi } from './settings.js';
import { initStages } from './stages.js';
import { state } from './state.js';
import { loadLocal, normalize, STORE, syncLabel } from './storage.js';
import { deepCopy, dstr } from './util.js';
import { initVocab, renderVocab } from './vocab.js';
import { initWrite } from './write.js';

// Inside a Claude artifact, window.claude.use(name) gives access to Claude features.
// Elsewhere every feature resolves to null.
const claudeApi = window.claude && typeof window.claude.use === 'function' ? window.claude : null;

function useClaudeFeature(name) {
  if (!claudeApi) return Promise.resolve(null);
  return Promise.resolve(claudeApi.use(name)).catch(() => null);
}

// Load the notebook and entries from the learner's Claude account. Returns false if unavailable.
async function loadFromClaudeAccount() {
  const [db, user] = await Promise.all([useClaudeFeature('db'), useClaudeFeature('user')]);
  if (!db || !user) return false;
  const uid = await user.id();
  if (!uid) return false;

  const notebookRef = db.doc(`data/users/${uid}/notebook`);
  const entriesCol = notebookRef.collection('entries');
  const [notebookDoc, entryDocs] = await Promise.all([notebookRef.get(), entriesCol.get()]);

  Object.assign(STORE, { mode: 'db', nbRef: notebookRef, entriesCol });
  const notebook = notebookDoc.exists ? notebookDoc.data() || {} : {};
  state.vocab = deepCopy(notebook.vocab || []);
  state.grammar = deepCopy(notebook.grammar || []);
  state.gstats = deepCopy(notebook.gramstats || {});
  state.entries = entryDocs.docs.map((d) => deepCopy(d.data() || {}));
  return true;
}

// Reopen the latest essay written today, with its feedback.
function restoreToday() {
  if ($('entry').value.trim()) return;
  const today = dstr(new Date());
  const todays = state.entries
    .filter((e) => e.date === today)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  const latest = todays[todays.length - 1];
  if (!latest) return;

  $('entry').value = latest.text;
  state.currentEntryId = latest.id;
  $('entry').dispatchEvent(new Event('input'));

  const { feedback } = latest;
  if (feedback && feedback.overall) {
    state.lastFeedback = feedback;
    renderFeedback(feedback.strengths ? feedback : null, feedback.overall);
  }
}

async function boot() {
  useClaudeFeature('sample').then((sample) => {
    if (sample) setSampleFn(sample);
    else useApiKeyMode(); // outside Claude, fall back to the learner's own API key
    setCoachChecked(true);
    refreshSettingsUI();
    renderVocab();
    renderGrammarList();
  });
  useClaudeFeature('downloads').then(setDownloadsApi);

  const loaded = await loadFromClaudeAccount().catch(() => false);
  if (!loaded) loadLocal();
  normalize();
  syncLabel();
  restoreToday();
  renderAll();
}

initSettings();
initWrite();
initFeedback();
initStages();
initChat();
initGrammar();
initVocab();
initTabs();

$('today').textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
renderAll();
$('hList').innerHTML = '<div class="empty">Loading your entries…</div>';
syncLabel();
boot();
