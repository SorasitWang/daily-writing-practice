// After feedback: rewrite the essay and compare it with the first draft,
// or ask for a model version of one paragraph.
import { callClaude, hasApiKey } from './coach.js';
import { $, esc } from './dom.js';
import { bindAddButtons } from './feedback.js';
import { addVocabButton, change, emptyNote, listSection, sideBySide, spinner, whyNote } from './html.js';
import { COMPARE_PROMPT, modelPrompt } from './prompts.js';
import { state } from './state.js';
import { countWords, errorText, extractJSON, splitParas } from './util.js';
import { currentTopic, saveEntry } from './write.js';

const UNEXPECTED_REPLY = 'The coach replied in an unexpected format. Try again.';

export function resetStages() {
  $('rwBox').hidden = true;
  $('mdBox').hidden = true;
  $('rwText').value = '';
  $('rwResult').innerHTML = '';
  $('mdResult').innerHTML = '';
  $('rwWc').textContent = '0 words';
}

// Show the rewrite and model boxes for this feedback, restoring any saved results.
export function showStages(fb) {
  if (!hasApiKey() && !fb.compare && !fb.model) return;
  const text = $('entry').value;

  $('rwBox').hidden = false;
  $('mdBox').hidden = false;
  $('rwText').value = fb.rewrite || text;
  $('rwText').dispatchEvent(new Event('input'));
  $('rwResult').innerHTML = fb.compare ? renderCompare(fb.compare) : '';

  $('mdPara').innerHTML = splitParas(text).map((p, i) => {
    const preview = p.length > 48 ? p.slice(0, 48) + '…' : p;
    return `<option value="${i}">Paragraph ${i + 1}: ${esc(preview)}</option>`;
  }).join('');

  if (fb.model) {
    $('mdResult').innerHTML = renderModel(fb.model);
    bindAddButtons($('mdResult'));
  } else {
    $('mdResult').innerHTML = '';
  }
}

// ---------- Rewrite comparison ----------

const IMPROVEMENT_LABELS = { big: 'Big improvement', clear: 'Clear improvement', small: 'Small improvement' };

function renderCompare(c) {
  const label = IMPROVEMENT_LABELS[c.improvement];
  return '<div class="fb-section">'
    + (label ? `<span class="verdict ${c.improvement}">${label}</span>` : '')
    + (c.verdict ? `<div class="overall">${esc(c.verdict)}</div>` : '')
    + listSection('✅ Fixes you applied', c.applied, (a) => '<div class="fb-item up">'
      + esc(a.point)
      + (a.how ? `<span class="why">“${esc(a.how)}”</span>` : '')
      + '</div>')
    + listSection('↩️ Still to fix', c.missed, (m) => '<div class="fb-item word">'
      + esc(m.point)
      + (m.tip ? whyNote(m.tip) : '')
      + '</div>')
    + listSection('⚠️ New issues in the rewrite', c.newIssues, (g) => '<div class="fb-item gram">'
      + change(g.original, g.fix)
      + whyNote(g.why)
      + '</div>')
    + '</div>';
}

async function compareRewrite() {
  const draft = $('entry').value.trim();
  const rewrite = $('rwText').value.trim();
  const feedback = state.lastFeedback;
  if (!feedback || !rewrite) return;
  if (rewrite === draft) {
    $('rwResult').innerHTML = emptyNote('Change something first. Your rewrite is the same as the first draft.');
    return;
  }

  const button = $('rwBtn');
  button.disabled = true;
  button.textContent = 'Comparing…';
  $('rwResult').innerHTML = spinner('Comparing your two drafts…');

  const { wordChoice, upgrades, grammar, structure } = feedback;
  const data = [
    'FIRST DRAFT:\n' + draft,
    'FEEDBACK:\n' + JSON.stringify({ wordChoice, upgrades, grammar, structure }),
    'REWRITE:\n' + rewrite,
  ];
  try {
    const comparison = extractJSON(String(await callClaude(COMPARE_PROMPT, data, 1500)));
    if (!comparison) throw new Error(UNEXPECTED_REPLY);
    feedback.rewrite = rewrite;
    feedback.compare = comparison;
    $('rwResult').innerHTML = renderCompare(comparison);
    saveEntry(true);
  } catch (e) {
    $('rwResult').innerHTML = emptyNote(`Comparison failed. ${esc(errorText(e))}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Compare with first draft';
  }
}

// ---------- Model paragraph ----------

function modelNote(n) {
  const yours = n.yours ? `<span class="soso">${esc(n.yours)}</span> → ` : '';
  const addButton = n.model && countWords(n.model) <= 6 ? addVocabButton(n.model, 'neutral', n.why) : '';
  return '<div class="fb-item up">'
    + `<b>${esc(n.technique || '')}</b><br>`
    + `${yours}<span class="better">${esc(n.model || '')}</span> `
    + addButton
    + whyNote(n.why)
    + '</div>';
}

function renderModel(m) {
  return sideBySide(m.original || '', m.rewrite || '', 'Model')
    + listSection('What the model does differently', m.notes, modelNote);
}

async function showModel() {
  const paragraph = splitParas($('entry').value)[+$('mdPara').value || 0];
  if (!paragraph || !state.lastFeedback) return;

  const button = $('mdBtn');
  button.disabled = true;
  button.textContent = 'Writing…';
  $('mdResult').innerHTML = spinner('Writing a model version…');

  try {
    const model = extractJSON(String(await callClaude(modelPrompt(currentTopic()), [paragraph], 1500)));
    if (!model || !model.rewrite) throw new Error(UNEXPECTED_REPLY);
    model.original = paragraph;
    state.lastFeedback.model = model;
    $('mdResult').innerHTML = renderModel(model);
    bindAddButtons($('mdResult'));
    saveEntry(true);
  } catch (e) {
    $('mdResult').innerHTML = emptyNote(`Model rewrite failed. ${esc(errorText(e))}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Show model';
  }
}

// ---------- Wiring ----------

export function initStages() {
  $('rwText').addEventListener('input', () => {
    $('rwWc').textContent = `${countWords($('rwText').value)} words`;
  });
  $('rwBtn').onclick = compareRewrite;
  $('mdBtn').onclick = showModel;
}
