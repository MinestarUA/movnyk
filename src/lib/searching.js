// Query compilation and search/replace helpers for the editor list.
// A "query" is either literal text (escaped into a RegExp so matching and
// replacing share one code path) or, in regex mode, a raw user pattern.

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Returns { re, error }. Empty query → { re: null, error: null } (match all).
// Invalid regex → { re: null, error: message } (match none, show error state).
export const compileQuery = (query, { regex = false } = {}) => {
  const trimmed = query.trim();
  if (!trimmed) return { re: null, error: null };
  try {
    return { re: new RegExp(regex ? trimmed : escapeRegExp(trimmed), "i"), error: null };
  } catch (error) {
    return { re: null, error: error.message };
  }
};

export const itemMatches = (item, re) =>
  re.test(item.key) || re.test(String(item.original)) || re.test(item.translated);

export const translationMatches = (item, re) => re.test(item.translated);

// Replace every occurrence of the query inside a translation. In literal mode
// the replacement string is inserted verbatim (no $-group expansion); in regex
// mode $1-style backreferences work. Invalid patterns leave the text unchanged.
export const replaceInTranslation = (text, query, replacement, { regex = false } = {}) => {
  const trimmed = query.trim();
  if (!trimmed) return text;
  let re;
  try {
    re = new RegExp(regex ? trimmed : escapeRegExp(trimmed), "gi");
  } catch {
    return text;
  }
  return regex ? text.replace(re, replacement) : text.replace(re, () => replacement);
};
