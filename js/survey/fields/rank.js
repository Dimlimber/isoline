// A first and a second choice, pressed in order. The rows are buttons that show their place, 1 or 2.
// Pressing a chosen row releases it, and the second moves up; with two chosen, the other rows wait.
import { h } from '../dom.js';
import { fieldShell, save } from './field.js';

const PLACES = 2;

export function render(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  let order = Array.isArray(stored) ? stored.slice(0, PLACES) : [];
  const rows = question.options.map((option) => {
    const mark = h('span', { class: 'opt__mark opt__mark--n' });
    const button = h('button', { class: 'opt', type: 'button', onClick: () => press(option.n, button) },
      mark,
      h('span', { class: 'opt__text' }, option.text));
    return { option, mark, button };
  });
  draw();
  return fieldShell(question, ctx, h('div', { class: 'opts' }, rows.map((row) => row.button)), { help: 'Pick the first, then the second.', clear });

  function press(n, button) {
    if (order.includes(n)) order = order.filter((m) => m !== n);
    else if (order.length < PLACES) order = [...order, n];
    else return;
    draw();
    save(ctx, order, button);
  }

  // Each row shows its place and whether it is pressed; once two are chosen the others are disabled.
  function draw() {
    for (const row of rows) {
      const place = order.indexOf(row.option.n) + 1;
      row.mark.textContent = place > 0 ? String(place) : '';
      row.button.setAttribute('aria-pressed', String(place > 0));
      row.button.disabled = place === 0 && order.length >= PLACES;
    }
  }

  // Releases both choices, for a field the person skips.
  function clear() {
    order = [];
    draw();
  }
}
