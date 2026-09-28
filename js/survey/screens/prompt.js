// Walk us through: one open prompt, answered in a few sentences and stored at the prompt's id.
// The first prompt in the survey is required and the rest are not. Neither has a skip control:
// a required prompt is settled by writing, and an optional one may be left empty.
import { renderField } from '../fields/index.js';
import { frame } from './frame.js';

const HELP = 'A few sentences are enough. Say what would really happen: who does what, with what data and which tools.';
const MAY_STAY_EMPTY = 'You can leave this one empty.';

export function render(screen, app) {
  const prompt = app.instrument.prompts[screen.prompt];
  const question = { id: prompt.id, type: 'longtext', text: prompt.text, help: screen.required ? HELP : `${HELP} ${MAY_STAY_EMPTY}` };
  return frame(screen, app, {
    kicker: `${screen.group} · ${screen.railLabel}`,
    title: 'Walk us through',
    body: renderField(question, { app, key: prompt.id, scope: screen.scope, required: false })
  });
}
