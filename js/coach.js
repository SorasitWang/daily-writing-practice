// The writing coach. Inside a Claude artifact it runs on the learner's Claude account;
// standalone it calls the Anthropic API with the learner's own key.
import { lsGet } from './storage.js';

// Coach depth (Settings) -> model.
export const TIER_MODELS = {
  quick: 'claude-haiku-5-5',
  default: 'claude-sonnet-5-5',
  complex: 'claude-opus-5-5',
};

// 'claude' = running inside a Claude artifact; 'apikey' = standalone with the learner's API key.
export let coachMode = 'claude';
// True once we know whether the coach is available.
export let coachChecked = false;
// sampleFn(userContent, options) -> Promise<{ text }>, or null when the coach is unavailable.
let sampleFn = null;

export const hasApiKey = () => !!sampleFn;
export const apiKey = () => (lsGet('dw_api_key') || '').trim();

export function currentTier() {
  const tier = lsGet('dw_tier');
  return tier === 'quick' || tier === 'complex' ? tier : 'default';
}

export function setSampleFn(fn) {
  sampleFn = fn;
}

export function setCoachChecked(value) {
  coachChecked = value;
}

export function useApiKeyMode() {
  coachMode = 'apikey';
  sampleFn = apiKey() ? apiKeySample : null;
}

// ---------- Direct Anthropic API ----------

async function apiKeySample(userContent, options = {}) {
  const key = apiKey();
  if (!key) throw new Error('Add your Anthropic API key in Settings to use the writing coach.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: TIER_MODELS[options.modelTier || 'default'] || TIER_MODELS.default,
      max_tokens: options.maxTokens || 2000,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = res.status === 401
      ? 'Your API key was rejected. Check it in Settings.'
      : json?.error?.message || `HTTP ${res.status}`;
    const err = new Error(message);
    if (res.status === 429) err.code = 'rate_limited';
    throw err;
  }

  const text = (json.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return { text };
}

// ---------- Calling the coach ----------

function coachError(e) {
  const code = e && e.code;
  if (code === 'not_granted') {
    return "Claude access was declined for this page. You can allow it again from the page's Permissions menu.";
  }
  if (code === 'rate_limited') return 'Too many requests right now. Wait a minute, then try again.';
  if (code === 'prompt_too_large') return 'This is too long to review in one go. Try a shorter entry.';
  return (e && e.message) || String(code || e);
}

// Send a prompt plus data items (strings or objects) and return the reply text.
export async function callClaude(prompt, data, maxTokens, { cache } = {}) {
  if (!sampleFn) throw new Error("The writing coach isn't available in this view.");

  let userContent = prompt;
  if (data && data.length) {
    const items = data.map((d) => (typeof d === 'string' ? d : JSON.stringify(d)));
    userContent += '\n\n' + items.join('\n\n');
  }

  const options = { modelTier: currentTier() };
  if (cache === false) options.cache = false;
  if (coachMode === 'apikey') options.maxTokens = maxTokens || 3000; // only the direct API needs a token cap

  let reply;
  try {
    reply = await sampleFn(userContent, options);
  } catch (e) {
    throw new Error(coachError(e));
  }
  return (reply && reply.text) || '';
}
