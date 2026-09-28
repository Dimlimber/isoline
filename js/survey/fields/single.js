// One option from a list.
import { fieldShell, optionRows, save } from './field.js';

export function render(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  const options = optionRows(question.options, ctx, { type: 'radio', chosen: (n) => stored === n, onChange });
  return fieldShell(question, ctx, options.list, { clear: options.clear });

  function onChange(row) {
    options.words();
    save(ctx, row.option.n, row.input);
  }
}
