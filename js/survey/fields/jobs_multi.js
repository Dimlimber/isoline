// Any number of the jobs of a section, as chips, or the question's opt-out on its own, stored as ['none'].
// The section is the part of the scope before the first ':', so 'CRE.1' and 'CRE.1:T08' both name CRE.1.
// The question's first option only stands for the jobs, and is never shown.
import { h } from '../dom.js';
import { getSection, jobText } from '../lookup.js';
import { routes } from '../conditions.js';
import { merged } from '../flow.js';
import { fieldShell, save } from './field.js';

const NONE = 'none';

export function render(question, ctx) {
  const { instrument, store } = ctx.app;
  const section = getSection(instrument, ctx.scope.split(':')[0]);
  const route = routes(merged(store.state)).main;
  const stored = store.get(ctx.key);
  const picked = Array.isArray(stored) ? stored : [];
  const optout = question.options.find((option) => option.optout);
  const chips = [
    ...section.jobs.map((job) => chip(job.id, jobText(job, route), false)),
    ...(optout ? [chip(NONE, optout.text, true)] : [])
  ];
  return fieldShell(question, ctx, h('div', { class: 'chips' }, chips.map((c) => c.label)), { clear });

  function chip(value, text, isOptout) {
    const input = h('input', { type: 'checkbox', name: ctx.key, value, checked: picked.includes(value) });
    const c = { value, input, optout: isOptout, label: h('label', { class: isOptout ? 'chip chip--optout' : 'chip' }, input, h('span', {}, text)) };
    input.addEventListener('change', () => onChange(c));
    return c;
  }

  // The opt-out clears the jobs; a job clears the opt-out. The jobs are kept in the section's order.
  function onChange(c) {
    if (c.input.checked) {
      for (const other of chips) {
        if (other !== c && (c.optout || other.optout)) other.input.checked = false;
      }
    }
    save(ctx, chips.filter((x) => x.input.checked).map((x) => x.value), c.input);
  }

  // Releases every chip, for a field the person skips.
  function clear() {
    for (const c of chips) c.input.checked = false;
  }
}
