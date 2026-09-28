// One job from every section the person chose under the job of marketing in the scope, or the opt-out, stored as 'none'.
// The question's first option only stands for the jobs, and is never shown.
import { getSection, jobText } from '../lookup.js';
import { routes } from '../conditions.js';
import { merged, selectedSections } from '../flow.js';
import { fieldShell, forget, optionRows, save } from './field.js';

const NONE = 'none';

export function render(question, ctx) {
  const { instrument, store } = ctx.app;
  const route = routes(merged(store.state)).main;
  const jobs = selectedSections(instrument, store.state)
    .map((code) => getSection(instrument, code))
    .filter((section) => section.module === ctx.scope)
    .flatMap((section) => section.jobs);
  const optout = question.options.find((option) => option.optout);
  const choices = [
    ...jobs.map((job) => ({ n: job.id, text: jobText(job, route) })),
    ...(optout ? [{ n: NONE, text: optout.text, optout: true }] : [])
  ];
  // A job from a section the person no longer takes is not an answer any more.
  const stored = store.get(ctx.key);
  if (typeof stored === 'string' && !choices.some((choice) => choice.n === stored)) forget(question, ctx);
  const options = optionRows(choices, ctx, { type: 'radio', chosen: (n) => n === stored, onChange });
  return fieldShell(question, ctx, options.list, { clear: options.clear });

  function onChange(row) {
    save(ctx, row.option.n, row.input);
  }
}
