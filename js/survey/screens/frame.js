// The common layout of a screen: kicker, title and lead, the body, then a row with Back and Continue.
import { h } from '../dom.js';

// continueLabel null leaves out the continue button. back false leaves out Back, which is hidden on the first screen.
export function frame(screen, app, { kicker, title = screen.title, lead, body, continueLabel = 'Continue', back = true } = {}) {
  return h('section', { class: 'screen' },
    h('div', { class: 'screen__head' },
      kicker ? h('p', { class: 'label' }, kicker) : null,
      h('h1', { class: 'h2 screen__title', tabindex: '-1' }, title),
      lead ? h('p', { class: 'lead screen__lead' }, lead) : null),
    body,
    h('div', { class: 'screen__nav' },
      back ? h('button', { class: 'btn', type: 'button', hidden: app.index === 0, onClick: () => app.back() }, 'Back') : null,
      continueLabel ? h('button', { class: 'btn btn--primary', type: 'button', onClick: () => app.next() }, continueLabel) : null));
}
