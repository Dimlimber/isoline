// A screen of questions. A follow-up shows only while its condition holds; when it hides, its answer is removed.
import { getQuestion } from '../lookup.js';
import { resolveKey } from '../conditions.js';
import { visibleQuestions } from '../flow.js';
import { renderField } from '../fields/index.js';
import { forget } from '../fields/field.js';
import { frame } from './frame.js';

export function render(screen, app) {
  const { instrument, store } = app;
  // The fields report changes to this app, which settles the follow-ups before the real app hears of it.
  const local = Object.create(app, { changed: { value: () => { settle(); app.changed(); } } });
  const fields = screen.questions.map((id) => {
    const question = getQuestion(instrument, id);
    const ctx = { app: local, key: resolveKey(id, screen.scope), scope: screen.scope, required: !question.optional };
    return { question, ctx, el: renderField(question, ctx) };
  });
  const visible = () => new Set(visibleQuestions(instrument, screen, store.state).map((question) => question.id));
  const shown = visible();
  for (const field of fields) field.el.hidden = !shown.has(field.question.id);

  const kicker = screen.group === screen.railLabel ? screen.group : `${screen.group} · ${screen.railLabel}`;
  return frame(screen, app, { kicker, title: screen.title, body: fields.map((field) => field.el) });

  // Shows the questions whose conditions hold. A question that hides loses its answer, and is drawn
  // again empty so that it shows no stale answer if it comes back.
  function settle() {
    const now = visible();
    for (const field of fields) {
      const hide = !now.has(field.question.id);
      if (hide && !field.el.hidden) {
        forget(field.question, field.ctx);
        const fresh = renderField(field.question, field.ctx);
        field.el.replaceWith(fresh);
        field.el = fresh;
      }
      field.el.hidden = hide;
    }
  }
}
