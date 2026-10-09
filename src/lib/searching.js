// Query compilation and search/replace helpers for the editor list.
// Supports literal text or regex, case sensitivity, whole-word matching,
// space-preserving queries by default, and case-preserving replacement.

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isWordChar = (ch) => /^[\p{L}\p{N}_]$/u.test(ch);

const UNICODE_WORD_CHAR = "[\\p{L}\\p{N}_]";
const ASCII_WORD_CHAR = "[A-Za-z0-9_]";

const wrapWholeWord = (pattern, rawQuery, wordChar, isRegex) => {
  if (isRegex) {
    return `(?<!${wordChar})(?:${pattern})(?!${wordChar})`;
  }
  if (!rawQuery) return pattern;
  let res = pattern;
  if (isWordChar(rawQuery[0])) res = `(?<!${wordChar})${res}`;
  if (isWordChar(rawQuery[rawQuery.length - 1])) res = `${res}(?!${wordChar})`;
  return res;
};

const buildPattern = (query, { regex, wholeWord }, wordChar) => {
  const base = regex ? query : escapeRegExp(query);
  return wholeWord ? wrapWholeWord(base, query, wordChar, regex) : base;
};

// Unicode word boundaries need \p{...}, which is only legal under the `u` flag —
// and `u` also rejects legacy-but-valid patterns such as `a{` or `\-`. Compiling
// those with Unicode boundaries first and falling back to ASCII ones keeps the
// whole-word toggle from invalidating a regex that already worked without it.
const buildMatcher = (query, options, baseFlags) => {
  if (options.wholeWord) {
    try {
      return new RegExp(buildPattern(query, options, UNICODE_WORD_CHAR), `${baseFlags}u`);
    } catch {
      // Retry below with boundaries that do not require the `u` flag.
    }
  }
  return new RegExp(buildPattern(query, options, ASCII_WORD_CHAR), baseFlags);
};

// Returns { re, error }. Empty query ("" or null) → { re: null, error: null } (match all).
// Spaces are preserved by default.
// Invalid regex → { re: null, error: message } (match none, show error state).
export const compileQuery = (
  query,
  { regex = false, caseSensitive = false, wholeWord = false } = {}
) => {
  if (query == null || query === "") return { re: null, error: null };
  try {
    const re = buildMatcher(query, { regex, wholeWord }, caseSensitive ? "" : "i");
    return { re, error: null };
  } catch (error) {
    return { re: null, error: error.message };
  }
};

// True when a keydown event is the "find" shortcut (Ctrl/Cmd + F). Matches by
// physical key (e.code) so it works on non-Latin layouts (e.g. Ukrainian,
// where e.key is "а"), with an e.key fallback for non-QWERTY Latin layouts
// like Dvorak.
export const isFindShortcut = (e) =>
  (e.ctrlKey || e.metaKey) && (e.code === "KeyF" || e.key.toLowerCase() === "f");

// True when a keydown event is the "search selection in reference" shortcut
// (Ctrl/Cmd + D). Same physical-key matching as isFindShortcut.
export const isReferenceSearchShortcut = (e) =>
  (e.ctrlKey || e.metaKey) &&
  !e.shiftKey &&
  !e.altKey &&
  (e.code === "KeyD" || e.key.toLowerCase() === "d");

export const itemMatches = (item, re) =>
  re.test(item.key) || re.test(String(item.original)) || re.test(item.translated);

export const translationMatches = (item, re) => re.test(item.translated);

// `$12` against a single-group pattern means "group 1 followed by 2" — the
// engine drops trailing digits until the reference resolves. Returns null when
// no prefix names a real group, so the caller can emit the token literally.
const expandGroupNumber = (token, args, numGroups) => {
  for (let len = token.length; len > 0; len -= 1) {
    const num = parseInt(token.slice(0, len), 10);
    if (num > 0 && num <= numGroups) {
      return (args[num] ?? "") + token.slice(len);
    }
  }
  return null;
};

