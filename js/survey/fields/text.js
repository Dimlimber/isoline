// A short answer on one line.
import { h } from '../dom.js';
import { fieldShell, onTyping, save } from './field.js';

export function render(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  const input = h('input', { class: 'input', type: 'text', maxlength: '200', value: typeof stored === 'string' ? stored : '' });
  const setText = onTyping(input, (text) => save(ctx, text, input));
  return fieldShell(question, ctx, input, { clear: () => setText('') });
}
