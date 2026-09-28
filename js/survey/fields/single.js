// One option from a list. A long list takes two columns and the full width on a wide screen.
import { fieldShell, inTwoColumns, optionRows, save } from './field.js';

export function render(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  const columns = inTwoColumns(question.options);
  const options = optionRows(question.options, ctx, { type: 'radio', chosen: (n) => stored === n, onChange, columns });
  return fieldShell(question, ctx, options.list, { wide: columns, clear: options.clear });

  function onChange(row) {
    options.words();
    save(ctx, row.option.n, row.input);
  }
}
