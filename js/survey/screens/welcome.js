// Before you start: who the person is answering for, and five ground rules.
import { h } from '../dom.js';
import { frame } from './frame.js';

const RULES = [
  'There are no right answers. Nothing here is marked as better or worse, and more AI is not the goal.',
  'Answer for how things are today, not how they are meant to be.',
  'If you do not know, say so. You can also skip any question.',
  'Nobody at your company sees who said what.',
  'Your answers save as you go. You can stop and come back on this device.'
];

export function render(screen, app) {
  const { name } = app.store.state.company;
  return frame(screen, app, {
    kicker: name ? `You are answering for ${name}` : 'You are answering for your company',
    title: 'Before you start',
    lead: 'Five things to know.',
    body: h('ol', { class: 'rules' }, RULES.map((rule) => h('li', {}, rule))),
    continueLabel: 'Begin'
  });
}
