// Query compilation and search/replace helpers for the editor list.
// Supports literal text or regex, case sensitivity, whole-word matching,
// space-preserving queries by default, and case-preserving replacement.

import { bookRowLabel, isBookKey } from "./patchouli";
import { isTranslatable } from "./translations";

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

// A book row's key is a long internal path; its visible label is what users search.
export const itemMatches = (item, re) =>
  re.test(isBookKey(item.key) ? bookRowLabel(item.key) : item.key) || re.test(String(item.original)) || re.test(item.translated);

export const translationMatches = (item, re) => re.test(item.translated);

// Native $n rules: two digits name a group when that group exists, else the
// first digit alone does (so `$12` with one group is group 1 then "2"), and
// `$0`/`$00` never do. Returns null when neither form names a real group, so
// the caller emits the reference literally.
const expandGroupNumber = (digits, groups) => {
  const twoDigit = digits.length === 2 ? Number(digits) : 0;
  if (twoDigit >= 1 && twoDigit <= groups.length) return groups[twoDigit - 1] ?? "";
  const oneDigit = Number(digits[0]);
  if (oneDigit >= 1 && oneDigit <= groups.length) return (groups[oneDigit - 1] ?? "") + digits.slice(1);
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

// Case operators in a regex replacement, as in sed/Perl: \\U, \\L switch the
// following text to upper/lower case until \\E; \\u, \\l change one letter.
// A doubled backslash stays a literal backslash.
const CASE_OPERATOR = /\\([ULEul\\])/g;

const applyCaseOperators = (text) => {
  let mode = null;
  let nextLetter = null;
  let out = "";
  let last = 0;
  const emit = (chunk) => {
    if (!chunk) return;
    let cased = mode === "U" ? chunk.toUpperCase() : mode === "L" ? chunk.toLowerCase() : chunk;
    if (nextLetter) {
      const first = [...cased][0];
      cased =
        (nextLetter === "u" ? first.toUpperCase() : first.toLowerCase()) +
        cased.slice(first.length);
      nextLetter = null;
    }
    out += cased;
  };
  for (const m of text.matchAll(CASE_OPERATOR)) {
    emit(text.slice(last, m.index));
    last = m.index + m[0].length;
    const op = m[1];
    if (op === "\\") emit("\\");
    else if (op === "U" || op === "L") mode = op;
    else if (op === "E") mode = null;
    else nextLetter = op;
  }
  emit(text.slice(last));
  return out;
};

const HAS_CASE_OPERATOR = /\\[ULEul]/;

// A String#replace callback receives (match, ...groups, offset, string[, namedGroups]).
const replaceArgs = (args) => {
  const hasNamed = typeof args[args.length - 1] === "object" && args[args.length - 1] !== null;
  const tail = hasNamed ? 3 : 2;
  return {
    match: args[0],
    groups: args.slice(1, args.length - tail),
    offset: args[args.length - tail],
    fullStr: args[args.length - tail + 1],
    namedGroups: hasNamed ? args[args.length - 1] : undefined,
  };
};

const expandReplacement = (args, replacement) => {
  const { match, groups, offset, fullStr, namedGroups } = replaceArgs(args);
  const expanded = replacement.replace(/\$([$&`']|\d\d?|<([^>]*)>)/g, (m, token, groupName) => {
    if (token === "$") return "$";
    if (token === "&") return match;
    if (token === "`") return fullStr.slice(0, offset);
    if (token === "'") return fullStr.slice(offset + match.length);
    // Without named groups `$<name>` is literal; with them an unknown name is empty.
    if (groupName !== undefined) return namedGroups ? namedGroups[groupName] ?? "" : m;
    return expandGroupNumber(token, groups) ?? m;
  });
  return HAS_CASE_OPERATOR.test(replacement) ? applyCaseOperators(expanded) : expanded;
};

const compileReplacer = (
  query,
  replacement,
  { regex = false, caseSensitive = false, wholeWord = false, preserveCase = false } = {}
) => {
  if (query == null || query === "") return null;
  let re;
  try {
    re = buildMatcher(query, { regex, wholeWord }, caseSensitive ? "g" : "gi");
  } catch {
    return null;
  }
  const replaceMatch = (...args) => {
    const substituted = regex ? expandReplacement(args, replacement) : replacement;
    return preserveCase ? applyCase(args[0], substituted) : substituted;
  };
  return { re, replaceMatch };
};

const replaceWith = (replacer, text) => text.replace(replacer.re, replacer.replaceMatch);

// The result plus where each replacement landed in it: `changes` holds
// [from, to) in the new text and the source fragment it replaced (from === to
// for a deletion). Matches the replacement leaves as they were are not changes.
const previewWith = (replacer, text) => {
  const changes = [];
  let out = "";
  let last = 0;
  text.replace(replacer.re, (...args) => {
    const { match, offset } = replaceArgs(args);
    const replaced = replacer.replaceMatch(...args);
    out += text.slice(last, offset);
    if (replaced !== match) changes.push({ from: out.length, to: out.length + replaced.length, original: match });
    out += replaced;
    last = offset + match.length;
    return replaced;
  });
  out += text.slice(last);
  return changes.length > 0 && out !== text ? { text: out, changes } : null;
};

// Replace occurrences of the query inside a translation.
// Supports caseSensitive, wholeWord, preserveCase, and regex.
export const replaceInTranslation = (text, query, replacement, options) => {
  const replacer = compileReplacer(query, replacement, options);
  return replacer ? replaceWith(replacer, text) : text;
};

// What replaceInTranslation would make of the text, located for highlighting.
// Null when the replacement would leave the text unchanged.
export const previewReplacement = (text, query, replacement, options) => {
  const replacer = compileReplacer(query, replacement, options);
  return replacer ? previewWith(replacer, text) : null;
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


// The pinned row is shown only to keep it in view; bulk actions leave it out.
const bulkRows = (rows) => rows.filter((row) => !row.pinned);

// "Replace all": the new translation of every row the replacement changes.
export const planReplaceAll = (rows, query, replacement, options) => {
  const edits = new Map();
  const replacer = compileReplacer(query, replacement, options);
  if (!replacer) return edits;
  for (const row of bulkRows(rows)) {
    const replaced = replaceWith(replacer, row.translated);
    if (replaced !== row.translated) edits.set(row.key, replaced);
  }
  return edits;
};

// Spacer rows (blank original) are never translated, so they are never filled.
export const isFillable = (row) => isTranslatable(row) && !row.translated.trim();

// "Fill from original": runs the replacement over the source text of empty
// rows, as if each had been pre-filled with its original. Rows the
// replacement leaves untouched stay empty rather than receiving untranslated
// source text.
export const planOriginalFill = (rows, query, replacement, options) => {
  const fills = new Map();
  const replacer = compileReplacer(query, replacement, options);
  if (!replacer) return fills;
  for (const row of bulkRows(rows)) {
    if (!isFillable(row)) continue;
    const original = String(row.original);
    const filled = replaceWith(replacer, original);
    if (filled !== original) fills.set(row.key, filled);
  }
  return fills;
};
