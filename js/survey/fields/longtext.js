// A longer answer in a few sentences, with its length shown under it.
import { h } from '../dom.js';
import { fieldShell, idFor, onTyping, save } from './field.js';

export function render(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  const countId = `${idFor(ctx.key)}-count`;
  const area = h('textarea', { class: 'textarea', maxlength: '4000', 'aria-describedby': countId }, typeof stored === 'string' ? stored : '');
  const count = h('p', { class: 'note', id: countId });
  const recount = () => {
    const n = area.value.length;
    count.textContent = `${n} ${n === 1 ? 'character' : 'characters'}`;
  };
  recount();
  area.addEventListener('input', recount);
  const setText = onTyping(area, (text) => save(ctx, text, area));
  const clear = () => {
    setText('');
    recount();
  };
  return fieldShell(question, ctx, h('div', { class: 'stack--2' }, area, count), { clear });
}
