// One person's survey state and its persistence. Pure: the storage is passed in.
import { ALPHABET, isPlainObject, normalizeCode } from './company.js';

const ID_LENGTH = 10;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

// A store for the survey state, kept in `storage` under `key`.
export function createStore(storage, { key = 'isoline.survey.v1', now = () => new Date().toISOString(), random = Math.random, instrumentVersion = '' } = {}) {
  let state = null;
  const listeners = new Set();

  const save = () => attempt(() => storage.setItem(key, JSON.stringify(state)));
  const notify = () => listeners.forEach((fn) => fn(state));
  const change = (apply) => {
    if (!state) return;
    apply(state);
    state.respondent.updated = now();
    save();
    notify();
  };

  return {
    get state() {
      return state;
    },

    // True when a usable state was found in storage; it then becomes the current state.
    load() {
      const found = readState(storage, key);
      if (found) state = found;
      return found !== null;
    },

    // Starts a new state with a fresh respondent id, and saves it.
    start({ code, name, owner, facts }) {
      const at = now();
      state = {
        v: 1,
        instrument: instrumentVersion,
        company: { code, name, owner, facts },
        respondent: { id: respondentId(random), started: at, updated: at },
        answers: {},
        done: {},
        position: null
      };
      save();
      notify();
    },

    // The answer at this key, or undefined.
    get(answerKey) {
      return state ? state.answers[answerKey] : undefined;
    },

    set(answerKey, value) {
      change((s) => { s.answers[answerKey] = value; });
    },

    unset(answerKey) {
      change((s) => { delete s.answers[answerKey]; });
    },

    setPosition(screenId) {
      change((s) => { s.position = screenId; });
    },

    markDone(screenId) {
      change((s) => { s.done[screenId] = true; });
    },

    // Records which version of the instrument the answers were given against.
    // The same version again writes nothing, so opening the survey does not move the updated time.
    setInstrument(version) {
      if (state?.instrument === version) return;
      change((s) => { s.instrument = version; });
    },

    // True when the screen was marked done.
    isDone(screenId) {
      return state?.done[screenId] === true;
    },

    // A short fingerprint of the answers as they are now, to tell one set of answers from another.
    answersMark() {
      return state ? fingerprint(JSON.stringify(state.answers)) : null;
    },

    // The last final send that was sent or queued, as { mark, outcome }, where mark is the fingerprint of its answers.
    lastFinal() {
      return state?.final ?? null;
    },

    // Records a final send of the answers with this fingerprint, and how it went. With sending off nothing is recorded,
    // so that the first visit to the finish once a collection point is set still sends.
    markFinal(mark, outcome) {
      if (outcome === 'off') return;
      change((s) => { s.final = { mark, outcome }; });
    },

    // Calls fn(state) after every change; returns a function that stops it.
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },

    // The answers to send or keep: the company, the person and the answers, and nothing else. Null with no state.
    exportAnswers() {
      if (!state) return null;
      return {
        v: state.v,
        instrument: state.instrument,
        company: { code: state.company.code, name: state.company.name },
        respondent: { ...state.respondent },
        answers: { ...state.answers },
        at: now()
      };
    },

    // Forgets the state, here and in storage.
    reset() {
      state = null;
      attempt(() => storage.removeItem(key));
      notify();
    }
  };
}

// A short fingerprint of a text, the same for the same text: FNV-1a over its UTF-16 code units, 32 bits, in base 36.
export function fingerprint(text) {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), FNV_PRIME) >>> 0;
  }
  return hash.toString(36);
}

// The stored state, or null when nothing usable is stored.
function readState(storage, key) {
  try {
    const text = storage.getItem(key);
    if (text === null) return null;
    const parsed = JSON.parse(text);
    return isUsable(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// True for a state of this version with every part the pages read, of the right kind: a company with a code, a name,
// whether this person started it and its facts; a respondent with an id; the answers and the screens done.
function isUsable(state) {
  const company = state?.company;
  return state?.v === 1
    && isPlainObject(company) && normalizeCode(company.code) !== null && typeof company.name === 'string'
    && typeof company.owner === 'boolean' && isPlainObject(company.facts)
    && isPlainObject(state.respondent) && typeof state.respondent.id === 'string'
    && isPlainObject(state.answers) && isPlainObject(state.done);
}

function respondentId(random) {
  const chars = Array.from({ length: ID_LENGTH }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]);
  return `r_${chars.join('')}`;
}

// Storage may be blocked or full: the survey then carries on in memory.
function attempt(fn) {
  try {
    fn();
  } catch {
    // Nothing to do: the state is still held in memory.
  }
}
