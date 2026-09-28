// One choice per row, from the same options for every row. The answer maps each row number, from 1, to an option.
// A table on wide screens and one block per row on narrow ones: two views of the same answer, kept in step by choose().
import { h } from '../dom.js';
import { isSkipped } from '../conditions.js';
import { fieldShell, idFor, save } from './field.js';

export function render(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  const value = stored && typeof stored === 'object' && !isSkipped(stored) ? { ...stored } : {};
  const id = idFor(ctx.key);
  const options = [...question.options.filter((o) => !o.optout), ...question.options.filter((o) => o.optout)];
  const firstOptout = options.find((o) => o.optout);
  const edge = (option) => (option === firstOptout ? 'col-optout' : null);
  const rows = question.rows.map((text, i) => ({ r: i + 1, text, inputs: [] }));

  const table = h('table', { class: 'gridq gridq--plain' },
    h('thead', {}, h('tr', {}, h('td', {}),
      options.map((option) => h('th', { scope: 'col', class: edge(option) }, option.text)))),
    h('tbody', {}, rows.map((row) => h('tr', {},
      h('th', { scope: 'row', id: `${id}-r${row.r}` }, row.text),
      options.map((option) => h('td', { class: edge(option) },
        h('label', {},
          radio(row, option, `${ctx.key}:${row.r}`, { className: 'opt__input', label: option.text, describedBy: `${id}-r${row.r}` }),
          h('span', { class: 'opt__mark' }))))))));

  const blocks = h('div', { class: 'gridq-blocks' }, rows.map((row) => h('div', { class: 'stack--2' },
    h('p', { id: `${id}-b${row.r}` }, row.text),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': `${id}-b${row.r}` },
      options.map((option) => h('label', { class: option.optout ? 'seg__item seg__item--optout' : 'seg__item' },
        radio(row, option, `${ctx.key}:${row.r}:narrow`),
        h('span', {}, option.text)))))));

  return fieldShell(question, ctx, h('div', {}, table, blocks), { wide: true, clear });

  // A radio for this row and option. Each view names its own groups, so the browser keeps them apart.
  // In the table a radio is named by its option, as in the jobs table, and described by its row.
  function radio(row, option, name, { className, label, describedBy } = {}) {
    const input = h('input', { class: className, type: 'radio', name, value: String(option.n), checked: value[row.r] === option.n, 'aria-label': label, 'aria-describedby': describedBy });
    input.addEventListener('change', () => choose(row, option.n, input));
    row.inputs.push(input);
    return input;
  }

  // Records the row's choice and shows it in both views.
  function choose(row, n, from) {
    value[row.r] = n;
    for (const input of row.inputs) input.checked = Number(input.value) === n;
    save(ctx, { ...value }, from);
  }

  // Releases every row, for a field the person skips.
  function clear() {
    for (const row of rows) {
      delete value[row.r];
      for (const input of row.inputs) input.checked = false;
    }
  }
}
