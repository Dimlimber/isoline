// The shell around every field, and what the fields share: saving answers, typing, and rows of options.
// A field keeps its own state in the page. Its handlers write the store directly, then call ctx.app.changed().
import { h } from '../dom.js';
import { hasValue, isSkipped } from '../conditions.js';

const SAVE_DELAY = 300;
// The saves that wait for their delay, by control. When the page is hidden they are all written at once, so that the
// last keystrokes are not lost. One listener serves the page, and a control is held only while its save waits.
const waiting = new Map();
let listening = false;
// A single or multiple choice list with at least this many options, opt-outs not counted, takes two columns on a wide screen.
const TWO_COLUMNS_FROM = 12;

// The id of the control a field's label names, made from its answer key.
export function idFor(key) {
  return `q-${key}`;
}

// The label, help, body and skip control around any field; body is one element. A question with options is a group
// named by its legend; any other question's label names the first input or textarea in the body. The skip control is
// described by the question, so each one says which question it skips, and says whether it is pressed.
// help replaces the question's own help. clear empties the field's controls when the person skips it.
export function fieldShell(question, ctx, body, { help, wide = false, clear } = {}) {
  const { app, key } = ctx;
  const required = ctx.required ?? !question.optional;
  const helpText = help ?? question.help ?? (required ? null : 'Optional.');
  const helpId = helpText ? `${idFor(key)}-help` : null;
  const titleId = `${idFor(key)}-title`;
  const skip = required ? h('button', { class: 'btn btn--quiet', type: 'button', 'aria-describedby': titleId, onClick: toggle }) : null;
  const parts = [
    helpText ? h('p', { class: 'field__help', id: helpId }, helpText) : null,
    h('div', { class: 'field__body' }, body),
    skip ? h('div', { class: 'field__foot' }, skip) : null
  ];
  const content = question.options
    ? h('fieldset', { 'aria-describedby': helpId }, h('legend', { class: 'field__label', id: titleId }, question.text), parts)
    : [h('label', { class: 'field__label', id: titleId, for: nameControl(body, key, helpId) }, question.text), parts];
  const el = h('div', { class: wide ? 'field field--wide' : 'field', 'data-key': key }, content);
  showSkipped(el, isSkipped(app.store.get(key)));
  return el;

  // Skipping stores { skipped: true } and empties the field; pressing again removes the answer.
  function toggle() {
    const skipped = !isSkipped(app.store.get(key));
    if (skipped) {
      clear?.();
      app.store.set(key, { skipped: true });
    } else {
      app.store.unset(key);
    }
    showSkipped(el, skipped);
    app.changed();
  }
}

// Stores the answer, or removes it when it is empty, then tells the app. An answer lifts a skip.
// from is the control that changed, inside the field.
export function save(ctx, value, from) {
  const { app, key } = ctx;
  if (hasValue(value)) app.store.set(key, value);
  else app.store.unset(key);
  const el = from.closest('.field');
  if (el) showSkipped(el, false);
  app.changed();
}

// Calls write with the trimmed text 300 ms after the last keystroke, when the control loses focus and when the page is
// hidden, if the text changed. Returns a function that sets the text without saving it.
export function onTyping(control, write) {
  let last = control.value;
  let timer = 0;
  const flush = () => {
    clearTimeout(timer);
    waiting.delete(control);
    if (control.value === last) return;
    last = control.value;
    write(last.trim());
  };
  control.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY);
    wait(control, flush);
  });
  control.addEventListener('blur', flush);
  return (text) => {
    clearTimeout(timer);
    waiting.delete(control);
    control.value = text;
    last = text;
  };
}

// Holds a save that waits. The page's listener is added the first time one does. A field no longer on the page when
// the page is hidden drops out without writing, since its screen has gone.
function wait(control, flush) {
  waiting.set(control, flush);
  if (listening) return;
  listening = true;
  window.addEventListener('pagehide', () => {
    for (const [held, write] of [...waiting]) {
      if (held.isConnected) write();
      else waiting.delete(held);
    }
  });
}

// True when a list of options is long enough to take two columns on a wide screen.
export function inTwoColumns(options) {
  return options.filter((option) => !option.optout).length >= TWO_COLUMNS_FROM;
}

