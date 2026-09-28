// How long the survey takes. Pure: no DOM, no storage.
import { getSection } from './lookup.js';

// Whole minutes, rounded up, and never less than one.
export function minutes(seconds) {
  return Math.max(1, Math.ceil(seconds / 60));
}

// The estimated seconds for the core, the profile, these sections, their blocks and the required prompts.
export function secondsFor(instrument, sectionCodes, { owner = false, prompts = 1 } = {}) {
  const t = instrument.timing;
  const sections = sectionCodes.map((code) => getSection(instrument, code));
  const blocks = new Set(sections.filter((section) => section.full).map((section) => section.module)).size;
  const promptScreens = sections.filter((section) => section.screens.some((screen) => screen.kind === 'prompt')).length;
  const own = sections.reduce((total, section) => total + section.seconds, 0);
  return t.core + (owner ? t.profile : 0) + own + blocks * t.module_block + Math.min(prompts, promptScreens) * t.prompt;
}

// The seconds left: the sum over the screens not yet done.
export function remainingSeconds(flow, done) {
  return flow.reduce((total, screen) => (done[screen.id] ? total : total + screen.seconds), 0);
}
