// The ordered list of screens for one person, and when each screen is finished. Pure: no DOM, no storage.
import { getQuestion, getSection, getModule } from './lookup.js';
import { isSkipped, hasValue, isSettled, resolveKey, holds } from './conditions.js';

const SCREENER = 'CORE.14';
const SPEAKS_TO = [1, 2, 3];
const FIT_ASKED = [2, 3, 4, 5, 6];
const CARD = ['TC.1', 'TC.2', 'TC.3'];
const PICKED_A_JOB = [{ q: 'STD.BACK', any: true }];
const SECONDS = { welcome: 5, intro: 5, end: 5, back: 12, result: 12, perJob: 17, perTool: 25 };
const TITLES = {
  welcome: 'Before you start',
  jobs: 'How the work gets done',
  back: 'Cutting back',
  result: 'Results',
  prompt: 'Walk us through',
  tools: 'Your tools',
  end: 'Thank you'
};
const START_RAIL = {
  'About you': { railKey: 'start:you', railLabel: 'About you' },
  'About your company': { railKey: 'start:company', railLabel: 'Your company' },
  'What you can speak to': { railKey: 'start:screen', railLabel: 'What you can speak to' },
  'AI in your own work': { railKey: 'start:ai', railLabel: 'AI in your own work' },
  'The rules as you know them': { railKey: 'start:rules', railLabel: 'The rules as you know them' }
};
const BLOCK_LABEL = 'Team, checks and plans';

// The person's own answers laid over the company facts they inherited.
export function merged(state) {
  return { ...state.company.facts, ...state.answers };
}

// The section objects whose conditions hold for this person, in instrument order.
export function offeredSections(instrument, state) {
  const answers = merged(state);
  const owner = state.company.owner;
  return instrument.sections.filter((section) => holds(section.when, { answers, owner, scope: section.code }));
}

// The codes of the offered sections marked 1, 2 or 3 in the self-screen, in instrument order.
export function selectedSections(instrument, state) {
  const marks = merged(state)[SCREENER] || {};
  return offeredSections(instrument, state)
    .filter((section) => SPEAKS_TO.includes(marks[section.code]))
    .map((section) => section.code);
}

// The screens for this person, in the order they are asked.
export function buildFlow(instrument, state, { maxQuestionsPerScreen = 4, requiredPrompts = 1 } = {}) {
  const screens = [
    welcomeScreen(),
    ...startScreens(instrument, state, maxQuestionsPerScreen),
    ...chosenSectionScreens(instrument, state, maxQuestionsPerScreen),
    endScreen()
  ];
  return settlePrompts(instrument, screens, requiredPrompts);
}

// The question objects of a questions screen whose conditions hold now.
export function visibleQuestions(instrument, screen, state) {
  const ctx = { answers: merged(state), owner: state.company.owner, scope: screen.scope };
  return screen.questions.map((id) => getQuestion(instrument, id)).filter((question) => holds(question.when, ctx));
}

// True when the screen holds everything it needs for the person to move on.
export function isScreenComplete(instrument, screen, state, { minPromptLength = 20 } = {}) {
  const answers = merged(state);
  const at = (id) => answers[resolveKey(id, screen.scope)];
  switch (screen.kind) {
    case 'welcome':
    case 'intro':
    case 'end':
      return state.done[screen.id] === true;
    case 'questions':
      return visibleQuestions(instrument, screen, state).every((question) => question.optional || answeredInFull(question, at(question.id)));
    case 'screener':
      return selectedSections(instrument, state).length > 0;
    case 'jobs':
      return getSection(instrument, screen.section).jobs.every((job) => jobDone(job, answers));
    case 'back':
      return isSettled(at('STD.BACK')) && (!holds(PICKED_A_JOB, { answers, scope: screen.scope }) || isSettled(at('STD.BACK.b')));
    case 'result':
      return isSettled(at('STD.RESULT'));
    case 'prompt':
      return !screen.required || longEnough(answers[screen.prompt], minPromptLength);
    case 'tools':
      return getSection(instrument, screen.section).tools.every((tool) => toolDone(`${screen.section}:${tool.id}`, answers));
    default:
      return false;
  }
}

