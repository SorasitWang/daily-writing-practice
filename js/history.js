// History tab and tab switching.
import { $, esc } from './dom.js';
import { state } from './state.js';
import { countWords } from './util.js';

const TABS = ['write', 'notebook', 'history', 'settings'];

function newestFirst(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return String(b.time || '').localeCompare(String(a.time || ''));
}

function historyRow(entry) {
  const { feedback } = entry;
  let extra = '';
  if (feedback && feedback.overall) {
    extra += `<div class="fb-section"><div class="fb-title">Feedback</div>`
      + `<div class="overall">${esc(feedback.overall)}</div></div>`;
  }
  if (feedback && feedback.rewrite) {
    extra += `<div class="fb-section"><div class="fb-title">Rewrite</div>${esc(feedback.rewrite)}</div>`;
  }
  const time = entry.time ? ` · ${esc(entry.time)}` : '';
  return '<div class="hrow">'
    + `<div class="hdate">${esc(entry.date)}${time} <span class="vtag">${esc(entry.fmt || '')}</span></div>`
    + `<div class="htopic">${esc(entry.topic)} · ${countWords(entry.text)} words</div>`
    + `<div class="hbody">${esc(entry.text)}${extra}</div>`
    + '</div>';
}

export function renderHistory() {
  const list = $('hList');
  if (!state.entries.length) {
    list.innerHTML = '<div class="empty">No entries yet. Today is a great day to start.</div>';
    return;
  }
  list.innerHTML = state.entries.slice().sort(newestFirst).map(historyRow).join('');
  for (const row of list.querySelectorAll('.hrow')) {
    row.onclick = () => row.classList.toggle('open');
  }
}

export function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  for (const tab of tabs) {
    tab.onclick = () => {
      for (const t of tabs) t.classList.remove('active');
      tab.classList.add('active');
      for (const name of TABS) {
        $(`tab-${name}`).style.display = name === tab.dataset.tab ? '' : 'none';
      }
    };
  }
}
