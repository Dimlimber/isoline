// The marks on the parts of a screen that still need an answer after a refused Continue. A part is anything that
// carries its answer key in data-key: a field, a job's row in the table or its card, the question of the right amount
// of AI, or a tool category. A marked part says so in words under what names it, and its group or controls carry
// aria-invalid and point at those words, so the mark is never told by colour alone.
import { h } from './dom.js';

const WORDS = 'This still needs an answer.';
// What names a part: a field's legend or label, a job's name in the table or on its card, the question of the right
// amount of AI, or a tool category's question. The first of these inside the part names it.
const NAMES = 'legend, label.field__label, th[scope="row"], .h3, .label';
// The words under each marked part.
const lines = new WeakMap();
let count = 0;

// Marks the part, or clears its mark. The words have an id, which the part's group or controls add to what their
// aria-describedby already holds; both go when the mark goes.
export function markPart(part, on) {
  part.classList.toggle('is-missing', on);
  const line = lines.get(part);
  if (on && !line) {
    count += 1;
    const words = h('p', { class: 'error', id: `missing-${count}` }, WORDS);
    const name = own(part, NAMES)[0];
    // A job's name is a table cell, so its words go inside the cell, under the name.
    if (!name) part.prepend(words);
    else if (name.matches('th')) name.append(words);
    else name.after(words);
    for (const el of carriers(part)) {
      el.setAttribute('aria-invalid', 'true');
      describe(el, words.id, true);
    }
    lines.set(part, words);
  } else if (!on && line) {
    for (const el of carriers(part)) {
      el.removeAttribute('aria-invalid');
      describe(el, line.id, false);
    }
    line.remove();
    lines.delete(part);
  }
}

// The first control of the part that is drawn and can be used, where focus goes after a refused Continue.
// A control in a view that is not drawn, such as the other of the two job views, has no box.
export function firstControl(part) {
  return [...part.querySelectorAll('input, textarea, button')].find((el) => !el.disabled && el.getClientRects().length > 0);
}

// What carries aria-invalid: a tool category's group; the input or textarea a field's label names; a field's fieldset;
// the radio group of a job's card or of the right amount of AI; or else the radios of a job's row in the table,
// which has no element of its own for the group.
function carriers(part) {
  if (part.getAttribute('role') === 'group') return [part];
  const label = own(part, 'label.field__label')[0];
  if (label) return label.control ? [label.control] : [];
  const group = own(part, 'fieldset, [role="radiogroup"]')[0];
  return group ? [group] : own(part, 'input[type="radio"]');
}

// The elements inside the part that match, leaving out those of a part inside it, such as a job's question of the
// right amount of AI or a tool's questions.
function own(part, selector) {
  return [...part.querySelectorAll(selector)].filter((el) => el.closest('[data-key]') === part);
}

// Adds the id to the element's aria-describedby, or takes it out, keeping the ids it already holds.
function describe(el, id, on) {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(' ').filter((x) => x !== '' && x !== id);
  if (on) ids.push(id);
  if (ids.length > 0) el.setAttribute('aria-describedby', ids.join(' '));
  else el.removeAttribute('aria-describedby');
}
