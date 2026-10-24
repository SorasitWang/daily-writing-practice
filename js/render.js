import { renderGramStats, renderGrammarList } from './grammar.js';
import { renderHistory } from './history.js';
import { refreshSettingsUI } from './settings.js';
import { renderVocab } from './vocab.js';
import { renderStreak, renderTargets, renderTopic } from './write.js';

// Redraw every tab from the current state.
export function renderAll() {
  renderTopic();
  renderTargets();
  renderStreak();
  renderVocab();
  renderGrammarList();
  renderGramStats();
  renderHistory();
  refreshSettingsUI();
}
