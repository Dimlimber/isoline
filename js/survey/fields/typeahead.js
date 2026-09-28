// A box that offers names as the person types, following the combobox pattern. Focus stays in the box:
// the arrow keys move a highlight through the list, and aria-activedescendant tells a screen reader which name it is on.
// While the first name starts with the text in the box it is highlighted, so a few letters and Enter are enough.
// Otherwise nothing is highlighted, and Enter takes the typed text.
import { h } from '../dom.js';
import { leadsWith, takenName } from '../suggest.js';

// label names the box and its list, and is drawn visually hidden. It names the box even inside a field whose own label
// also points at the box, so a screen reader hears it once. suggest(text) returns the names to offer. onPick(name) is
// called with the chosen or typed name, once the box is empty and the list closed.
// The element returned has a method take(), which the screen calls as it is left, so that a name typed but not picked
// is not lost. Leaving the box does not take the name: the card would grow at once, and the press that left the box
// would land on whatever moved under the pointer.
export function createTypeahead({ id, label, placeholder = 'Type a name', suggest, onPick }) {
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const input = h('input', {
    class: 'input', id, type: 'text', maxlength: '200', autocomplete: 'off', placeholder,
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-labelledby': labelId
  });
  // The list never takes focus. Without tabindex, a browser can make a list long enough to scroll a stop for Tab,
  // and Tab would then land on the list just as the box's blur hides it.
  const list = h('ul', { class: 'ta__list', id: listId, role: 'listbox', 'aria-labelledby': labelId, tabindex: '-1', hidden: true });
  let names = [];
  let active = -1;

  input.addEventListener('focus', open);
  input.addEventListener('input', open);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', onKey);
  // A press on the list leaves focus in the box, so the list is still open when the press ends in a pick.
  list.addEventListener('mousedown', (event) => event.preventDefault());

  const el = h('div', { class: 'ta' }, h('label', { class: 'visually-hidden', id: labelId, for: id }, label), input, list);
  el.take = take;
  return el;

  // Offers the names for the text in the box. The first name is highlighted only when it starts with that text.
  function open() {
    names = suggest(input.value);
    list.replaceChildren(...names.map((name, i) => h('li', {
      class: 'ta__opt', id: optionId(i), role: 'option', 'aria-selected': 'false', onClick: () => pick(name)
    }, name)));
    list.hidden = names.length === 0;
    input.setAttribute('aria-expanded', String(!list.hidden));
    highlight(leadsWith(names, input.value) ? 0 : -1);
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    highlight(-1);
  }

  // Highlights the name at index i, or none at -1.
  function highlight(i) {
    active = i >= 0 && i < names.length ? i : -1;
    for (const [j, option] of [...list.children].entries()) option.setAttribute('aria-selected', String(j === active));
    if (active === -1) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    input.setAttribute('aria-activedescendant', optionId(active));
    list.children[active].scrollIntoView({ block: 'nearest' });
  }

  function pick(name) {
    close();
    input.value = '';
    onPick(name);
  }

  // Takes the typed text as Enter does with nothing highlighted, in the listed spelling of an offered name equal to it
  // without regard to case. With an empty box it does nothing.
  function take() {
    const name = takenName(input.value, suggest(input.value));
    if (name) pick(name);
  }

  // Down and Up step through the names and back to the typed text, and open a closed list.
  // Enter picks; Escape closes. Ctrl+Enter and Cmd+Enter are left to the survey, where they mean Continue.
  function onKey(event) {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const down = event.key === 'ArrowDown';
      if (list.hidden) {
        open();
        highlight(down ? 0 : names.length - 1);
        return;
      }
      // The positions run from -1, the typed text, to the last name, and wrap round.
      const places = names.length + 1;
      highlight(((active + 1 + (down ? 1 : places - 1)) % places) - 1);
    } else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      const name = active === -1 ? input.value.trim() : names[active];
      if (!name) return;
      event.preventDefault();
      pick(name);
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      close();
    }
  }

  function optionId(i) {
    return `${id}-opt-${i}`;
  }
}
