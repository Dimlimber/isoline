// A link to the start page for this company, offered on the self-screen and at the finish, and the company code.
// The link carries the facts that decide what colleagues are asked, after the # so that browsers never send it to a server.
import { h } from '../dom.js';
import { encodeInvite, pickFacts } from '../company.js';
import { merged } from '../flow.js';

const COPIED_FOR = 2000;
const REFUSED = 'The link is selected. Copy it with your keyboard.';

// text is what the screen says above the link.
export function invite(app, text) {
  const { state } = app.store;
  const { code, name } = state.company;
  const fragment = encodeInvite({ code, name, facts: pickFacts(merged(state)) });
  const link = new URL(`start.html#${fragment}`, window.location.href).href;
  const field = h('input', { class: 'input', type: 'text', readonly: true, value: link, 'aria-labelledby': 'invite-title' });
  const button = h('button', { class: 'btn', type: 'button', onClick: copy }, 'Copy link');
  // The button's new words are seen; this hidden line has a screen reader say them too, or say that the copy was refused.
  const status = h('span', { class: 'visually-hidden', role: 'status' });
  let timer = 0;
  return h('section', { class: 'end__part' },
    h('h2', { class: 'h3', id: 'invite-title' }, 'Invite colleagues'),
    h('p', {}, text),
    field,
    button,
    status,
    h('p', { class: 'note' }, `Company code: ${code}`));

  async function copy() {
    field.select();
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // The browser did not allow it: the link stays selected, to copy with the keyboard.
      say(REFUSED);
      return;
    }
    button.textContent = 'Copied';
    say('Copied');
  }

  // Puts the words on the status line. The line empties again with the button, so that the next copy is announced too.
  function say(words) {
    status.textContent = words;
    timer = setTimeout(() => {
      button.textContent = 'Copy link';
      status.textContent = '';
    }, COPIED_FOR);
  }
}
