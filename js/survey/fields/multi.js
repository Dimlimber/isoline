// Any number of options from a list, where an opt-out stands alone. A question with max takes no more than that.
// A long list takes two columns and the full width on a wide screen.
import { fieldShell, inTwoColumns, optionRows, save } from './field.js';

export function render(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  const picked = Array.isArray(stored) ? stored : [];
  const columns = inTwoColumns(question.options);
  const options = optionRows(question.options, ctx, { type: 'checkbox', chosen: (n) => picked.includes(n), onChange, columns });
  limit();
  return fieldShell(question, ctx, options.list, { help: question.max ? 'Pick up to two.' : undefined, wide: columns, clear: options.clear });

  function onChange(row) {
    if (row.input.checked) {
      // An opt-out clears every other option; any other option clears the opt-outs.
      for (const other of options.rows) {
        if (other !== row && (row.option.optout || other.option.optout)) other.input.checked = false;
      }
    }
    options.words();
    limit();
    save(ctx, options.picked(), row.input);
  }

  // Once max options are chosen, the other ordinary options wait until one is released.
  function limit() {
    if (!question.max) return;
    const full = options.picked().length >= question.max;
    for (const row of options.rows) {
      if (!row.option.optout) row.input.disabled = full && !row.input.checked;
    }
  }
}
