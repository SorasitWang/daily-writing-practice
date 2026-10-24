// Follow-up chat with the coach about the current feedback.
import { callClaude, hasApiKey } from './coach.js';
import { $ } from './dom.js';
import { CHAT_PROMPT } from './prompts.js';
import { state } from './state.js';
import { errorText } from './util.js';
import { currentTopic } from './write.js';

// Questions and answers so far, sent back to the coach as context.
let chatTurns = [];

export function resetChat(show) {
  chatTurns = [];
  $('chatLog').innerHTML = '';
  $('chatInput').value = '';
  $('chatBox').style.display = show && hasApiKey() ? '' : 'none';
}

function addBubble(className, text) {
  const bubble = document.createElement('div');
  bubble.className = className;
  bubble.textContent = text;
  $('chatLog').appendChild(bubble);
  return bubble;
}

async function sendChat() {
  const question = $('chatInput').value.trim();
  if (!question || !hasApiKey()) return;

  $('chatInput').value = '';
  addBubble('chat-q', question);
  const answerBubble = addBubble('chat-a', 'Thinking…');
  const button = $('chatSend');
  button.disabled = true;

  const { topic, fmt } = currentTopic();
  const context = {
    topic,
    format: fmt,
    essay: $('entry').value.trim(),
    feedback: state.lastFeedback,
    previousQuestions: chatTurns,
  };

  try {
    const reply = await callClaude(
      CHAT_PROMPT,
      [JSON.stringify(context), `Learner's question: ${question}`],
      700,
      { cache: false },
    );
    const answer = String(reply).trim();
    answerBubble.textContent = answer;
    chatTurns.push({ question, answer });
  } catch (e) {
    answerBubble.textContent = `That didn't work. ${errorText(e)}`;
  } finally {
    button.disabled = false;
    $('chatInput').focus();
  }
}

export function initChat() {
  $('chatSend').onclick = sendChat;
  $('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChat();
    }
  });
}
