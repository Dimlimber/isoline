// The self-screen: which parts of marketing the person can describe in detail. There is no cap.
// Each offered section is a row, grouped under its job of marketing; a row with no answer counts as Not me.
// The answer, at CORE.14, maps section codes to 1, 2, 3 or 4, and is stored after every change.
import { h } from '../dom.js';
import { getModule, getQuestion } from '../lookup.js';
import { offeredSections, selectedSections } from '../flow.js';
import { minutes, secondsFor } from '../timing.js';
import { idFor } from '../fields/field.js';
import { frame } from './frame.js';

const KEY = 'CORE.14';
const KNOW_IT_WELL = 3;
const NOT_ME = 4;

export function render(screen, app) {
  const { instrument, store, config } = app;
  const question = getQuestion(instrument, KEY);
  const sections = offeredSections(instrument, store.state);
  const radios = new Map();

  const groups = [];
  for (const section of sections) {
    if (groups.at(-1)?.module !== section.module) groups.push({ module: section.module, sections: [] });
    groups.at(-1).sections.push(section);
  }
  const list = h('div', { class: 'pick' }, groups.map((group) => h('div', { class: 'pick__group' },
    h('h2', { class: 'label' }, getModule(instrument, group.module).name),
    group.sections.map(row))));

  const summary = h('p', { role: 'status' });
  const bar = h('div', { class: 'pick__bar' },
    summary,
    h('button', { class: 'btn btn--quiet', type: 'button', onClick: speakToAll }, 'I can speak to all of it'));
  summarize();

  return frame(screen, app, {
    kicker: 'Start',
    title: question.text,
    lead: 'How the work gets done, with what data, and with which tools. Mark every part you can speak to. One person can take them all.',
    body: [list, bar]
  });

  // A section: its name and what it covers, then the four options of CORE.14, the last an opt-out.
  function row(section) {
    const nameId = `${idFor(KEY)}-${section.code}`;
    const introId = `${nameId}-intro`;
    const stored = marks()[section.code];
    const inputs = question.options.map((option) => {
      const input = h('input', { type: 'radio', name: `${KEY}:${section.code}`, value: String(option.n), checked: stored === option.n });
      input.addEventListener('change', () => mark({ [section.code]: option.n }));
      return input;
    });
    radios.set(section.code, inputs);
    return h('div', { class: 'pick__row' },
      h('div', {},
        h('h3', { class: 'h3', id: nameId }, section.name),
        h('p', { class: 'small muted', id: introId }, section.intro)),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': nameId, 'aria-describedby': introId },
        question.options.map((option, i) => h('label', { class: option.n === NOT_ME ? 'seg__item seg__item--optout' : 'seg__item' },
          inputs[i],
          h('span', {}, option.text)))));
  }

  // Gives every row that has no answer yet the third option; rows already answered keep their answer.
  function speakToAll() {
    const answered = new Set(question.options.map((option) => option.n));
    const rest = sections.filter((section) => !answered.has(marks()[section.code]));
    for (const section of rest) {
      for (const input of radios.get(section.code)) input.checked = Number(input.value) === KNOW_IT_WELL;
    }
    mark(Object.fromEntries(rest.map((section) => [section.code, KNOW_IT_WELL])));
  }

  function mark(changes) {
    store.set(KEY, { ...marks(), ...changes });
    summarize();
    app.changed();
  }

  function marks() {
    return store.get(KEY) || {};
  }

  // How many sections are chosen and how long the survey takes with them.
  function summarize() {
    const chosen = selectedSections(instrument, store.state);
    if (chosen.length === 0) {
      summary.textContent = 'Mark at least one part to continue.';
      return;
    }
    const m = minutes(secondsFor(instrument, chosen, { owner: store.state.company.owner, prompts: config.requiredPrompts }));
    summary.textContent = `Your survey: ${chosen.length} ${chosen.length === 1 ? 'section' : 'sections'}, about ${m} ${m === 1 ? 'minute' : 'minutes'}.`;
  }
}
