// A number for each option, the whole being 100. The answer is saved on every change, whatever the total;
// an empty box counts as 0, and with every box empty there is no answer.
import { h } from '../dom.js';
import { fieldShell, idFor, save } from './field.js';

const WHOLE = 100;

export function render(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  const values = Array.isArray(stored) ? stored : [];
  const id = idFor(ctx.key);
  const boxes = question.options.map((option, i) => h('input', {
    class: 'input input--num', id: `${id}-${option.n}`, type: 'number',
    min: '0', max: String(WHOLE), step: '5', inputmode: 'numeric', value: values[i] ?? ''
  }));
  const sum = h('span');
  const total = h('div', { class: 'split__total', role: 'status' }, h('span', {}, 'Total'), sum);
  for (const box of boxes) {
    box.addEventListener('input', () => update(box));
    box.addEventListener('change', () => {
      tidy(box);
      update(box);
    });
  }
  showTotal();
  const rows = question.options.map((option, i) => h('div', { class: 'split__row' }, h('label', { for: boxes[i].id }, option.text), boxes[i]));
  return fieldShell(question, ctx, h('div', {}, h('div', { class: 'split' }, rows), total), { help: 'The numbers must add to 100.', clear });

  function numbers() {
    return boxes.map((box) => (box.value === '' ? 0 : Number(box.value) || 0));
  }

  function update(from) {
    showTotal();
    save(ctx, boxes.every((box) => box.value === '') ? undefined : numbers(), from);
  }

  function showTotal() {
    const n = numbers().reduce((a, b) => a + b, 0);
    sum.textContent = `${n} of 100`;
    total.classList.toggle('is-ok', n === WHOLE);
  }

  // Once a number is entered, it is kept between 0 and 100.
  function tidy(box) {
    if (box.value === '') return;
    const n = Math.min(WHOLE, Math.max(0, Number(box.value)));
    if (Number(box.value) !== n) box.value = String(n);
  }

  // Empties every box, for a field the person skips.
  function clear() {
    for (const box of boxes) box.value = '';
    showTotal();
  }
}
