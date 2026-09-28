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
    const response = await fetch(config.instrumentUrl);
    if (!response.ok) throw new Error(response.status);
    instrument = await response.json();
  } catch {
    mount(root, h('p', { class: 'wrap', style: 'padding-block:48px' }, 'The survey could not load. Check your connection and reload the page.'));
    return;
  }
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
