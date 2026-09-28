// What counts as an answer, where an answer lives, and whether a condition holds. Pure: no DOM, no storage.

const SCOPED = /^(STD|TC|MC)\./;
const HOW_CUSTOMERS_BUY = 'CORE.07';
const ROUTE_OF_OPTION = { 1: 'D', 2: 'D', 3: 'D', 4: 'S', 5: 'P', 6: 'P' };

// True when the value is the skipped marker { skipped: true }.
export function isSkipped(value) {
  return typeof value === 'object' && value !== null && value.skipped === true;
}

// True when the value is a real answer: not missing, skipped, blank or empty.
export function hasValue(value) {
  if (value === undefined || value === null || isSkipped(value)) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Array.isArray(value.selected) ? value.selected.length > 0 : Object.keys(value).length > 0;
  return true;
}

// True when the question is answered or skipped.
export function isSettled(value) {
  return hasValue(value) || isSkipped(value);
}

// The answer key for a question: standard, tool card and module block questions live inside a scope.
export function resolveKey(questionId, scope) {
  return SCOPED.test(questionId) ? `${scope}:${questionId}` : questionId;
}

// The routes to market the company sells through, read from how customers buy.
export function routes(answers) {
  const value = answers[HOW_CUSTOMERS_BUY];
  if (!hasValue(value)) return { all: new Set(), main: null, known: false };
  const all = new Set(chosenOptions(value).map((n) => ROUTE_OF_OPTION[n]).filter(Boolean));
  return { all, main: ROUTE_OF_OPTION[value.main] ?? null, known: true };
}

// True when every clause holds; a missing or empty list always holds.
export function holds(clauses, ctx) {
  return (clauses || []).every((clause) => clauseHolds(clause, ctx));
}

function clauseHolds(clause, { answers = {}, owner = false, scope } = {}) {
  if (clause.fact === 'owner') return owner === true;
  if (clause.fact === 'route') return routeHolds(clause.in, answers);
  const value = answers[resolveKey(clause.q, scope)];
  if (clause.answered) return hasValue(value);
  if (clause.any) return picksSomething(value);
  return chosenOptions(value).some((n) => (clause.in || []).includes(n));
}

// With no company facts the route is unknown, and every route is offered.
function routeHolds(wanted, answers) {
  const { all, known } = routes(answers);
  return !known || wanted.some((route) => all.has(route));
}

// The option numbers in a single, multi or multi_main answer.
function chosenOptions(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null && Array.isArray(value.selected)) return value.selected;
  return [value];
}

// True when a job answer names a job rather than 'none'.
function picksSomething(value) {
  if (Array.isArray(value)) return value.some((id) => id !== 'none');
  return typeof value === 'string' && value !== '' && value !== 'none';
}
