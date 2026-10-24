// Settings tab: coach status, API key, coach depth, and data export / import.
import { coachChecked, coachMode, currentTier, hasApiKey, useApiKeyMode } from './coach.js';
import { $, setStatus } from './dom.js';
import { renderGrammarList } from './grammar.js';
import { renderAll } from './render.js';
import { state } from './state.js';
import { lsRemove, lsSet, persistEntry, save, STORE } from './storage.js';
import { dstr, errorText, normGram } from './util.js';
import { renderVocab } from './vocab.js';

// ---------- Coach status ----------

export function refreshSettingsUI() {
  const ready = hasApiKey();
  const status = $('coachStatus');

  if (coachMode === 'apikey') {
    $('coachIntro').textContent = 'Feedback and chat use your own Anthropic API key, billed to your Anthropic account. '
      + 'The key is stored only in this browser and is sent only to api.anthropic.com.';
    $('dataIntro').textContent = 'Entries, vocab and grammar notes are saved in this browser only. '
      + 'Use Export now and then to keep a backup, and Import to move data to another browser or device.';
    $('keyBox').hidden = false;
    status.textContent = ready
      ? 'API key saved. The coach is ready.'
      : 'Add your API key to turn on feedback and chat.';
  } else if (ready) {
    status.textContent = 'Connected to your Claude account.';
  } else {
    status.textContent = coachChecked
      ? "The coach isn't available in this view. Open the page in Claude to use it."
      : 'Connecting…';
  }
  status.className = ready ? 'ok-note' : 'hint';

  $('tierInput').value = currentTier();
  $('settingsTab').classList.toggle('warn', !ready && coachChecked);
}

function afterKeyChange() {
  useApiKeyMode();
  refreshSettingsUI();
  renderVocab();
  renderGrammarList();
}

// ---------- Export ----------

// Claude artifact downloads API, when available.
let downloadsApi = null;

export function setDownloadsApi(api) {
  downloadsApi = api;
}

function downloadFile(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportData() {
  const payload = {
    dw_entries: state.entries,
    dw_vocab: state.vocab,
    dw_grammar: state.grammar,
    dw_gramstats: state.gstats,
    exportedAt: new Date().toISOString(),
    source: 'daily-writing-practice',
  };
  const text = JSON.stringify(payload, null, 2);
  const filename = `daily-writing-practice-backup-${dstr(new Date())}.json`;
  const status = $('importStatus');
  const showError = (e) => setStatus(status, `Export failed: ${errorText(e)}`, 'err-note');

  if (!downloadsApi) {
    try {
      downloadFile(filename, text);
      status.textContent = '';
    } catch (e) {
      showError(e);
    }
    return;
  }

  downloadsApi.save({ filename, data: text }).then(
    () => { status.textContent = ''; },
    (e) => {
      if (e && (e.code === 'declined' || e.code === 'cancelled')) return;
      showError(e);
    },
  );
}

// ---------- Import ----------

// Merge a backup into the current data, skipping duplicates. Returns how many items were added.
function mergeBackup(data) {
  let imported = 0;

  if (Array.isArray(data.dw_entries)) {
    const have = new Set(state.entries.map((e) => e.id));
    data.dw_entries.forEach((entry, i) => {
      if (!entry || !entry.text) return;
      if (!entry.id) entry.id = `e${String(entry.date || '').replace(/[^0-9]/g, '')}-imp${i}`;
      entry.id = String(entry.id).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_');
      if (have.has(entry.id)) return;
      state.entries.push(entry);
      have.add(entry.id);
      persistEntry(entry);
      imported++;
    });
    if (STORE.mode !== 'db') save('dw_entries', state.entries);
  }

  if (Array.isArray(data.dw_vocab)) {
    for (const v of data.dw_vocab) {
      const word = v && v.word && String(v.word).toLowerCase();
      if (word && !state.vocab.some((x) => x.word.toLowerCase() === word)) {
        state.vocab.push(v);
        imported++;
      }
    }
  }

  if (Array.isArray(data.dw_grammar)) {
    for (const g of data.dw_grammar) {
      if (g && g.original && !state.grammar.some((x) => normGram(x.original) === normGram(g.original))) {
        state.grammar.push(g);
        imported++;
      }
    }
  }

  if (data.dw_gramstats && typeof data.dw_gramstats === 'object') {
    for (const [date, counts] of Object.entries(data.dw_gramstats)) {
      if (!state.gstats[date]) {
        state.gstats[date] = counts;
        imported++;
      }
    }
  }

  return imported;
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const status = $('importStatus');
    try {
      const imported = mergeBackup(JSON.parse(reader.result));
      if (!imported) throw new Error('Nothing new in that file.');
      save('dw_vocab', state.vocab);
      setStatus(status, `Imported ${imported} item${imported === 1 ? '' : 's'} ✓`, 'ok-note');
      renderAll();
    } catch (err) {
      setStatus(status, `Import failed: ${errorText(err)}`, 'err-note');
    }
  };
  reader.readAsText(file);
}

// ---------- Wiring ----------

export function initSettings() {
  $('keySave').onclick = () => {
    const key = $('keyInput').value.trim();
    if (!key) return;
    lsSet('dw_api_key', key);
    $('keyInput').value = '';
    afterKeyChange();
  };

  $('keyClear').onclick = () => {
    lsRemove('dw_api_key');
    $('keyInput').value = '';
    afterKeyChange();
  };

  $('modelSave').onclick = () => {
    lsSet('dw_tier', $('tierInput').value);
    setStatus($('modelStatus'), 'Saved.', 'ok-note');
    setTimeout(() => { $('modelStatus').textContent = ''; }, 2000);
  };

  $('exportBtn').onclick = exportData;

  $('importFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    importFile(file);
    e.target.value = '';
  });
}
