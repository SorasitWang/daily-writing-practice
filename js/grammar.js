// Grammar notebook: saved mistakes, grouped by category, plus automatic mistake counts.
import { callClaude, hasApiKey } from './coach.js';
import { $, esc } from './dom.js';
import { emptyNote } from './html.js';
import { GRAMMAR_CATEGORY_PROMPT } from './prompts.js';
import { state } from './state.js';
import { lsGet, lsSet, save } from './storage.js';
import { dstr, extractJSON, normGram, textHash } from './util.js';

// ---------- Categories ----------

export const GCATS = [
  { id: 'tense', label: 'Tense' },
  { id: 'sva', label: 'Subject–verb agreement' },
  { id: 'plural', label: 'Plural / singular' },
  { id: 'articles', label: 'Articles' },
  { id: 'prep', label: 'Prepositions' },
  { id: 'gerund', label: 'Gerund / infinitive' },
  { id: 'wordform', label: 'Word form' },
  { id: 'wordorder', label: 'Word order' },
  { id: 'cond', label: 'Conditionals' },
  { id: 'passive', label: 'Passive voice' },
  { id: 'punct', label: 'Punctuation' },
  { id: 'other', label: 'Other / naturalness' },
];

export function catLabel(id) {
  const cat = GCATS.find((c) => c.id === id);
  return cat ? cat.label : 'Other / naturalness';
}

// Free-text category from the coach -> category id. The first matching rule wins.
const CATEGORY_KEYWORDS = [
  ['tense', ['tense', 'perfect']],
  ['sva', ['agreement', 'subject']],
  ['plural', ['plural', 'singular', 'count']],
  ['articles', ['article']],
  ['prep', ['preposition']],
  ['gerund', ['gerund', 'infinitive']],
  ['wordform', ['word form', 'form']],
  ['wordorder', ['order']],
  ['cond', ['condition']],
  ['passive', ['passive']],
  ['punct', ['punct', 'comma']],
];

export function catFromString(text) {
  const s = String(text || '').toLowerCase();
  if (GCATS.some((c) => c.id === s)) return s;
  const rule = CATEGORY_KEYWORDS.find(([, keywords]) => keywords.some((k) => s.includes(k)));
  return rule ? rule[0] : 'other';
}

// ---------- Adding mistakes ----------

export function addGrammar(original, fix, why, category) {
  if (!original) return;
  const today = dstr(new Date());
  const existing = state.grammar.find((g) => normGram(g.original) === normGram(original));

  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.last = today;
    if (fix && !existing.fix) existing.fix = fix;
    if (why && !existing.why) existing.why = why;
    if (category && (!existing.cat || existing.cat === 'other')) existing.cat = catFromString(category);
    existing.fixed = false; // it came back, so un-retire it
  } else {
    state.grammar.unshift({
      original,
      fix: fix || '',
      why: why || '',
      cat: catFromString(category),
      count: 1,
      added: today,
      last: today,
      fixed: false,
    });
  }
  save('dw_grammar', state.grammar);
  renderGrammarList();
}

// ---------- Automatic mistake counts ----------

// Count the grammar points in a piece of feedback by category, under today's date.
export function recordGramStats(feedbackGrammar, text) {
  // Don't double-count when the same text is reviewed again without edits.
  const hash = textHash(text);
  if (lsGet('dw_gramhash') === hash) return;
  lsSet('dw_gramhash', hash);

  const today = dstr(new Date());
  const counts = state.gstats[today] || (state.gstats[today] = {});
  for (const g of feedbackGrammar) {
    const cat = catFromString(g.category);
    counts[cat] = (counts[cat] || 0) + 1;
  }
  save('dw_gramstats', state.gstats);
  renderGramStats();
}

export function renderGramStats() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekStart = dstr(weekAgo);

  const total = {};
  const thisWeek = {};
  for (const [date, counts] of Object.entries(state.gstats)) {
    for (const [cat, n] of Object.entries(counts)) {
      if (!n) continue;
      total[cat] = (total[cat] || 0) + n;
      if (date >= weekStart) thisWeek[cat] = (thisWeek[cat] || 0) + n;
    }
  }

  const box = $('gStats');
  if (!Object.keys(total).length) {
    box.innerHTML = emptyNote('No data yet — counts appear after your next feedback.');
    return;
  }

  const max = Math.max(...Object.values(total));
  box.innerHTML = GCATS
    .filter((c) => total[c.id])
    .sort((a, b) => total[b.id] - total[a.id])
    .map((c) => {
      const width = Math.round((total[c.id] / max) * 100);
      return '<div class="stat-row">'
        + `<div class="stat-label">${c.label}</div>`
        + `<div class="stat-bar-wrap"><div class="stat-bar" style="width:${width}%"></div></div>`
        + `<div class="stat-num">${total[c.id]} total · ${thisWeek[c.id] || 0} this week</div>`
        + '</div>';
    })
    .join('');
}

