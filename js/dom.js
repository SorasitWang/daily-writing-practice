export const $ = (id) => document.getElementById(id);

// Escape text for safe use inside innerHTML.
export function esc(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

// Show a short status message, e.g. setStatus(el, 'Saved.', 'ok-note').
export function setStatus(el, text, className) {
  el.textContent = text;
  if (className) el.className = className;
}