// The rows of an option list: inputs of this type sharing the answer key as their name, opt-outs last in their own order.
// An option marked ask_text shows a box for a few words while it is chosen; releasing the option removes the words.
// With columns, the options that are not opt-outs are split between two columns, the first taking one more when they
// are odd; the opt-outs follow both. The page keeps the order of the options, which is also the order read and tabbed.
export function optionRows(options, ctx, { type, chosen, onChange, columns = false }) {
  const id = idFor(ctx.key);
  const ordered = [...options.filter((option) => !option.optout), ...options.filter((option) => option.optout)];
  const list = h('div', { class: columns ? 'opts opts--cols' : 'opts' });
  const cols = columns ? [h('div', { class: 'opts__col' }), h('div', { class: 'opts__col' })] : [];
  const half = Math.ceil(options.filter((option) => !option.optout).length / 2);
  list.append(...cols);
  const rows = ordered.map((option, i) => {
    const input = h('input', { class: 'opt__input', type, name: ctx.key, value: String(option.n), checked: chosen(option.n) });
    const label = h('label', { class: option.optout ? 'opt opt--optout' : 'opt' },
      input,
      h('span', { class: 'opt__mark' }),
      h('span', { class: 'opt__text', id: `${id}-${option.n}` }, option.text));
    const row = { option, input, label, extra: null };
    input.addEventListener('change', () => onChange(row));
    const holder = columns && !option.optout ? cols[i < half ? 0 : 1] : list;
    holder.append(label);
    return row;
  });

  // Shows the box for each chosen ask_text option, and removes the box and its words for each released one.
  const words = () => {
    for (const row of rows.filter((r) => r.option.ask_text)) {
      if (row.input.checked && !row.extra) {
        row.extra = wordsBox(row.option, ctx, `${id}-${row.option.n}`);
        row.label.after(row.extra);
      } else if (!row.input.checked && row.extra) {
        row.extra.remove();
        row.extra = null;
        forgetKey(ctx.app.store, wordsKey(ctx.key, row.option.n));
      }
    }
  };
  words();

  return {
    list,
    rows,
    words,
    // The option numbers chosen, in ascending order.
    picked: () => rows.filter((r) => r.input.checked).map((r) => r.option.n).sort((a, b) => a - b),
    // Releases every option, for a field the person skips.
    clear: () => {
      for (const row of rows) {
        row.input.checked = false;
        row.input.disabled = false;
      }
      words();
    }
  };
}

// Removes the answer at ctx.key and any words given for its options.
export function forget(question, ctx) {
  const { store } = ctx.app;
  const keys = [ctx.key, ...(question.options || []).filter((option) => option.ask_text).map((option) => wordsKey(ctx.key, option.n))];
  for (const key of keys) forgetKey(store, key);
}

function forgetKey(store, key) {
  if (store.get(key) !== undefined) store.unset(key);
}

function wordsKey(key, n) {
  return `${key}:text:${n}`;
}

// A box for a few words about a chosen option, saved at `${key}:text:${n}`.
function wordsBox(option, ctx, labelId) {
  const { app } = ctx;
  const key = wordsKey(ctx.key, option.n);
  const stored = app.store.get(key);
  const box = h('input', { class: 'input', type: 'text', maxlength: '200', placeholder: 'A few words', 'aria-labelledby': labelId, value: typeof stored === 'string' ? stored : '' });
  onTyping(box, (text) => {
    if (text) app.store.set(key, text);
    else app.store.unset(key);
    app.changed();
  });
  return h('div', { class: 'opt__extra' }, box);
}

// Gives the control a label names its id and description; returns the id, or null when the body has no control.
function nameControl(body, key, helpId) {
  const control = body.matches('input, textarea') ? body : body.querySelector('input, textarea');
  if (!control) return null;
  if (!control.id) control.id = idFor(key);
  if (helpId) control.setAttribute('aria-describedby', [helpId, control.getAttribute('aria-describedby')].filter(Boolean).join(' '));
  return control.id;
}

// Shows whether the field is skipped: the class, and the words and pressed state of its skip control.
function showSkipped(el, skipped) {
  el.classList.toggle('is-skipped', skipped);
  const button = el.querySelector('.field__foot > .btn');
  if (!button) return;
  button.textContent = skipped ? 'Answer this question' : 'Skip this question';
  button.setAttribute('aria-pressed', String(skipped));
}
