// Company codes and invitation links. Pure: no DOM, no storage.
import { hasValue } from './conditions.js';

// Letters and digits with no look-alikes: no 0, 1, I, L or O.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// The company facts that branching needs, and the only ones an invitation carries.
export const FACT_KEYS = ['CORE.04', 'CORE.06', 'CORE.07', 'CORE.12'];

const CODE_LENGTH = 8;
const INVITE_PREFIX = 'j=';
// A link is bounded: a longer fragment is refused, and a name is cut to the start page's own limit.
const MAX_FRAGMENT = 4000;
const MAX_NAME = 200;
// Control characters, and the characters that change the direction of text around them.
const HIDDEN = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
// A fact is one option number, or up to this many chosen.
const MAX_OPTION = 99;
const MAX_CHOSEN = 20;

// A new company code: two groups of four characters from ALPHABET, for example 'K7Q2-9XPM'.
export function newCompanyCode(random = Math.random) {
  const chars = Array.from({ length: CODE_LENGTH }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]);
  return format(chars.join(''));
}

// The code a person typed, tidied into 'XXXX-XXXX'; null if it is not a code.
export function normalizeCode(text) {
  const chars = String(text ?? '').toUpperCase().replace(/[\s-]/g, '');
  const valid = chars.length === CODE_LENGTH && [...chars].every((ch) => ALPHABET.includes(ch));
  return valid ? format(chars) : null;
}

// The company facts that branching needs, keeping only those that have a value.
export function pickFacts(answers) {
  return Object.fromEntries(FACT_KEYS.filter((key) => hasValue(answers[key])).map((key) => [key, answers[key]]));
}

// The fragment of an invitation link: 'j=' followed by the invitation as base64url JSON.
export function encodeInvite({ code, name, facts }) {
  return INVITE_PREFIX + toBase64Url(JSON.stringify({ code, name, facts }));
}

// The invitation in a link fragment ('#j=…' or 'j=…'); null if it is broken or longer than 4,000 characters.
// Its name and facts are tidied, since a link can carry anything.
export function decodeInvite(hash) {
  const text = String(hash ?? '').replace(/^#/, '');
  if (!text.startsWith(INVITE_PREFIX) || text.length > MAX_FRAGMENT) return null;
  try {
    const invite = JSON.parse(fromBase64Url(text.slice(INVITE_PREFIX.length)));
    const code = normalizeCode(invite.code);
    const wellFormed = code !== null && typeof invite.name === 'string' && isPlainObject(invite.facts);
    return wellFormed ? { code, name: cleanName(invite.name), facts: usableFacts(invite.facts) } : null;
  } catch {
    return null;
  }
}

// A name without hidden characters, cut to 200 characters.
function cleanName(name) {
  return [...name.replace(HIDDEN, '')].slice(0, MAX_NAME).join('');
}

// The facts that branching needs, each kept only when its value has the shape of an answer.
function usableFacts(facts) {
  return Object.fromEntries(FACT_KEYS.map((key) => [key, factValue(facts[key])]).filter(([, value]) => value !== null));
}

// A whole number from 1 to 99, or one to twenty of them chosen with the main one among them or null; else null.
// A chosen set is copied with those two parts only.
function factValue(value) {
  if (isOption(value)) return value;
  if (!isPlainObject(value) || !Array.isArray(value.selected)) return null;
  const { selected, main } = value;
  const fits = selected.length >= 1 && selected.length <= MAX_CHOSEN && selected.every(isOption) && (main === null || selected.includes(main));
  return fits ? { selected: [...selected], main } : null;
}

function isOption(n) {
  return Number.isInteger(n) && n >= 1 && n <= MAX_OPTION;
}

function format(chars) {
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// UTF-8 text to base64url without padding, so that accented names survive.
function toBase64Url(text) {
  const binary = Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// base64url back to UTF-8 text; throws when the input is not valid.
function fromBase64Url(text) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
