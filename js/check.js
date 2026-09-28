// Stops the survey in a browser too old for it, before the survey's modules run. In place of the page's main content
// it puts a sentence saying so, and marks the page so that the modules do nothing. A classic script, written for the
// old browsers it has to catch: no let or const, no arrow functions, no newer methods.
(function () {
  var fits = typeof Object.hasOwn === 'function'
    && typeof Array.prototype.at === 'function'
    && 'inert' in HTMLElement.prototype
    && typeof window.CSS === 'object' && typeof window.CSS.supports === 'function'
    && window.CSS.supports('selector(:has(*))');
  if (fits) return;
  document.documentElement.setAttribute('data-old-browser', '');
  var holder = document.querySelector('main') || document.getElementById('app');
  if (!holder) return;
  while (holder.firstChild) holder.removeChild(holder.firstChild);
  var note = document.createElement('p');
  // The survey page's holder spans the window, so the sentence keeps to the page's margins itself.
  note.className = (' ' + holder.className + ' ').indexOf(' wrap ') === -1 ? 'wrap page-note' : 'page-note';
  note.appendChild(document.createTextNode('This browser is too old for the survey. Use a current version of Chrome, Edge, Firefox or Safari.'));
  holder.appendChild(note);
}());
