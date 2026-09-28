// The last screen of every section: what the person uses for each tool category, then a short card about the first tool named.
// A category's answer, at '<section>:<tool id>:name', is { kind: 'tool', names } or { kind } for one of KINDS;
// with no name and no chip there is none. The card's answers belong to the first name: when it goes, they go too.
// Names are typed by people, so they are only ever put on the page as text.
import { h } from '../dom.js';
import { getModule, getSection } from '../lookup.js';
import { holds, resolveKey } from '../conditions.js';
import { merged } from '../flow.js';
import { rankSuggestions, withoutNames } from '../suggest.js';
import { renderField } from '../fields/index.js';
import { fieldShell, forget, idFor, save } from '../fields/field.js';
import { createTypeahead } from '../fields/typeahead.js';
import { frame } from './frame.js';

// What the roster's options 2 to 6 stand for, in their order. Option 1 only stands for typing a name.
const KINDS = ['inhouse', 'agency', 'manual', 'none', 'unknown'];
const MAX_NAMES = 5;

export function render(screen, app) {
  const { instrument } = app;
  const section = getSection(instrument, screen.section);
  return frame(screen, app, {
    kicker: `${getModule(instrument, section.module).name} · ${section.name}`,
    title: 'Your tools',
    lead: `The last part of this section. ${instrument.standard.roster.text}`,
    body: h('div', {}, section.tools.map((tool) => toolCard(tool, section.code, app)))
  });
}

// One tool category: the names listed, a box to type more, and the chips for every other answer.
// Once a name is listed, the card grows a second part about the first one.
function toolCard(tool, sectionCode, app) {
  const { instrument, store } = app;
  const { roster } = instrument.standard;
  const scope = `${sectionCode}:${tool.id}`;
  const key = `${scope}:name`;
  const id = idFor(key);
  const suggest = (text) => rankSuggestions(text, tool.vendors, instrument.all_vendors);
  // A tool is not its own replacement: the boxes about the first tool offer the same names, less those listed here.
  const suggestOther = (text) => rankSuggestions(text, withoutNames(tool.vendors, listed()), withoutNames(instrument.all_vendors, listed()));

  const names = h('div', { class: 'chips tool__names' });
  const typeahead = createTypeahead({ id, label: roster.options[0].text, suggest, onPick: add });
  const box = typeahead.querySelector('input');
  const kinds = roster.options.slice(1).map((option, i) => {
    const input = h('input', { type: 'radio', name: key, value: KINDS[i] });
    input.addEventListener('change', () => update({ kind: KINDS[i] }));
    return { input, label: h('label', { class: option.optout ? 'chip chip--optout' : 'chip' }, input, h('span', {}, option.text)) };
  });
  // The names, the box and the chips keep to the measure, as every field does.
  const card = h('div', { class: 'card tool', role: 'group', 'aria-labelledby': `${id}-ask`, 'data-key': key },
    h('div', { class: 'card__head' }, h('h2', { class: 'h3', id: `${id}-ask` }, tool.ask)),
    h('div', { class: 'measure' },
      names,
      typeahead,
      h('div', { class: 'chips' }, kinds.map((kind) => kind.label))));
  let about = null;
  draw();
  return card;

  // The names listed now, from the stored answer.
  function listed() {
    const value = store.get(key);
    return value?.kind === 'tool' && Array.isArray(value.names) ? value.names : [];
  }

  // A name joins the list unless it is there already or the list is full. Adding a name releases the chip.
  function add(name) {
    const now = listed();
    if (now.length >= MAX_NAMES || now.some((other) => other.toLowerCase() === name.toLowerCase())) return;
    update({ kind: 'tool', names: [...now, name] });
    // The box is now disabled, so focus moves to the name just added.
    if (now.length + 1 === MAX_NAMES) focusName(MAX_NAMES - 1);
  }

  // Focus moves to the name that takes the removed one's place, or to the box when none is left.
  function remove(i) {
    const rest = listed().filter((_, j) => j !== i);
    update(rest.length > 0 ? { kind: 'tool', names: rest } : undefined);
    if (rest.length > 0) focusName(Math.min(i, rest.length - 1));
    else box.focus();
  }

  // Stores the category's answer, or removes it, then draws the card from what is stored.
  function update(value) {
    const first = listed()[0];
    if (value) store.set(key, value);
    else store.unset(key);
    if (listed()[0] !== first) forgetCard();
    draw();
    app.changed();
  }

  function forgetCard() {
    for (const question of instrument.standard.card) forget(question, { app, key: resolveKey(question.id, scope) });
  }

  // The card as stored: the names, the box closed to a sixth name, the chosen chip, and the part about the first name.
  function draw() {
    const now = listed();
    const kind = store.get(key)?.kind;
    names.hidden = now.length === 0;
    names.replaceChildren(...now.map((name, i) => nameChip(name, () => remove(i))));
    box.disabled = now.length >= MAX_NAMES;
    for (const { input } of kinds) input.checked = input.value === kind;
    if (about?.first !== now[0]) {
      about?.el.remove();
      about = now.length > 0 ? aboutPart(now[0], scope, suggestOther, app) : null;
      if (about) card.append(about.el);
    }
    if (about) about.note.hidden = now.length < 2;
  }

  function focusName(i) {
    names.querySelectorAll('.chip__x')[i]?.focus();
  }
}

