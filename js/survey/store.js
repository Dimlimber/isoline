// One person's survey state and its persistence. Pure: the storage is passed in.
import { ALPHABET, isPlainObject, normalizeCode } from './company.js';
import { hasValue } from './conditions.js';

const ID_LENGTH = 10;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

// A store for the survey state, kept in `storage` under `key`.
export function createStore(storage, { key = 'isoline.survey.v1', now = () => new Date().toISOString(), random = Math.random, instrumentVersion = '' } = {}) {
  let state = null;
  // Whether the last write to storage worked; before any write, whether there is a storage to write to.
  let saved = typeof storage?.setItem === 'function';
  const listeners = new Set();

  const save = () => {
    saved = attempt(() => storage.setItem(key, JSON.stringify(state)));
    return saved;
  };
  const notify = () => listeners.forEach((fn) => fn(state));
  // A state saved when only final sends were marked keeps its mark under final.
  const recorded = () => state?.lastSend ?? state?.final ?? null;
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

    // True while the answers are kept on this device: the last write to storage worked.
    get saved() {
      return saved;
    },

    // True when a usable state was found in storage; it then becomes the current state.
    load() {
      const found = readState(storage, key);
      if (found) state = found;
      return found !== null;
    },

    // Starts a new state with a fresh respondent id, and saves it. Returns whether it was stored.
    start({ code, name, owner, facts }) {
      const at = now();
      state = {
        v: 1,
        instrument: instrumentVersion,
        instruments: instrumentVersion ? [instrumentVersion] : [],
        company: { code, name, owner, facts },
        respondent: { id: respondentId(random), started: at, updated: at },
        answers: {},
        done: {},
        position: null
      };
      const stored = save();
      notify();
      return stored;
    },

    // Takes from an invitation for the same company what the saved company lacks: every fact it has no value for,
    // and the name when its own is empty. Nothing is written when nothing is missing.
    adopt({ name, facts }) {
      if (!state) return;
      const { company } = state;
      const added = Object.entries(facts).filter(([key, value]) => !hasValue(company.facts[key]) && hasValue(value));
      const named = company.name.trim() === '' && name.trim() !== '';
      if (added.length === 0 && !named) return;
      change((s) => {
        s.company.facts = { ...s.company.facts, ...Object.fromEntries(added) };
        if (named) s.company.name = name;
      });
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

    // The screen in view. The same screen again writes nothing, so a page that opens where it was left changes nothing
    // that another tab would have to reload for.
    setPosition(screenId) {
      if (state?.position === screenId) return;
      change((s) => { s.position = screenId; });
    },

    markDone(screenId) {
      change((s) => { s.done[screenId] = true; });
    },

    // Records that the answers were opened under this version of the instrument. instrument keeps the first version
    // they were opened under and never changes after that; instruments lists every version, in order, once each.
    // A version already recorded writes nothing, so opening the survey does not move the updated time.
    setInstrument(version) {
      if (!state || (state.instrument && Array.isArray(state.instruments) && state.instruments.includes(version))) return;
      // A state saved before the list existed starts it from the version it holds.
      const seen = Array.isArray(state.instruments) ? state.instruments : [state.instrument].filter(Boolean);
      change((s) => {
        s.instrument = s.instrument || version;
        s.instruments = seen.includes(version) ? [...seen] : [...seen, version];
      });
    },

    // True when the screen was marked done.
    isDone(screenId) {
      return state?.done[screenId] === true;
    },

    // A short fingerprint of the answers as they are now, to tell one set of answers from another.
    answersMark() {
      return state ? fingerprint(JSON.stringify(state.answers)) : null;
    },

    // The last send of any kind that was sent, queued or refused, as { mark, outcome }, where mark is the fingerprint
    // of its answers.
    lastSend() {
      return recorded();
    },

    // Records a send of the answers with this fingerprint, and how it went, in place of any mark kept under final.
    // The same again writes nothing. With sending off nothing is recorded, so that the first send once a collection
    // point is set still goes.
    markSend(mark, outcome) {
      const last = recorded();
      const same = last?.mark === mark && last.outcome === outcome && state.final === undefined;
      if (outcome === 'off' || same) return;
      change((s) => {
        s.lastSend = { mark, outcome };
        delete s.final;
      });
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
        instruments: Array.isArray(state.instruments) ? [...state.instruments] : [],
        company: { code: state.company.code, name: state.company.name },
        respondent: { ...state.respondent },
        answers: { ...state.answers },
        at: now()
      };
    },

    // Forgets the state, here and in storage.
    reset() {
      state = null;
      saved = attempt(() => storage.removeItem(key));
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

// Storage may be blocked or full: the survey then carries on in memory. True when fn worked.
function attempt(fn) {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}
