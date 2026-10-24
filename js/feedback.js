// The feedback card: asking the coach for feedback and showing it.
import { resetChat } from './chat.js';
import { callClaude, coachChecked, coachMode, hasApiKey } from './coach.js';
import { $, esc } from './dom.js';
import { addGrammar, catFromString, catLabel, recordGramStats } from './grammar.js';
import {
  addGrammarButton, addVocabButton, change, emptyNote, listSection, section, sideBySide, spinner, whyNote,
} from './html.js';
import { feedbackPrompt } from './prompts.js';
import { showStages } from './stages.js';
import { state } from './state.js';
import { errorText, extractJSON, sentenceStats } from './util.js';
import { addVocab } from './vocab.js';
import { currentTargets, currentTopic, saveEntry } from './write.js';

// ---------- Rows ----------

const wordChoiceRow = (w) => '<div class="fb-item word">'
  + `${change(w.original, w.better)} ${addVocabButton(w.better, 'neutral', w.why)}${whyNote(w.why)}`
  + '</div>';

const upgradeRow = (u) => '<div class="fb-item up">'
  + `${change(u.original, u.better, 'soso')} ${addVocabButton(u.better, 'neutral', u.why)}${whyNote(u.why)}`
  + '</div>';

function grammarRow(g) {
  const tag = g.category ? `<span class="gtag">${esc(catLabel(catFromString(g.category)))}</span> ` : '';
  return '<div class="fb-item gram">'
    + `${change(g.original, g.fix)}${tag} ${addGrammarButton(g.original, g.fix, g.why, g.category)}${whyNote(g.why)}`
    + '</div>';
}

function vocabRow(v) {
  const meaning = v.meaning ? `<div class="vmean">${esc(v.meaning)}</div>` : '';
  return '<div class="fb-item vocab"><div>'
    + `<span class="vword">${esc(v.word)}</span><span class="vtag">${esc(v.register || 'neutral')}</span>`
    + meaning
    + `<div class="vex">${esc(v.example || '')}</div>`
    + `</div>${addVocabButton(v.word, v.register, v.example, v.meaning)}</div>`;
}

// ---------- Structure ----------

// Sentence-length chips (computed locally) plus the coach's notes on paragraphs and flow.
function structureSection(structure, text) {
  const stats = sentenceStats(text);
  if (!structure && !stats) return '';
  let body = '';

  if (stats) {
    const flat = stats.n >= 4 && stats.max - stats.min <= 6;
    const openerChips = stats.repeated.map((word) => {
      const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
      return `<span class="chip warn">${stats.openers[word]} start with “${esc(capitalized)}”</span>`;
    });
    body += '<div class="chips">'
      + `<span class="chip">${stats.n} sentences</span>`
      + `<span class="chip">avg ${stats.avg.toFixed(1)} words</span>`
      + `<span class="chip${flat ? ' warn' : ''}">range ${stats.min}–${stats.max}${flat ? ' · similar lengths' : ''}</span>`
      + openerChips.join('')
      + '</div>';
  }

  const { paragraphs, flow, variety, tryThis } = structure || {};
  (paragraphs || []).forEach((p, i) => {
    const clear = p.clear !== false;
    body += '<div class="fb-item"><div class="para">'
      + `<span class="pn">¶${i + 1}</span>`
      + '<div class="pt">'
      + `<b>${esc(p.mainPoint || '(no clear main point)')}</b>`
      + `<span class="badge ${clear ? 'ok' : 'no'}">${clear ? 'clear' : 'unclear'}</span>`
      + (p.note ? whyNote(p.note) : '')
      + '</div></div></div>';
  });
  if (flow) body += `<div class="fb-item"><b>Flow.</b> ${esc(flow)}</div>`;
  if (variety) body += `<div class="fb-item"><b>Variety.</b> ${esc(variety)}</div>`;
  if (tryThis && tryThis.original) {
    const why = tryThis.why ? `<span class="why" style="margin-top:6px">${esc(tryThis.why)}</span>` : '';
    body += '<div class="fb-item up"><b>Try restructuring</b>'
      + sideBySide(tryThis.original, tryThis.better || '', 'Restructured')
      + why
      + '</div>';
  }

  return section('🧱 Structure', body);
}

// ---------- Feedback card ----------

// Show feedback. fb is the parsed JSON, or null when the reply was plain text (raw).
export function renderFeedback(fb, raw) {
  let html;
  if (!fb) {
    html = `<div class="overall">${esc(raw)}</div>`;
  } else {
    html = (fb.overall ? `<div class="overall">${esc(fb.overall)}</div>` : '')
      + listSection('💪 What worked', fb.strengths, (s) => `<div class="fb-item">${esc(s)}</div>`)
      + listSection('🎯 Word choice', fb.wordChoice, wordChoiceRow)
      + listSection('✨ Level up (yours was fine — this is stronger)', fb.upgrades, upgradeRow)
      + listSection('📝 Grammar & naturalness', fb.grammar, grammarRow)
      + structureSection(fb.structure, $('entry').value)
      + listSection('📚 Words worth learning', fb.vocab, vocabRow);
  }
  showFeedbackCard(html);
  bindAddButtons($('fbBody'));
  if (fb) showStages(fb);
}

function showFeedbackCard(html) {
  $('fbBody').innerHTML = html;
  $('fbCard').style.display = 'block';
}

// Make every "+ Notebook" button inside root add its item once.
export function bindAddButtons(root) {
  for (const button of root.querySelectorAll('.btn-add')) {
    button.onclick = () => {
      const d = button.dataset;
      if (button.classList.contains('btn-addg')) addGrammar(d.orig, d.fix, d.why, d.cat);
      else addVocab(d.word, d.reg, d.ex, d.mean);
      button.textContent = 'Added ✓';
      button.disabled = true;
    };
  }
}

function coachUnavailableMessage() {
  if (!coachChecked) return 'Still connecting to Claude. Try again in a moment.';
  if (coachMode === 'apikey') return 'Add your Anthropic API key in Settings to get feedback.';
  return "The writing coach isn't available in this view. Open this page in Claude to get feedback.";
}

async function requestFeedback() {
  const text = $('entry').value.trim();
  if (!text) {
    showFeedbackCard(emptyNote('Write something first!'));
    return;
  }
  if (!hasApiKey()) {
    showFeedbackCard(emptyNote(coachUnavailableMessage()));
    return;
  }

  const button = $('fbBtn');
  button.disabled = true;
  button.textContent = 'Reviewing…';
  showFeedbackCard(spinner('Your coach is reading your entry…'));

  const targetWords = currentTargets().map((t) => t.w);
  try {
    const reply = String(await callClaude(feedbackPrompt(currentTopic(), targetWords), [text]));
    const fb = extractJSON(reply);
    state.lastFeedback = fb || { overall: reply };
    if (fb) recordGramStats(fb.grammar || [], text);
    renderFeedback(fb, reply);
    resetChat(true);
    saveEntry(true);
  } catch (e) {
    $('fbBody').innerHTML = emptyNote(`Feedback failed. ${esc(errorText(e))}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Get feedback';
  }
}

export function initFeedback() {
  $('fbBtn').onclick = requestFeedback;
}
