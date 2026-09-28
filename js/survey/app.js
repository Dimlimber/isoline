// The survey page: the top bar, the progress rail, one screen at a time, and moving between screens.
import { clear, h, mount } from './dom.js';
import { buildFlow, firstIncomplete, isScreenComplete, missing, railItems } from './flow.js';
import { createSubmitter } from './submit.js';
import { minutes, remainingSeconds } from './timing.js';
import { frame } from './screens/frame.js';
import * as welcome from './screens/welcome.js';
import * as intro from './screens/intro.js';
import * as questions from './screens/questions.js';
import * as screener from './screens/screener.js';
import * as jobs from './screens/jobs.js';
import * as back from './screens/back.js';
import * as result from './screens/result.js';
import * as prompt from './screens/prompt.js';
import * as end from './screens/end.js';
import * as tools from './screens/tools.js';

// The module for each kind of screen. A later task adds a kind with one module and one line here.
const SCREENS = { welcome, intro, questions, screener, jobs, back, result, prompt, tools, end };
// Screens that only inform are complete once the person continues past them.
const DONE_ON_CONTINUE = ['welcome', 'intro', 'end'];
const WIDE = '(min-width: 1024px)';
// What the navigation row says when Continue is refused, by kind of screen.
const REFUSED = {
  screener: 'Mark at least one part to continue.',
  jobs: 'Answer for every job to continue.',
  prompt: 'Write a few sentences to continue.',
  tools: 'Answer for every tool to continue.'
};
const REFUSED_OTHER = 'Answer or skip the marked questions to continue.';

// A kind of screen with no module yet: its title and a note, and Continue lets the person pass.
const unbuilt = {
  render: (screen, app) => frame(screen, app, { title: screen.title, body: h('p', { class: 'note' }, 'This part is not built yet.') })
};

