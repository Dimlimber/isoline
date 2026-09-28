// How the work gets done: for each job of the section, how it gets done today and, where people or AI do it,
// whether that is the right amount of AI. There is no skip: the ladder's two opt-outs are in the table.
// A table on wide screens and one card per job under 900 px. They are two views of the same answers: every radio
// in either view is made by radio(), which shows what is stored and writes through choose(), so the two always agree.
import { h } from '../dom.js';
import { getSection, jobText } from '../lookup.js';
import { routes } from '../conditions.js';
import { merged } from '../flow.js';
import { idFor } from '../fields/field.js';
import { frame } from './frame.js';

// The ways of doing a job that are followed by the question of the right amount of AI, as in flow.js.
const FIT_ASKED = [2, 3, 4, 5, 6];

export function render(screen, app) {
  const { instrument, store } = app;
  const { ladder, fit } = instrument.standard;
  const route = routes(merged(store.state)).main;
  const ways = [...ladder.options.filter((o) => !o.optout), ...ladder.options.filter((o) => o.optout)];
  const firstOptout = ways.find((o) => o.optout);
  const edge = (option) => (option === firstOptout ? 'col-optout' : null);
  const rows = getSection(instrument, screen.section).jobs.map((job) => ({
    text: jobText(job, route),
    keys: { how: `${job.id}:how`, fit: `${job.id}:fit` },
    inputs: { how: [], fit: [] },
    holders: []
  }));

  const key = h('dl', { class: 'key' }, ways.filter((o) => !o.optout).map((o) => h('div', {}, h('dt', {}, o.short), h('dd', {}, o.text))));
  const table = h('table', { class: 'gridq gridq--jobs', 'aria-label': ladder.text },
    h('thead', {}, h('tr', {}, h('td', {}), ways.map((o) => h('th', { scope: 'col', class: edge(o) }, o.short)))),
    h('tbody', {}, rows.map((row) => [tableRow(row), fitRow(row)])));
  const cards = h('div', { class: 'jobcards' }, rows.map(card));
  for (const row of rows) showFit(row);

  return frame(screen, app, {
    kicker: `${screen.group} · ${screen.railLabel}`,
    title: 'How the work gets done',
    lead: ladder.text,
    body: [key, table, cards]
  });

  // A job in the table: its text, then one radio per way of doing it, named by the way and described by the job.
  function tableRow(row) {
    const head = `${idFor(row.keys.how)}-t`;
    return h('tr', { 'data-key': row.keys.how },
      h('th', { scope: 'row', id: head }, row.text),
      ways.map((option) => h('td', { class: edge(option) },
        h('label', {},
          radio(row, 'how', option, row.keys.how, { className: 'opt__input', label: option.text, describedBy: head }),
          h('span', { class: 'opt__mark' })))));
  }

  // The second row under a job in the table: the right amount of AI, while the job's answer asks for it.
  function fitRow(row) {
    return holder(row, h('tr', { class: 'gridq__sub', 'data-key': row.keys.fit },
      h('td', { colspan: String(ways.length + 1) },
        h('p', { class: 'label' }, fit.text),
        segment(row, row.keys.fit, `${idFor(row.keys.how)}-t`))));
  }

  // A job as a card: its text, a row for each way of doing it, then the right amount of AI when it applies.
  // A way shows its short name, then its full text where the two differ.
  function card(row) {
    const head = `${idFor(row.keys.how)}-c`;
    return h('div', { class: 'card stack--4', 'data-key': row.keys.how },
      h('h2', { class: 'h3', id: head }, row.text),
      h('div', { class: 'opts', role: 'radiogroup', 'aria-labelledby': head },
        ways.map((option) => h('label', { class: option.optout ? 'opt opt--optout' : 'opt' },
          radio(row, 'how', option, `${row.keys.how}:narrow`, { className: 'opt__input' }),
          h('span', { class: 'opt__mark' }),
          h('span', { class: 'opt__text' },
            h('b', {}, option.short),
            option.text === option.short ? null : h('span', { class: 'small muted' }, option.text))))),
      holder(row, h('div', { class: 'stack--2', 'data-key': row.keys.fit },
        h('p', { class: 'label' }, fit.text),
        segment(row, `${row.keys.fit}:narrow`, head))));
  }

  // The answers on the right amount of AI, the last an opt-out: a segment named by its question and described by its job.
  // The name is the question's own text, since the label above it is shown in capitals.
  function segment(row, name, describedBy) {
    return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': fit.text, 'aria-describedby': describedBy },
      fit.options.map((option) => h('label', { class: option.optout ? 'seg__item seg__item--optout' : 'seg__item' },
        radio(row, 'fit', option, name),
        h('span', {}, option.text))));
  }

  // Keeps the element that holds the question of the right amount of AI, to show or hide it with the job's answer.
  function holder(row, el) {
    row.holders.push(el);
    return el;
  }

  // A radio for one answer of one job, in either view. Each view names its own groups, so the browser keeps them apart.
  function radio(row, part, option, name, { className, label, describedBy } = {}) {
    const input = h('input', { class: className, type: 'radio', name, value: String(option.n), checked: stored(row, part) === option.n, 'aria-label': label, 'aria-describedby': describedBy });
    input.addEventListener('change', () => choose(row, part, option.n));
    row.inputs[part].push(input);
    return input;
  }

  function stored(row, part) {
    const value = store.get(row.keys[part]);
    return Number.isInteger(value) ? value : null;
  }

  // Records an answer and shows it in both views. A way of doing the job that is not followed by the question
  // of the right amount of AI closes that question and removes its answer.
  function choose(row, part, n) {
    store.set(row.keys[part], n);
    for (const input of row.inputs[part]) input.checked = Number(input.value) === n;
    if (part === 'how' && !FIT_ASKED.includes(n)) {
      if (store.get(row.keys.fit) !== undefined) store.unset(row.keys.fit);
      for (const input of row.inputs.fit) input.checked = false;
    }
    showFit(row);
    app.changed();
  }

  // The question of the right amount of AI shows, in both views, while the job's answer asks for it.
  function showFit(row) {
    const asked = FIT_ASKED.includes(stored(row, 'how'));
    for (const el of row.holders) el.hidden = !asked;
  }
}
