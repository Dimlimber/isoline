// The names to offer for what a person has typed. Pure: no DOM.

// Up to `limit` names, compared without regard to case. A blank query offers the first names of `primary`.
// Otherwise, without repeats: a name equal to the query, from `primary` and then from `secondary`, so that a name typed
// in full comes first; then names in `primary` that start with the query, then names in `primary` that contain it,
// then the same two groups from `secondary`. Each group keeps the order it is given in.
export function rankSuggestions(query, primary, secondary = [], limit = 8) {
  const q = query.trim().toLowerCase();
  if (q === '') return primary.slice(0, limit);
  const found = [];
  const seen = new Set();
  const take = (names, fits) => {
    for (const name of names) {
      if (found.length >= limit) return;
      const low = name.toLowerCase();
      if (fits(low) && !seen.has(low)) {
        seen.add(low);
        found.push(name);
      }
    }
  };
  const equals = (low) => low === q;
  const starts = (low) => low.startsWith(q);
  const contains = (low) => low.includes(q);
  take(primary, equals);
  take(secondary, equals);
  take(primary, starts);
  take(primary, contains);
  take(secondary, starts);
  take(secondary, contains);
  return found;
}

// The names that are not in `leaveOut`, compared without regard to case, in the order given.
export function withoutNames(names, leaveOut) {
  const out = new Set(leaveOut.map((name) => name.toLowerCase()));
  return names.filter((name) => !out.has(name.toLowerCase()));
}

// The name taken for typed text: an offered name equal to it without regard to case, in its listed spelling,
// or else the text itself, trimmed. Blank text gives ''.
export function takenName(text, offered) {
  const typed = text.trim();
  const low = typed.toLowerCase();
  return offered.find((name) => name.toLowerCase() === low) ?? typed;
}

// True when something is typed and the first name offered starts with it, without regard to case. Only then does
// the box highlight that name on its own, so that Enter never swaps a name typed in full for a longer one.
export function leadsWith(names, text) {
  const typed = text.trim().toLowerCase();
  return typed !== '' && names.length > 0 && names[0].toLowerCase().startsWith(typed);
}
