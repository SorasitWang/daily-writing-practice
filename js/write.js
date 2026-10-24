// Write tab: today's topic, target words, word count, streak, and saving entries.
import { resetChat } from './chat.js';
import { FORMATS, TARGET_POOL } from './data/topics.js';
import { $, esc } from './dom.js';
import { resetStages } from './stages.js';
import { renderHistory } from './history.js';
import { state } from './state.js';
import { persistEntry, STORE } from './storage.js';
import { countWords, dayOfYear, dstr } from './util.js';
import { vocabType } from './vocab.js';

// ---------- Topic ----------

let topicShuffle = 0; // bumped by the "shuffle topic" button

export function currentTopic() {
  const now = new Date();
  const format = FORMATS[now.getDay()];
  const topic = format.topics[(dayOfYear(now) + topicShuffle) % format.topics.length];
  return { fmt: format.name, hint: format.hint, topic };
}

export function renderTopic() {
  const { fmt, topic, hint } = currentTopic();
  $('fmt').textContent = fmt;
  $('topic').textContent = topic;
  $('topicHint').textContent = hint;
}

// ---------- Target words ----------

let targetShuffle = 0; // bumped by the "shuffle words" button

// 3 new words from the format's pool, up to 2 words from the notebook, topped up to 5 from the pool.
// Each target: { w: word, m: meaning, src: 'new' | 'notebook' }.
export function currentTargets() {
  const pool = TARGET_POOL[currentTopic().fmt] || TARGET_POOL.Reflection;
  const start = dayOfYear(new Date()) * 3 + targetShuffle;
  const fromPool = (i) => pool[(start + i) % pool.length];

  const picks = [];
  const has = (word) => picks.some((p) => p.w === word);
  const hasIgnoringCase = (word) => picks.some((p) => p.w.toLowerCase() === word.toLowerCase());

  for (let i = 0; picks.length < 3 && i < pool.length; i++) {
    const cand = fromPool(i);
    if (!has(cand.w)) picks.push({ w: cand.w, m: cand.m, src: 'new' });
  }

  const offset = targetShuffle % 2;
  const notebookWords = state.vocab
    .filter((v) => vocabType(v) === 'word' && v.meaning)
    .slice(offset, offset + 2)
    .map((v) => ({ w: v.word, m: v.meaning, src: 'notebook' }));
  for (const word of notebookWords) {
    if (!hasIgnoringCase(word.w)) picks.push(word);
  }

  for (let i = 3; picks.length < 5 && i < pool.length + 3; i++) {
    const extra = fromPool(i);
    if (!has(extra.w)) picks.push({ w: extra.w, m: extra.m, src: 'new' });
  }
  return picks;
}

// True if the word (or a simple inflection like -s, -ed, -ing) appears in the text.
function wordUsed(word, text) {
  const stem = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${stem}(s|es|ed|d|ing)?\\b`, 'i').test(text);
}

export function renderTargets() {
  const text = $('entry').value;
  $('targetList').innerHTML = currentTargets().map((t) => {
    const used = wordUsed(t.w, text);
    const tag = t.src === 'notebook' ? '<span class="vtag">notebook</span>' : '';
    return `<div class="tw${used ? ' used' : ''}">`
      + `<span class="mark">${used ? '✓' : '○'}</span>`
      + `<span class="twword">${esc(t.w)}</span>`
      + tag
      + `<span class="twmean">${esc(t.m)}</span>`
      + '</div>';
  }).join('');
}

// ---------- Streak ----------

export function renderStreak() {
  const daysWritten = new Set(state.entries.map((e) => e.date));
  const day = new Date();
  if (!daysWritten.has(dstr(day))) day.setDate(day.getDate() - 1); // the streak survives until today is over

  let streak = 0;
  while (daysWritten.has(dstr(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  $('streak').textContent = `🔥 ${streak}-day streak`;
}

// ---------- Saving ----------

// Save the essay being edited (creating a new entry the first time).
// silent = true skips the "Saved" note, for automatic saves after feedback.
export function saveEntry(silent) {
  const text = $('entry').value.trim();
  if (!text || STORE.mode === 'loading') return;

  const { topic, fmt } = currentTopic();
  let entry = state.currentEntryId && state.entries.find((e) => e.id === state.currentEntryId);
  if (entry) {
    Object.assign(entry, { text, topic, fmt, feedback: state.lastFeedback || entry.feedback });
  } else {
    const now = new Date();
    entry = {
      id: 'e' + Date.now().toString(36),
      date: dstr(now),
      time: now.toTimeString().slice(0, 5),
      topic,
      fmt,
      text,
      feedback: state.lastFeedback,
    };
    state.entries.push(entry);
    state.currentEntryId = entry.id;
  }
  persistEntry(entry);
  renderStreak();
  renderHistory();

  if (silent) return;
  const note = $('savedNote');
  note.style.display = 'inline';
  setTimeout(() => { note.style.display = 'none'; }, 2000);
}

function startNewEntry() {
  state.currentEntryId = null;
  state.lastFeedback = null;
  $('entry').value = '';
  $('entry').dispatchEvent(new Event('input'));
  $('fbCard').style.display = 'none';
  $('fbBody').innerHTML = '';
  resetStages();
  resetChat(false);
  $('entry').focus();
}

function updateWordCount() {
  const n = countWords($('entry').value);
  const el = $('wc');
  el.textContent = `${n} words`;
  el.className = 'wc' + (n >= 100 && n <= 200 ? ' ok' : '');
  renderTargets();
}

// ---------- Wiring ----------

export function initWrite() {
  $('shuffleBtn').onclick = () => {
    topicShuffle++;
    renderTopic();
  };
  $('targetShuffle').onclick = () => {
    targetShuffle++;
    renderTargets();
  };
  $('entry').addEventListener('input', updateWordCount);
  $('saveBtn').onclick = () => saveEntry(false);
  $('newBtn').onclick = startNewEntry;
}
