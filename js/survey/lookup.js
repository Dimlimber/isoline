// Finding things in the instrument. Pure: no DOM, no storage.

// The question with this id, from the question bank first and then the standard questions; undefined if unknown.
export function getQuestion(instrument, id) {
  if (Object.hasOwn(instrument.questions, id)) return instrument.questions[id];
  return standardList(instrument).find((question) => question.id === id);
}

// The section with this code, or undefined.
export function getSection(instrument, code) {
  return instrument.sections.find((section) => section.code === code);
}

// The module (job of marketing) with this code, or undefined.
export function getModule(instrument, code) {
  return instrument.modules.find((module) => module.code === code);
}

// The eleven standard questions, in a fixed order.
export function standardList(instrument) {
  const { ladder, fit, back, back_why: backWhy, result, roster, card } = instrument.standard;
  return [ladder, fit, back, backWhy, result, roster, ...card];
}

// The wording of a job: its sales wording for a sales-led company when it has one, else its usual text.
export function jobText(job, mainRoute) {
  return mainRoute === 'S' && job.sales ? job.sales : job.text;
}