export const applyCase = (match, replacement) => {
  if (!match || !replacement) return replacement;
  const isUpper = match === match.toUpperCase() && match !== match.toLowerCase();
  if (isUpper) return replacement.toUpperCase();
  // Capitals the user typed into the replacement are deliberate (proper nouns,
  // acronyms), so a lower-cased match leaves them alone.
  const replacementIsCased = /\p{Lu}/u.test(replacement);
  const isLower = match === match.toLowerCase() && match !== match.toUpperCase();
  if (isLower) return replacementIsCased ? replacement : replacement.toLowerCase();
  const firstMatch = match[0];
  const restMatch = match.slice(1);
  const isTitle =
    firstMatch === firstMatch.toUpperCase() &&
    firstMatch !== firstMatch.toLowerCase() &&
    restMatch === restMatch.toLowerCase();
  // Only the first character is forced; the rest keeps whatever casing the user
  // typed, so proper nouns in a multi-word replacement survive.
  if (isTitle) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
};

// Replace occurrences of the query inside a translation.
// Supports caseSensitive, wholeWord, preserveCase, and regex.
export const replaceInTranslation = (
  text,
  query,
  replacement,
  { regex = false, caseSensitive = false, wholeWord = false, preserveCase = false } = {}
) => {
  if (query == null || query === "") return text;
  let re;
  try {
    re = buildMatcher(query, { regex, wholeWord }, caseSensitive ? "g" : "gi");
  } catch {
    return text;
  }

  if (preserveCase) {
    if (regex) {
      return text.replace(re, (...args) => {
        const match = args[0];
        const hasNamed =
          typeof args[args.length - 1] === "object" && args[args.length - 1] !== null;
        const groupsObj = hasNamed ? args[args.length - 1] : undefined;
        const fullStr = hasNamed ? args[args.length - 2] : args[args.length - 1];
        const offset = hasNamed ? args[args.length - 3] : args[args.length - 2];
        const numGroups = hasNamed ? args.length - 4 : args.length - 3;

        const substituted = replacement.replace(
          /\$([$&`']|\d+|<([^>]+)>)/g,
          (m, token, groupName) => {
            if (token === "$") return "$";
            if (token === "&") return match;
            if (token === "`") return fullStr.slice(0, offset);
            if (token === "'") return fullStr.slice(offset + match.length);
            if (groupName) {
              return groupsObj && groupName in groupsObj ? groupsObj[groupName] ?? "" : m;
            }
            return expandGroupNumber(token, args, numGroups) ?? m;
          }
        );
        return applyCase(match, substituted);
      });
    }
    return text.replace(re, (match) => applyCase(match, replacement));
  }

  return regex ? text.replace(re, replacement) : text.replace(re, () => replacement);
};

// Splits text into chunks with `isMatch: boolean` flags for UI search highlighting.
export const splitMatches = (text, queryRe) => {
  if (!text || !queryRe) {
    return [{ text: text ?? "", isMatch: false }];
  }

  const str = String(text);
  const flags = queryRe.flags.includes("g") ? queryRe.flags : `${queryRe.flags}g`;
  let re;
  try {
    re = new RegExp(queryRe.source, flags);
  } catch {
    return [{ text: str, isMatch: false }];
  }

  const chunks = [];
  let lastIndex = 0;
  let match;

  while ((match = re.exec(str)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({
        text: str.slice(lastIndex, match.index),
        isMatch: false,
      });
    }
    const matchedText = match[0];
    if (matchedText.length > 0) {
      chunks.push({
        text: matchedText,
        isMatch: true,
      });
      lastIndex = match.index + matchedText.length;
    } else {
      // Avoid infinite loop on zero-length matches
      re.lastIndex++;
    }
  }

  if (lastIndex < str.length) {
    chunks.push({
      text: str.slice(lastIndex),
      isMatch: false,
    });
  }

  return chunks.length > 0 ? chunks : [{ text: str, isMatch: false }];
};

