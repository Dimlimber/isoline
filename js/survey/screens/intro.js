// The start of a section: its job of marketing, its name, what it covers and how long it takes.
import { h } from '../dom.js';
import { getModule, getSection } from '../lookup.js';
import { minutes } from '../timing.js';
import { frame } from './frame.js';

export function render(screen, app) {
  const { instrument, store } = app;
  const section = getSection(instrument, screen.section);
  const n = minutes(section.seconds);
  const about = `About ${n} ${n === 1 ? 'minute' : 'minutes'}.`;
  const view = frame(screen, app, {
    kicker: getModule(instrument, section.module).name,
    title: section.name,
    lead: section.intro,
    body: h('p', { class: 'note' }, section.full ? `${about} First how the work gets done, then a few facts and results. Tools come last.` : about),
    continueLabel: 'Start this section'
  });
  view.querySelector('.screen__nav').append(h('button', { class: 'btn btn--quiet', type: 'button', onClick: leaveOut }, 'Leave this section out'));
  return view;

  // Marks the section Not me in the self-screen. The section then leaves the flow, and changed() moves on to the
  // screen now at this place, or to the first screen not yet complete when that comes earlier.
  function leaveOut() {
    store.set('CORE.14', { ...store.get('CORE.14'), [section.code]: 4 });
    app.changed();
  }
}