// The index of the first screen that is not complete, or of the last screen when every one is.
export function firstIncomplete(instrument, flow, state) {
  const index = flow.findIndex((screen) => !isScreenComplete(instrument, screen, state));
  return index === -1 ? flow.length - 1 : index;
}

// The progress rail: one item for each run of screens that share a rail key.
export function railItems(flow) {
  const items = [];
  flow.forEach((screen, index) => {
    const item = items.at(-1);
    if (item && item.key === screen.railKey) item.last = index;
    else items.push({ key: screen.railKey, label: screen.railLabel, group: screen.group, first: index, last: index });
  });
  return items;
}

function welcomeScreen() {
  return { id: 'welcome', kind: 'welcome', group: 'Start', ...START_RAIL['About you'], title: TITLES.welcome, seconds: SECONDS.welcome };
}

function endScreen() {
  return { id: 'end', kind: 'end', group: 'Finish', railKey: 'end', railLabel: 'Finish', title: TITLES.end, seconds: SECONDS.end };
}

// About you; the company profile for whoever starts; the self-screen; then the other core blocks.
function startScreens(instrument, state, max) {
  const named = (name) => instrument.core.find((block) => block.block === name);
  const you = named('About you');
  const company = named('About your company');
  const screener = instrument.core.find((block) => block.kind === 'screener');
  const rest = instrument.core.filter((block) => ![you, company, screener].includes(block));
  return [
    ...coreScreens(instrument, you, max),
    ...(state.company.owner ? coreScreens(instrument, company, max) : []),
    screenerScreen(instrument, screener),
    ...rest.flatMap((block) => coreScreens(instrument, block, max))
  ];
}

function coreScreens(instrument, block, max) {
  return questionScreens(instrument, 'core', block, { group: 'Start', ...START_RAIL[block.block] }, max);
}

function screenerScreen(instrument, block) {
  const seconds = getQuestion(instrument, SCREENER).seconds;
  return { id: 'screener', kind: 'screener', group: 'Start', ...START_RAIL[block.block], title: block.block, seconds };
}

// Each chosen section, followed by the block for its job of marketing after the last chosen section there.
function chosenSectionScreens(instrument, state, max) {
  const chosen = selectedSections(instrument, state).map((code) => getSection(instrument, code));
  const lastOfModule = new Map(chosen.map((section) => [section.module, section.code]));
  const withBlock = new Set(chosen.filter((section) => section.full).map((section) => section.module));
  return chosen.flatMap((section) => {
    const screens = sectionScreens(instrument, section, max);
    const closesModule = lastOfModule.get(section.module) === section.code && withBlock.has(section.module);
    return closesModule ? [...screens, ...blockScreens(instrument, getModule(instrument, section.module))] : screens;
  });
}

function sectionScreens(instrument, section, max) {
  const place = {
    group: getModule(instrument, section.module).name,
    railKey: section.code,
    railLabel: section.name,
    section: section.code,
    module: section.module,
    scope: section.code
  };
  const intro = { id: `${section.code}:intro`, kind: 'intro', ...place, title: section.name, seconds: SECONDS.intro };
  return [intro, ...section.screens.flatMap((screen) => sectionPart(instrument, section, screen, place, max))];
}

function sectionPart(instrument, section, screen, place, max) {
  const fixed = (kind, seconds, extra = {}) => [{ id: `${section.code}:${kind}`, kind, ...place, title: TITLES[kind], seconds, ...extra }];
  switch (screen.kind) {
    case 'jobs': return fixed('jobs', SECONDS.perJob * section.jobs.length);
    case 'back': return fixed('back', SECONDS.back);
    case 'result': return fixed('result', SECONDS.result);
    case 'prompt': return fixed('prompt', 0, { prompt: screen.prompt, required: false });
    case 'tools': return fixed('tools', SECONDS.perTool * section.tools.length);
    case 'questions': return questionScreens(instrument, `${section.code}:q`, screen, place, max);
    default: return [];
  }
}

