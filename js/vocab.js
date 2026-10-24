// Vocab notebook: saved words and phrases, with search.
import { callClaude, hasApiKey } from './coach.js';
import { $, esc } from './dom.js';
import { emptyNote } from './html.js';
import { VOCAB_MEANING_PROMPT } from './prompts.js';
import { state } from './state.js';
import { save } from './storage.js';
import { dstr, extractJSON } from './util.js';

const isPhrase = (word) => String(word || '').trim().includes(' ');

export function vocabType(v) {
  return v.type || (isPhrase(v.word) ? 'phrase' : 'word');
}

export function addVocab(word, register, example, meaning) {
  if (!word) return;
  if (state.vocab.some((v) => v.word.toLowerCase() === word.toLowerCase())) return;
  const type = isPhrase(word) ? 'phrase' : 'word';
  state.vocab.unshift({
    word,
    register: register || 'neutral',
    example: example || '',
    meaning: type === 'word' ? meaning || '' : '', // meanings are for single words only
    type,
    added: dstr(new Date()),
  });
  save('dw_vocab', state.vocab);
  renderVocab();
}

// ---------- One-time meanings for words saved before meanings existed ----------

function renderMigrate() {
  const box = $('migrateBox');
  const missing = state.vocab.filter((v) => !v.meaning && vocabType(v) === 'word');
  if (!missing.length || !hasApiKey()) {
    box.innerHTML = '';
    return;
  }
  const noun = missing.length === 1 ? 'entry' : 'entries';
  box.innerHTML = `<button class="btn-sm btn-add" id="migrateBtn">✨ Add meanings to ${missing.length} existing ${noun}</button>`;

  $('migrateBtn').onclick = async () => {
    const button = $('migrateBtn');
    button.disabled = true;
    button.textContent = 'Generating meanings…';
    const items = missing.map((v) => ({ word: v.word, example: v.example || '' }));
    try {
      const reply = String(await callClaude(VOCAB_MEANING_PROMPT, [JSON.stringify(items)]));
      const meanings = extractJSON(reply)?.meanings;
      if (!meanings) throw new Error('unexpected response');

      let updated = 0;
      for (const v of state.vocab) {
        if (v.meaning) continue;
        const key = Object.keys(meanings).find((k) => k.toLowerCase() === v.word.toLowerCase());
        if (key && meanings[key]) {
          v.meaning = String(meanings[key]);
          updated++;
        }
        if (!v.type) v.type = isPhrase(v.word) ? 'phrase' : 'word';
      }
      save('dw_vocab', state.vocab);
      renderVocab();
      if (!updated) {
        button.disabled = false;
        button.textContent = 'No meanings returned — try again';
      }
    } catch {
      button.disabled = false;
      button.textContent = 'Failed — try again';
    }
  };
}

// ---------- Word list ----------

function vocabRow(v) {
  return '<div class="vrow"><div>'
    + `<span class="vword">${esc(v.word)}</span><span class="vtag">${esc(v.register)}</span>`
    + (v.meaning ? `<div class="vmean">${esc(v.meaning)}</div>` : '')
    + (v.example ? `<div class="vex">${esc(v.example)}</div>` : '')
    + '</div>'
    + `<button class="btn-sm btn-danger" data-w="${esc(v.word)}">✕</button>`
    + '</div>';
}

function matchesSearch(v, query) {
  if (!query) return true;
  return [v.word, v.example, v.meaning].some((field) => (field || '').toLowerCase().includes(query));
}

export function renderVocab() {
  const query = $('vSearch').value.toLowerCase();
  const matches = state.vocab.filter((v) => matchesSearch(v, query));
  $('vCount').textContent = state.vocab.length;
  renderMigrate();

  const list = $('vList');
  if (!matches.length) {
    list.innerHTML = emptyNote(state.vocab.length
      ? 'No matches.'
      : 'No words yet — get feedback on an entry and add suggestions here.');
    return;
  }

  const words = matches.filter((v) => vocabType(v) === 'word');
  const phrases = matches.filter((v) => vocabType(v) === 'phrase');
  let html = '';
  if (words.length) {
    html += `<div class="label" style="margin-top:8px">Words (${words.length})</div>${words.map(vocabRow).join('')}`;
  }
  if (phrases.length) {
    html += `<div class="label" style="margin-top:14px">Phrases (${phrases.length})</div>${phrases.map(vocabRow).join('')}`;
  }
  list.innerHTML = html;

  for (const button of list.querySelectorAll('.btn-danger')) {
    button.onclick = () => {
      state.vocab = state.vocab.filter((v) => v.word !== button.dataset.w);
      save('dw_vocab', state.vocab);
      renderVocab();
    };
  }
}

// ---------- Wiring ----------

export function initVocab() {
  $('nAdd').onclick = () => {
    addVocab($('nWord').value.trim(), $('nReg').value, $('nEx').value.trim(), $('nMean').value.trim());
    $('nWord').value = '';
    $('nEx').value = '';
    $('nMean').value = '';
  };
  $('vSearch').addEventListener('input', renderVocab);
}
