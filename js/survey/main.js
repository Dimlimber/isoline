// Opens the survey: the saved state from this device, then the instrument, then the app.
import { config } from '../config.js';
import { h, mount } from './dom.js';
import { createStore } from './store.js';
import { createApp } from './app.js';

const root = document.getElementById('app');
const store = createStore(deviceStorage(), { key: config.storageKey });

// In a browser too old for the survey, check.js has already said so in place of the page, and nothing more happens.
if (!document.documentElement.hasAttribute('data-old-browser')) begin();

function begin() {
  if (!store.load()) {
    window.location.replace('start.html');
    return;
  }
  open();
  // Another tab, or this page shown again by the browser from its cache, may find other answers stored than the page
  // holds. The page then loads afresh from what is stored, so that neither copy overwrites the other.
  window.addEventListener('storage', (event) => {
    if (event.key === config.storageKey) reloadIfChanged();
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) reloadIfChanged();
  });
  // The store finds the same out for itself when it writes before the browser has told the page.
  store.subscribe(() => {
    if (store.behind) window.location.reload();
  });
}

async function open() {
  let instrument;
  try {
    // The browser checks with the server before using a copy it kept, so a changed instrument is picked up.
    const response = await fetch(config.instrumentUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(response.status);
    instrument = await response.json();
  } catch {
    failed();
    return;
  }
  // The start page cannot know the version, since it does not load the instrument; the answers carry it from here.
  store.setInstrument(instrument.version);
  // Anything else that stops the survey being drawn shows the same message, rather than a blank page.
  try {
    createApp({ root, instrument, store, config });
  } catch {
    failed();
  }
}

// The message in place of the survey when it cannot be drawn.
function failed() {
  mount(root, h('p', { class: 'wrap page-note' }, 'The survey could not load. Check your connection and reload the page.'));
}

// Reloads when the state stored on this device is not the one the page holds, told apart by the respondent's id and
// the time of the last change. A page that then finds nothing stored goes to the start page.
function reloadIfChanged() {
  const stored = createStore(deviceStorage(), { key: config.storageKey });
  const found = stored.load() ? stored.state.respondent : null;
  const held = store.state.respondent;
  if (found?.id !== held.id || found?.updated !== held.updated) window.location.reload();
}

// Local storage, or null where the browser blocks it; with null nothing loads and the person is sent to the start.
function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
