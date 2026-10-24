// Small builders for the HTML snippets the coach views repeat.
// Every value from the coach or the learner goes through esc().
import { esc } from './dom.js';

// A titled feedback section. `body` is already-built HTML.
export function section(title, body) {
  return `<div class="fb-section"><div class="fb-title">${title}</div>${body}</div>`;
}

// A section with one row per item, or '' when there are no items.
export function listSection(title, items, renderItem) {
  if (!items || !items.length) return '';
  return section(title, items.map(renderItem).join(''));
}

export const whyNote = (text) => `<span class="why">${esc(text || '')}</span>`;

// "original → better" — origClass is 'orig' (wrong) or 'soso' (fine but plain).
export function change(original, better, origClass = 'orig') {
  return `<span class="${origClass}">${esc(original)}</span> → <span class="better">${esc(better)}</span>`;
}

// "Yours" and "Model" side by side.
export function sideBySide(yours, model, modelLabel) {
  return '<div class="side">'
    + `<div><div class="label">Yours</div>${esc(yours)}</div>`
    + `<div class="model"><div class="label">${modelLabel}</div>${esc(model)}</div>`
    + '</div>';
}

// "+ Notebook" button that adds a word or phrase to the vocab notebook.
export function addVocabButton(word, register, example, meaning) {
  return '<button class="btn-sm btn-add"'
    + ` data-word="${esc(word)}"`
    + ` data-reg="${esc(register || 'neutral')}"`
    + ` data-ex="${esc(example || '')}"`
    + ` data-mean="${esc(meaning || '')}"`
    + '>+ Notebook</button>';
}

// "+ Notebook" button that adds a mistake to the grammar notebook.
export function addGrammarButton(original, fix, why, category) {
  return '<button class="btn-sm btn-add btn-addg"'
    + ` data-orig="${esc(original)}"`
    + ` data-fix="${esc(fix || '')}"`
    + ` data-why="${esc(why || '')}"`
    + ` data-cat="${esc(category || '')}"`
    + '>+ Notebook</button>';
}

export const emptyNote = (text) => `<div class="empty">${text}</div>`;
export const spinner = (text) => `<div class="spinner">${text}</div>`;
