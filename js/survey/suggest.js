// The names to offer for what a person has typed. Pure: no DOM.

// Up to `limit` names, compared without regard to case. A blank query offers the first names of `primary`.
// Otherwise, without repeats: names in `primary` that start with the query, then names in `primary` that contain it,
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
  const starts = (low) => low.startsWith(q);
  const contains = (low) => low.includes(q);
  take(primary, starts);
  take(primary, contains);
  take(secondary, starts);
  take(secondary, contains);
  return found;
}
