// Company codes and invitation links. Pure: no DOM, no storage.
import { hasValue } from './conditions.js';

// Letters and digits with no look-alikes: no 0, 1, I, L or O.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// The company facts that branching needs, and the only ones an invitation carries.
export const FACT_KEYS = ['CORE.04', 'CORE.06', 'CORE.07', 'CORE.12'];

const CODE_LENGTH = 8;
const INVITE_PREFIX = 'j=';

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

// The invitation in a link fragment ('#j=…' or 'j=…'); null if it is broken.
export function decodeInvite(hash) {
  const text = String(hash ?? '').replace(/^#/, '');
  if (!text.startsWith(INVITE_PREFIX)) return null;
  try {
    const invite = JSON.parse(fromBase64Url(text.slice(INVITE_PREFIX.length)));
    const code = normalizeCode(invite.code);
    const wellFormed = code !== null && typeof invite.name === 'string' && isPlainObject(invite.facts);
    return wellFormed ? { code, name: invite.name, facts: pickFacts(invite.facts) } : null;
  } catch {
    return null;
  }
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
