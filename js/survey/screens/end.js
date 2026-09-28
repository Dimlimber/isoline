// The finish. For now only a thank you; a later task adds the rest.
import { frame } from './frame.js';

export function render(screen, app) {
  return frame(screen, app, { kicker: 'Finish', title: 'Thank you', lead: 'Your answers are saved.', continueLabel: null });
}
