// The start page: continue on this device, begin from a colleague's invitation, or start or join a company.
import { config } from './config.js';
import { h } from './survey/dom.js';
import { createStore } from './survey/store.js';
import { decodeInvite, newCompanyCode, normalizeCode } from './survey/company.js';

const SURVEY = 'survey.html';
const BLOCKED = 'This browser does not let the survey save answers on this device. Allow site data for this site, or use another browser.';
const root = document.getElementById('start');
const store = createStore(deviceStorage(), { key: config.storageKey });

render();
// An invitation pasted into the address bar changes only the fragment, which does not load the page again.
window.addEventListener('hashchange', render);
// Going back from the survey can restore this page as it was left, so it is drawn again from what is saved now.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) render();
});

// What the page offers follows from the answers saved on this device and the invitation in the link.
// A link for the company saved here hands over the facts and the name the saved company lacks, then offers to continue.
function render() {
  const invite = decodeInvite(window.location.hash);
  const saved = store.load() ? store.state : null;
  const same = saved !== null && invite !== null && invite.code === saved.company.code;
  if (same) store.adopt(invite);
  if (saved && (!invite || same)) show(continuePanel(store.state));
  else if (invite) show(invitedPanel(invite, saved));
  else showStart();
}

function show(...nodes) {
  root.replaceChildren(...nodes);
}

// Answers for this company are saved here: continue, or remove them and start again.
function continuePanel(state) {
  const { name } = state.company;
  const who = name ? `You are answering for ${name}.` : 'You are answering for your company.';
  const actions = h('div');
  const panel = h('section', { class: 'panel panel--single' },
    h('h2', { class: 'h3' }, 'Continue where you left off'),
    h('p', {}, `${who} Your answers are saved on this device.`),
    actions);
  offer();
  return panel;

  // Continue, or start again. Returns the start again button.
  function offer() {
    const again = h('button', { class: 'btn btn--quiet', type: 'button', onClick: askFirst }, 'Start again');
    actions.replaceChildren(row(h('a', { class: 'btn btn--primary', href: SURVEY }, 'Continue'), again));
    return again;
  }

  // Asks before the answers go. Focus lands on keeping them, so a key held down removes nothing.
  function askFirst() {
    const note = h('p', { class: 'note', id: 'start-again-note' }, 'This removes the answers saved on this device.');
    const remove = h('button', { class: 'btn', type: 'button', 'aria-describedby': note.id, onClick: removeAll }, 'Remove and start again');
    const keep = h('button', { class: 'btn btn--quiet', type: 'button', onClick: () => offer().focus() }, 'Keep my answers');
    actions.replaceChildren(note, row(remove, keep));
    keep.focus();
  }

  function removeAll() {
    store.reset();
    showStart().focus();
  }
}

// A colleague's link: begin for their company. Answers saved here for another company would be replaced.
function invitedPanel(invite, saved) {
  const heading = invite.name ? `You are answering for ${invite.name}` : 'You are answering for your company';
  // Someone who joined with a code has no company name, only the code.
  const other = saved ? (saved.company.name || saved.company.code) : '';
  const company = { code: invite.code, name: invite.name, owner: false, facts: invite.facts };
  return h('section', { class: 'panel panel--single' },
    h('h2', { class: 'h3' }, heading),
    h('p', {}, 'A colleague invited you. You will be asked about the parts of marketing you know.'),
    other ? h('p', { class: 'note' }, `This device holds answers for ${other}. Beginning here removes them.`) : null,
    other ? h('a', { class: 'btn btn--quiet', href: SURVEY }, `Continue for ${other}`) : null,
    row(h('button', { class: 'btn btn--primary', type: 'button', onClick: (event) => begin(company, event.currentTarget) }, 'Begin')));
}

// Nothing saved and no invitation: start for a company, or join one with its code. Returns the company name input.
function showStart() {
  const start = formPanel({
    id: 'start-name',
    heading: 'Start for your company',
    about: 'You are the first from your company. You answer a few questions about it, then choose your parts.',
    label: 'Company name',
    attrs: { autocomplete: 'organization', maxlength: '200' },
    button: h('button', { class: 'btn btn--primary', type: 'submit' }, 'Start'),
    submit: (text, button) => {
      const name = text.trim();
      if (name.length < 2) return 'Enter your company\'s name.';
      begin({ code: newCompanyCode(), name, owner: true, facts: {} }, button);
      return null;
    }
  });
  const join = formPanel({
    id: 'start-code',
    heading: 'Join your company',
    about: 'A colleague has started. Enter the code they gave you.',
    label: 'Company code',
    attrs: { placeholder: 'XXXX-XXXX', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' },
    button: h('button', { class: 'btn', type: 'submit' }, 'Join'),
    submit: (text, button) => {
      const code = normalizeCode(text);
      if (!code) return 'That code does not look right. It has eight letters and numbers.';
      begin({ code, name: '', owner: false, facts: {} }, button);
      return null;
    }
  });
  show(h('div', { class: 'panels' }, start.form, join.form), h('p', { class: 'note' }, 'Your answers save on this device as you go.'));
  return start.input;
}

// A panel that is a form: a heading, a line about it, one labelled input, and a button that also answers to Enter.
// submit(text, button) acts on the text, or returns what is wrong with it, which shows above the button and is announced.
function formPanel({ id, heading, about, label, attrs, button, submit }) {
  const input = h('input', { class: 'input', type: 'text', id, ...attrs });
  const form = h('form', { class: 'panel', onSubmit },
    h('h2', { class: 'h3' }, heading),
    h('p', { class: 'muted' }, about),
    h('label', { for: id }, label),
    input,
    button);
  return { form, input };

  function onSubmit(event) {
    event.preventDefault();
    form.querySelector('.error')?.remove();
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    const problem = submit(input.value, button);
    if (!problem) return;
    const error = h('p', { class: 'error', id: `${id}-error`, role: 'alert' }, problem);
    button.before(error);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);
    input.focus();
  }
}

// Buttons side by side at the foot of a panel.
function row(...buttons) {
  return h('div', { class: 'panel__actions' }, buttons);
}

// Saves the new start on this device and opens the survey. When the browser does not let the survey save, the survey
// could keep no answer: the page stays, and says so above the button that was pressed.
function begin(company, button) {
  if (store.start(company)) {
    window.location.assign(SURVEY);
    return;
  }
  button.closest('.panel').querySelector('.error')?.remove();
  (button.closest('.panel__actions') ?? button).before(h('p', { class: 'error', role: 'alert' }, BLOCKED));
}

// Local storage, or null where the browser blocks it.
function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