// Draws the shell and the current screen; returns the app object that every screen and field is given.
export function createApp({ root, instrument, store, config }) {
  const options = { minPromptLength: config.minPromptLength };
  const app = { instrument, store, config, flow: [], index: 0, screen: null, lastSend: null, next, back, go, goTo, changed };
  // Nothing is sent unless config.endpoint is set. What could not be sent waits on this device and is tried again on opening.
  const submitter = createSubmitter({ endpoint: config.endpoint, fetch: window.fetch.bind(window), storage: window.localStorage, queueKey: config.queueKey });
  submitter.flush();

  const rail = h('nav', { class: 'shell__rail', id: 'survey-rail', 'aria-label': 'Sections' });
  const main = h('main', { class: 'shell__main' });
  const time = h('span');
  const menu = h('button', { class: 'btn btn--small topbar__menu', type: 'button', 'aria-controls': 'survey-rail', 'aria-expanded': 'false', onClick: () => openRail(!rail.classList.contains('is-open')) }, 'Sections');
  const fill = h('div', { class: 'bar__fill' });
  const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Progress', 'aria-valuemin': '0', 'aria-valuemax': '100' }, fill);
  clear(root);
  root.append(
    h('header', { class: 'topbar' },
      h('div', { class: 'topbar__in' },
        h('a', { class: 'wordmark', href: 'index.html' }, 'Isoline'),
        h('div', { class: 'topbar__meta' }, time, h('span', { class: 'topbar__saved' }, 'Saved on this device'), menu)),
      bar),
    h('div', { class: 'shell__body' }, rail, main));

  window.matchMedia(WIDE).addEventListener('change', (event) => {
    if (event.matches) openRail(false);
  });
  document.addEventListener('keydown', onKey);

  app.flow = buildFlow(instrument, store.state, config);
  const saved = app.flow.findIndex((screen) => screen.id === store.state.position);
  const first = firstIncomplete(instrument, app.flow, store.state, options);
  moveTo(saved !== -1 && saved <= first ? saved : first);
  return app;

  // Continues when the screen is complete; otherwise marks what is missing.
  function next() {
    const { screen } = app;
    if (DONE_ON_CONTINUE.includes(screen.kind)) store.markDone(screen.id);
    const open = SCREENS[screen.kind] ? missing(instrument, screen, store.state, options) : [];
    if (open.length > 0) showMissing(open);
    else if (app.index < app.flow.length - 1) {
      if (endsPart()) send('progress');
      moveTo(app.index + 1);
    }
  }

  // A section's tools, or the last screen of a block: leaving it with Continue sends the answers so far.
  function endsPart() {
    const { screen, flow, index } = app;
    return screen.kind === 'tools' || (screen.railKey.endsWith(':block') && flow[index + 1].railKey !== screen.railKey);
  }

  // Sends the answers so far. app.lastSend keeps the outcome ('off', 'sent' or 'queued') for the finish screen.
  function send(kind) {
    app.lastSend = submitter.send({ ...store.exportAnswers(), kind });
  }

  // Arriving at the finish sends the answers once per set of answers, so a reload there adds nothing.
  // When they are those of the last final send that was sent or queued, app.lastSend keeps how that send went.
  // The fingerprint is taken before sending, since the answers can change while the send is on its way.
  function sendFinal() {
    const mark = store.answersMark();
    const last = store.lastFinal();
    if (last?.mark === mark) {
      app.lastSend = Promise.resolve(last.outcome);
      return;
    }
    send('final');
    app.lastSend.then((outcome) => store.markFinal(mark, outcome));
  }

  function back() {
    if (app.index > 0) moveTo(app.index - 1);
  }

  // Moves to a screen at or before the first one that is not complete.
  function go(index) {
    if (index >= 0 && index <= firstIncomplete(instrument, app.flow, store.state, options)) moveTo(index);
  }

  function goTo(screenId) {
    go(app.flow.findIndex((screen) => screen.id === screenId));
  }

  // Called after any answer changes. Rebuilds the flow and keeps the screen in place without redrawing it,
  // so that fields keep their state; only the rail, the time left, the bar and any marks are redrawn.
  // A screen that has left the flow gives way to whatever screen now sits at its place.
  function changed() {
    const id = app.screen.id;
    app.flow = buildFlow(instrument, store.state, config);
    const index = app.flow.findIndex((screen) => screen.id === id);
    if (index === -1) {
      moveTo(Math.min(app.index, app.flow.length - 1));
      return;
    }
    app.index = index;
    app.screen = app.flow[index];
    drawProgress();
    clearMarks();
  }

  function moveTo(index) {
    app.index = index;
    app.screen = app.flow[index];
    store.setPosition(app.screen.id);
    if (app.screen.kind === 'end') sendFinal();
    const view = (SCREENS[app.screen.kind] || unbuilt).render(app.screen, app);
    view.classList.add('screen-enter');
    mount(main, view);
    openRail(false);
    drawProgress();
    window.scrollTo(0, 0);
    view.querySelector('.screen__title')?.focus({ preventScroll: true });
  }

  // Marks each part of the screen that still stops it, says so in the navigation row, and brings the first into view.
  // A part is anything that carries its answer key: a field, or a job's row or card. The first part brought into view
  // is one that is drawn, since the jobs table and its cards carry the same keys and only one of them shows.
  // A part taller than half the window is brought in from its top, so that its question or job shows.
  function showMissing(keys) {
    const parts = [...main.querySelectorAll('[data-key]')];
    for (const part of parts) part.classList.toggle('is-missing', keys.includes(part.dataset.key));
    const nav = main.querySelector('.screen__nav');
    nav.querySelector('.error')?.remove();
    nav.append(h('p', { class: 'error', role: 'alert' }, REFUSED[app.screen.kind] ?? REFUSED_OTHER));
    const first = parts.find((part) => keys.includes(part.dataset.key) && part.getClientRects().length > 0);
    first?.scrollIntoView({ block: first.offsetHeight > window.innerHeight / 2 ? 'start' : 'center' });
  }

  // After a refused Continue, each mark clears once its answer comes in, and the message goes once nothing is missing.
  // New marks appear only when Continue is pressed.
  function clearMarks() {
    const marked = [...main.querySelectorAll('[data-key].is-missing')];
    const message = main.querySelector('.screen__nav .error');
    if (marked.length === 0 && !message) return;
    const open = missing(instrument, app.screen, store.state, options);
    for (const part of marked) {
      if (!open.includes(part.dataset.key)) part.classList.remove('is-missing');
    }
    if (open.length === 0) message?.remove();
  }

  // The time left, the bar and the rail, from which screens are complete.
  function drawProgress() {
    const complete = {};
    for (const screen of app.flow) {
      if (isScreenComplete(instrument, screen, store.state, options)) complete[screen.id] = true;
    }
    const seconds = remainingSeconds(app.flow, complete);
    const n = minutes(seconds);
    time.textContent = seconds < 60 ? 'Almost done' : `About ${n} ${n === 1 ? 'minute' : 'minutes'} left`;
    time.hidden = app.screen.kind === 'end';
    const share = Math.round((100 * Object.keys(complete).length) / app.flow.length);
    fill.style.width = `${share}%`;
    bar.setAttribute('aria-valuenow', String(share));
    mount(rail, drawRail(complete));
  }

  // One item per run of screens, grouped under their job of marketing. Items done or current are buttons.
  function drawRail(complete) {
    const groups = [];
    for (const item of railItems(app.flow)) {
      if (groups.at(-1)?.name !== item.group) groups.push({ name: item.group, items: [] });
      groups.at(-1).items.push(item);
    }
    return h('div', { class: 'rail' }, groups.map((group) => h('div', { class: 'rail__group' },
      h('p', { class: 'label' }, group.name),
      group.items.map((item) => railItem(item, complete)))));
  }

  function railItem(item, complete) {
    const done = app.flow.slice(item.first, item.last + 1).every((screen) => complete[screen.id]);
    const current = app.index >= item.first && app.index <= item.last;
    const className = ['rail__item', done && 'is-done', current && 'is-current'].filter(Boolean).join(' ');
    const content = [h('span', { class: 'rail__mark' }), item.label];
    if (!done && !current) return h('div', { class: className }, content);
    return h('button', { class: className, type: 'button', 'aria-current': current ? 'step' : null, onClick: () => go(item.first) }, content);
  }

  // On narrow screens the rail opens over the page. While it is open the page under it cannot take focus.
  function openRail(open) {
    rail.classList.toggle('is-open', open);
    main.inert = open;
    menu.textContent = open ? 'Close' : 'Sections';
    menu.setAttribute('aria-expanded', String(open));
  }

  // Ctrl+Enter and Cmd+Enter do the same as Continue.
  function onKey(event) {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.isComposing) return;
    const button = main.querySelector('.screen__nav .btn--primary');
    if (!button) return;
    event.preventDefault();
    openRail(false);
    button.focus({ preventScroll: true }); // a field that has not saved its last keystrokes saves them as it loses focus
    button.click();
  }
}
