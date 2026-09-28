// Cutting back: whether AI was stopped or cut back on any job of the section in the past 12 months, and why.
// The two standard questions are drawn as a screen of questions in the section's scope, so the reasons show only
// once a job is picked and lose their answer when they hide. Both keep the usual skip control.
import * as questions from './questions.js';

export function render(screen, app) {
  const { back, back_why: why } = app.instrument.standard;
  return questions.render({ ...screen, title: 'Cutting back', questions: [back.id, why.id] }, app);
}
