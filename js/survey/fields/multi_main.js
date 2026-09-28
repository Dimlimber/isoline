// Any number of options from a list, and which one is the main one once there are several.
// With one option chosen, that one is the main one. Ticking a second asks for the main one afresh,
// so the order of ticking never answers it; the main one stays while it stays chosen.
import { h } from '../dom.js';
import { fieldShell, idFor, optionRows, save } from './field.js';

export function render(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  const selected = Array.isArray(stored?.selected) ? stored.selected : [];
  const options = optionRows(question.options, ctx, { type: 'checkbox', chosen: (n) => selected.includes(n), onChange });
  let picked = options.picked();
  let main = picked.length === 1 ? picked[0] : (picked.includes(stored?.main) ? stored.main : null);

  const askId = `${idFor(ctx.key)}-main`;
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': askId });
  const ask = h('div', { class: 'stack--3' }, h('p', { class: 'field__help', id: askId }, 'Which one is the main one?'), seg);
  drawMain();
  return fieldShell(question, ctx, h('div', { class: 'stack' }, options.list, ask), { clear });

  function onChange(row) {
    if (row.input.checked) {
      // An opt-out clears every other option; any other option clears the opt-outs.
      for (const other of options.rows) {
        if (other !== row && (row.option.optout || other.option.optout)) other.input.checked = false;
      }
    }
    options.words();
    const before = picked;
    picked = options.picked();
    if (picked.length === 1) main = picked[0];
    else if (before.length <= 1 || !picked.includes(main)) main = null;
    drawMain();
    save(ctx, { selected: picked, main }, row.input);
  }

  // The question of the main one, with one choice per option chosen, shown once two or more are chosen.
  function drawMain() {
    const several = picked.length > 1;
    ask.hidden = !several;
    seg.replaceChildren(...(several ? picked.map(mainItem) : []));
  }

  function mainItem(n) {
    const option = question.options.find((o) => o.n === n);
    const input = h('input', { type: 'radio', name: `${ctx.key}:main`, value: String(n), checked: n === main });
    input.addEventListener('change', () => {
      main = n;
      save(ctx, { selected: picked, main }, input);
    });
    return h('label', { class: option.optout ? 'seg__item seg__item--optout' : 'seg__item' }, input, h('span', {}, option.text));
  }

  // Releases every option, for a field the person skips.
  function clear() {
    options.clear();
    picked = [];
    main = null;
    drawMain();
  }
}
