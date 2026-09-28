// Making and replacing elements.

// An element. Props: class, id, text, hidden and any attribute; a key starting 'on' adds an event listener
// (onClick listens for 'click'). A value of true sets an empty attribute; null, undefined and false set nothing.
// Children may be nodes, strings, arrays, null or false.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'text') el.textContent = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

// Removes everything inside the element.
export function clear(el) {
  el.replaceChildren();
}

// Replaces what is inside the element with the node.
export function mount(el, node) {
  clear(el);
  el.append(node);
}

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child);
  }
}
