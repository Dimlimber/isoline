// Results: what has happened to results in this part of marketing over the past 12 months.
// The standard question is drawn as a screen of one question in the section's scope, with the usual skip control.
import * as questions from './questions.js';

export function render(screen, app) {
  const { result } = app.instrument.standard;
  return questions.render({ ...screen, title: 'Results', questions: [result.id] }, app);
}
