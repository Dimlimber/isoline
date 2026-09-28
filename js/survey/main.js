// Opens the survey: the saved state from this device, then the instrument, then the app.
import { config } from '../config.js';
import { h, mount } from './dom.js';
import { createStore } from './store.js';
import { createApp } from './app.js';

const root = document.getElementById('app');
const store = createStore(deviceStorage(), { key: config.storageKey });

if (store.load()) open();
else window.location.replace('start.html');

async function open() {
  let instrument;
  try {
    // The browser checks with the server before using a copy it kept, so a changed instrument is picked up.
    const response = await fetch(config.instrumentUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(response.status);
    instrument = await response.json();
  } catch {
    mount(root, h('p', { class: 'wrap', style: 'padding-block:48px' }, 'The survey could not load. Check your connection and reload the page.'));
    return;
  }
  // The start page cannot know the version, since it does not load the instrument; the answers carry it from here.
  store.setInstrument(instrument.version);
  createApp({ root, instrument, store, config });
}

// Local storage, or null where the browser blocks it; with null nothing loads and the person is sent to the start.
function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