// The card questions about the first name, under a hairline. A question with a condition shows only while it holds,
// and loses its answer when it hides. Within a card, a single choice is a segment and a text answer names a tool.
function aboutPart(first, scope, suggest, app) {
  const { instrument, store } = app;
  // The fields report changes to this app, which settles the follow-ups before the real app hears of it.
  const local = Object.create(app, { changed: { value: () => { settle(); app.changed(); } } });
  const fieldFor = (question, ctx) => {
    if (question.type === 'single') return segment(question, ctx);
    if (question.type === 'text') return toolName(question, ctx, suggest);
    return renderField(question, ctx);
  };
  const fields = instrument.standard.card.map((question) => {
    const ctx = { app: local, key: resolveKey(question.id, scope), scope, required: !question.optional };
    return { question, ctx, el: fieldFor(question, ctx) };
  });
  const shown = new Set(visible());
  for (const field of fields) field.el.hidden = !shown.has(field);
  const note = h('p', { class: 'note' }, `These questions are about ${first}, the first one you named.`);
  const el = h('div', { class: 'tool__more' }, h('h3', { class: 'label' }, `About ${first}`), note, fields.map((field) => field.el));
  return { first, el, note };

  function visible() {
    const ctx = { answers: merged(store.state), owner: store.state.company.owner, scope };
    return fields.filter((field) => holds(field.question.when, ctx));
  }

  // A question that hides is drawn again empty, so that it shows no stale answer if it comes back.
  function settle() {
    const now = new Set(visible());
    for (const field of fields) {
      const hide = !now.has(field);
      if (hide && !field.el.hidden) {
        forget(field.question, field.ctx);
        const fresh = fieldFor(field.question, field.ctx);
        field.el.replaceWith(fresh);
        field.el = fresh;
      }
      field.el.hidden = hide;
    }
  }
}

// One option from a short list, as a row of segments with the opt-outs last.
function segment(question, ctx) {
  const stored = ctx.app.store.get(ctx.key);
  const options = [...question.options.filter((option) => !option.optout), ...question.options.filter((option) => option.optout)];
  const inputs = options.map((option) => {
    const input = h('input', { type: 'radio', name: ctx.key, value: String(option.n), checked: stored === option.n });
    input.addEventListener('change', () => save(ctx, option.n, input));
    return input;
  });
  const seg = h('div', { class: 'seg' }, options.map((option, i) => h('label', { class: option.optout ? 'seg__item seg__item--optout' : 'seg__item' },
    inputs[i],
    h('span', {}, option.text))));
  return fieldShell(question, ctx, seg, { clear: () => { for (const input of inputs) input.checked = false; } });
}

// The name of one tool, stored as a single string and shown as a chip over the box. A new pick replaces it.
function toolName(question, ctx, suggest) {
  const { store } = ctx.app;
  const chosen = h('div', { class: 'chips tool__names' });
  const typeahead = createTypeahead({ id: idFor(ctx.key), label: question.text, suggest, onPick: (name) => change(name) });
  show();
  return fieldShell(question, ctx, h('div', {}, chosen, typeahead));

  function change(name) {
    save(ctx, name, typeahead);
    show();
  }

  function show() {
    const name = store.get(ctx.key);
    const has = typeof name === 'string' && name !== '';
    chosen.hidden = !has;
    chosen.replaceChildren(...(has ? [nameChip(name, () => {
      change(undefined);
      typeahead.querySelector('input').focus();
    })] : []));
  }
}

// A listed name, with a button that removes it.
function nameChip(name, onRemove) {
  return h('span', { class: 'chip is-on' },
    name,
    h('button', { class: 'chip__x', type: 'button', 'aria-label': `Remove ${name}`, onClick: onRemove }, '×'));
}
