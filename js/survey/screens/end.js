// The finish: what the person covered, a link for colleagues, more parts, a copy to keep, and whether the answers were sent.
import { h } from '../dom.js';
import { encodeInvite, pickFacts } from '../company.js';
import { isScreenComplete, merged, railItems } from '../flow.js';
import { frame } from './frame.js';

// Rail groups that hold no part of marketing.
const NOT_PARTS = ['Start', 'Finish'];
// The end of the rail key of a job of marketing's closing block, which is not a section.
const BLOCK = ':block';
const COPIED_FOR = 2000;
// Some browsers read the file after the click has returned, so the file is let go a little later.
const RELEASE_AFTER = 10000;
const SENDING = {
  off: 'Your answers are stored on this device.',
  sent: 'Your answers have been sent.',
  queued: 'Your answers could not be sent. They are safe on this device, and we will try again next time you open this page.',
  refused: 'Your answers could not be sent. They are safe on this device. Use "Download my answers" to keep a copy.'
};

export function render(screen, app) {
  // With no continue button to mark it, the finish is done once it is shown.
  if (!app.store.isDone(screen.id)) app.store.markDone(screen.id);
  return frame(screen, app, {
    kicker: 'Finish',
    title: 'Thank you',
    lead: 'Your answers are saved.',
    body: [covered(app), invite(app), more(app), keep(app), sending(app)],
    continueLabel: null
  });
}

// The sections finished so far, by their names in the rail.
function covered(app) {
  const options = { minPromptLength: app.config.minPromptLength };
  const complete = (screen) => isScreenComplete(app.instrument, screen, app.store.state, options);
  const labels = railItems(app.flow)
    .filter((item) => !NOT_PARTS.includes(item.group) && !item.key.endsWith(BLOCK))
    .filter((item) => app.flow.slice(item.first, item.last + 1).every(complete))
    .map((item) => item.label);
  return h('section', { class: 'end__part' },
    h('h2', { class: 'h3' }, 'What you covered'),
    labels.length > 0 ? h('ul', { class: 'plain' }, labels.map((label) => h('li', {}, label))) : h('p', { class: 'note' }, 'No parts yet.'));
}

// A link to the start page for this company. It carries the facts that decide what colleagues are asked,
// after the # so that browsers never send it to a server.
function invite(app) {
  const { state } = app.store;
  const { code, name } = state.company;
  const fragment = encodeInvite({ code, name, facts: pickFacts(merged(state)) });
  const link = new URL(`start.html#${fragment}`, window.location.href).href;
  const field = h('input', { class: 'input', type: 'text', readonly: true, value: link, 'aria-labelledby': 'end-invite' });
  const button = h('button', { class: 'btn', type: 'button', onClick: copy }, 'Copy link');
  // The button's new words are seen; this hidden line has a screen reader say them too.
  const status = h('span', { class: 'visually-hidden', role: 'status' });
  let timer = 0;
  return h('section', { class: 'end__part' },
    h('h2', { class: 'h3', id: 'end-invite' }, 'Invite colleagues'),
    h('p', {}, 'Anyone in your marketing organization can use this link. One person can answer everything, or each person can take their part.'),
    field,
    button,
    status,
    h('p', { class: 'note' }, `Company code: ${code}`));

  async function copy() {
    field.select();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // The browser did not allow it: the link stays selected, to copy by hand.
      return;
    }
    button.textContent = 'Copied';
    status.textContent = 'Copied';
    clearTimeout(timer);
    // The line empties again with the button, so that the next copy is announced as well.
    timer = setTimeout(() => {
      button.textContent = 'Copy link';
      status.textContent = '';
    }, COPIED_FOR);
  }
}

// Back to the self-screen, to choose more parts.
function more(app) {
  return h('section', { class: 'end__part' },
    h('h2', { class: 'h3' }, 'Add more parts'),
    h('p', {}, 'You can come back and take more parts at any time.'),
    h('button', { class: 'btn', type: 'button', onClick: () => app.goTo('screener') }, 'Choose more parts'));
}

// The answers as a file, saved through a temporary link.
function keep(app) {
  return h('section', { class: 'end__part' },
    h('h2', { class: 'h3' }, 'Keep a copy'),
    h('button', { class: 'btn', type: 'button', onClick: download }, 'Download my answers'));

  function download() {
    const { store } = app;
    const file = new Blob([JSON.stringify(store.exportAnswers(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = h('a', { href: url, download: `isoline-answers-${store.state.company.code}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), RELEASE_AFTER);
  }
}

// How the last send went. It fills in when the send settles, and is announced then. While the finish is on the page it
// follows every change to the saved state, so answers that waited and have been sent since are said to be sent.
function sending(app) {
  const note = h('p', { class: 'note', role: 'status' });
  const show = () => app.lastSend?.then((outcome) => {
    if (note.textContent !== SENDING[outcome]) note.textContent = SENDING[outcome];
  });
  show();
  const stop = app.store.subscribe(() => (note.isConnected ? show() : stop()));
  return h('section', { class: 'end__part' }, note);
}
