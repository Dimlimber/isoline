// The field for each type of question. A later task adds a type with one module and one line in FIELDS.
import { h } from '../dom.js';
import { fieldShell } from './field.js';
import * as text from './text.js';
import * as longtext from './longtext.js';
import * as single from './single.js';
import * as multi from './multi.js';
import * as multiMain from './multi_main.js';
import * as rank from './rank.js';
import * as split from './split.js';
import * as grid from './grid.js';
import * as jobsMulti from './jobs_multi.js';
import * as jobSingle from './job_single.js';

const FIELDS = { text, longtext, single, multi, multi_main: multiMain, rank, split, grid, jobs_multi: jobsMulti, job_single: jobSingle };

// The field for a question, drawn by the module for its type. ctx = { app, key, scope, required }.
export function renderField(question, ctx) {
  const field = FIELDS[question.type];
  if (field) return field.render(question, ctx);
  return fieldShell(question, ctx, h('p', { class: 'note' }, 'This kind of question is not built yet.'));
}