// The three screens of the block for a job of marketing, with CHECK replaced by the module's own check.
function blockScreens(instrument, module) {
  const place = { group: module.name, railKey: `${module.code}:block`, railLabel: BLOCK_LABEL, module: module.code, scope: module.code };
  return instrument.module_block.map((block) => {
    const questions = block.questions.map((id) => (id === 'CHECK' ? module.check : id)).filter(Boolean);
    const seconds = secondsOf(instrument, questions);
    return { id: `${module.code}:block:${slug(block.block)}`, kind: 'questions', ...place, title: block.block, seconds, questions };
  });
}

// One screen per page of a block of questions.
function questionScreens(instrument, idPrefix, block, place, max) {
  return paginate(instrument, block.questions, max).map((questions, i) => ({
    id: `${idPrefix}:${slug(block.block)}:${i + 1}`,
    kind: 'questions',
    ...place,
    title: block.block,
    seconds: secondsOf(instrument, questions),
    questions
  }));
}

// Pages of at most `max` questions. A follow-up stays with the question it follows and does not count.
function paginate(instrument, ids, max) {
  const standalone = ids.filter((id) => leadOf(instrument, id, ids) === undefined);
  const pageOf = new Map(standalone.map((id, i) => [id, Math.floor(i / max)]));
  const pageFor = (id) => (pageOf.has(id) ? pageOf.get(id) : pageFor(leadOf(instrument, id, ids)));
  const pages = Array.from({ length: Math.ceil(standalone.length / max) }, () => []);
  for (const id of ids) pages[pageFor(id)].push(id);
  return pages;
}

// The other question in the same block that this question's condition points at, if any.
function leadOf(instrument, id, ids) {
  const clause = (getQuestion(instrument, id).when || []).find((c) => c.q !== undefined && c.q !== id && ids.includes(c.q));
  return clause?.q;
}

// The first `requiredPrompts` prompt screens are required and timed; the others are optional.
function settlePrompts(instrument, screens, requiredPrompts) {
  let count = 0;
  return screens.map((screen) => {
    if (screen.kind !== 'prompt') return screen;
    count += 1;
    const required = count <= requiredPrompts;
    return { ...screen, required, seconds: required ? instrument.timing.prompt : 0 };
  });
}

function secondsOf(instrument, ids) {
  return ids.reduce((total, id) => total + getQuestion(instrument, id).seconds, 0);
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// Settled, and for some types complete: every grid row, a split of 100, a main choice among several.
function answeredInFull(question, value) {
  if (isSkipped(value)) return true;
  if (!hasValue(value)) return false;
  if (question.type === 'grid') return question.rows.every((row, i) => hasValue(value[i + 1]));
  if (question.type === 'split') return value.reduce((total, n) => total + (Number(n) || 0), 0) === 100;
  if (question.type === 'multi_main') return value.selected.length === 1 || Number.isInteger(value.main);
  return true;
}

// How the job gets done, and the right amount of AI where how is 2 to 6.
function jobDone(job, answers) {
  const how = answers[`${job.id}:how`];
  return isSettled(how) && (!FIT_ASKED.includes(how) || isSettled(answers[`${job.id}:fit`]));
}

// An answer for the tool category, and the card questions when a tool was named.
function toolDone(scope, answers) {
  const name = answers[`${scope}:name`];
  return isSettled(name) && (name.kind !== 'tool' || CARD.every((id) => isSettled(answers[resolveKey(id, scope)])));
}

function longEnough(text, min) {
  return typeof text === 'string' && text.trim().length >= min;
}