// ---------- One-time categorization of mistakes saved before categories existed ----------

function renderGramMigrate() {
  const box = $('gMigrateBox');
  const missing = state.grammar.filter((g) => !g.cat);
  if (!missing.length || !hasApiKey()) {
    box.innerHTML = '';
    return;
  }
  const noun = missing.length === 1 ? 'entry' : 'entries';
  box.innerHTML = '<button class="btn-sm btn-add" id="gMigrateBtn" style="margin-bottom:8px">'
    + `🏷 Categorize ${missing.length} existing ${noun}</button>`;

  $('gMigrateBtn').onclick = async () => {
    const button = $('gMigrateBtn');
    button.disabled = true;
    button.textContent = 'Categorizing…';
    const items = missing.map((g) => ({ original: g.original, fix: g.fix || '' }));
    try {
      const reply = String(await callClaude(GRAMMAR_CATEGORY_PROMPT, [JSON.stringify(items)]));
      const categories = extractJSON(reply)?.categories;
      if (!categories) throw new Error('unexpected response');
      for (const g of state.grammar) {
        if (g.cat) continue;
        const key = Object.keys(categories).find((k) => normGram(k) === normGram(g.original));
        g.cat = catFromString(key ? categories[key] : 'other');
      }
      save('dw_grammar', state.grammar);
      renderGrammarList();
    } catch {
      button.disabled = false;
      button.textContent = 'Failed — try again';
    }
  };
}

// ---------- Mistake list ----------

// Active mistakes first, then most frequent, then most recent.
function byPriority(a, b) {
  if (!!a.fixed !== !!b.fixed) return a.fixed ? 1 : -1;
  if ((b.count || 1) !== (a.count || 1)) return (b.count || 1) - (a.count || 1);
  return String(b.last || b.added || '').localeCompare(String(a.last || a.added || ''));
}

function grammarRow(g) {
  const index = state.grammar.indexOf(g);
  const count = g.count || 1;
  return `<div class="vrow grow${g.fixed ? ' fixed' : ''}">`
    + '<div class="gmain">'
    + `<span class="orig">${esc(g.original)}</span>`
    + (g.fix ? ` → <span class="better">${esc(g.fix)}</span>` : '')
    + (count > 1 ? `<span class="gtag">×${count}</span>` : '')
    + (g.fixed ? '<span class="vtag">fixed</span>' : '')
    + (g.why ? `<div class="vex">${esc(g.why)}</div>` : '')
    + '</div>'
    + '<div class="gbtns">'
    + `<button class="btn-sm ${g.fixed ? 'btn-ghost' : 'btn-add'}" data-act="toggle" data-i="${index}">`
    + `${g.fixed ? 'Reopen' : 'Mark fixed'}</button>`
    + `<button class="btn-sm btn-danger" data-act="del" data-i="${index}">✕</button>`
    + '</div>'
    + '</div>';
}

const groupHeading = (label, count) => `<div class="label" style="margin-top:14px">${label} (${count})</div>`;

export function renderGrammarList() {
  $('gCount').textContent = state.grammar.length;
  renderGramMigrate();

  const list = $('gList');
  if (!state.grammar.length) {
    list.innerHTML = emptyNote('No mistakes logged yet — add one above, '
      + 'or click "+ Notebook" on a grammar point in your feedback.');
    return;
  }

  const groups = {};
  for (const g of state.grammar.slice().sort(byPriority)) {
    const cat = g.cat || 'uncategorized';
    (groups[cat] = groups[cat] || []).push(g);
  }
  const ordered = [...GCATS, { id: 'uncategorized', label: 'Uncategorized' }];
  list.innerHTML = ordered
    .filter((cat) => groups[cat.id])
    .map((cat) => groupHeading(cat.label, groups[cat.id].length) + groups[cat.id].map(grammarRow).join(''))
    .join('');

  for (const button of list.querySelectorAll('button')) {
    button.onclick = () => {
      const index = +button.dataset.i;
      const g = state.grammar[index];
      if (!g) return;
      if (button.dataset.act === 'toggle') g.fixed = !g.fixed;
      else state.grammar.splice(index, 1);
      save('dw_grammar', state.grammar);
      renderGrammarList();
    };
  }
}

// ---------- Wiring ----------

export function initGrammar() {
  for (const cat of GCATS) {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.label;
    $('gCat').appendChild(option);
  }

  $('gAdd').onclick = () => {
    const original = $('gWrong').value.trim();
    if (!original) return;
    addGrammar(original, $('gFix').value.trim(), $('gWhy').value.trim(), $('gCat').value);
    $('gWrong').value = '';
    $('gFix').value = '';
    $('gWhy').value = '';
  };
}
