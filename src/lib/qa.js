// Quality Assurance (QA) linter for Minecraft mod translations.
// Detects punctuation, whitespace, capitalization, missing variable/formatting tokens,
// typography slips and mixed-script typos (Latin letters inside Ukrainian words).
// Issues that have an unambiguous correction carry `fix(translated) => string`.

import { CORE_SYNTAX, extractTokens, tokenizeString } from "./tokens";

// Tokens are blanked out with same-length spaces so that "§aТекст" or "%sшт"
// are not read as words, while character indices stay aligned with the input.
const blankTokens = (text, syntax) =>
  tokenizeString(text, syntax)
    .map((part) => (part.type === "text" ? part.value : " ".repeat(part.value.length)))
    .join("");

const TRAILING_PUNCT = /(\.{3}|…|[.!?:;])$/;

// Splits "Text!  " into { body: "Text", punct: "!" }. Callers pass token-blanked
// text, so a trailing "§r" or "%s" counts as trailing whitespace.
const splitTrailing = (text) => {
  const trimmed = text.trimEnd();
  const punct = (trimmed.match(TRAILING_PUNCT) || [""])[0];
  return { body: trimmed.slice(0, trimmed.length - punct.length), punct };
};

// Replaces the trailing mark while keeping trailing tokens and whitespace.
const withTrailingPunct = (punct, syntax) => (value) => {
  const { body, punct: current } = splitTrailing(blankTokens(value, syntax));
  return value.slice(0, body.length) + punct + value.slice(body.length + current.length);
};

const normalizeEllipsis = (punct) => (punct === "..." ? "…" : punct);

const isUpper = (ch) => ch.toUpperCase() === ch && ch.toLowerCase() !== ch;

const flipFirstLetter = (value, syntax) => {
  const first = blankTokens(value, syntax).match(/\p{L}/u);
  if (!first) return value;
  // Match is a full code point, which can be two UTF-16 units (astral letters).
  const ch = first[0];
  const flipped = isUpper(ch) ? ch.toLowerCase() : ch.toUpperCase();
  return value.slice(0, first.index) + flipped + value.slice(first.index + ch.length);
};

const INNER_DOUBLE_SPACE = /(?<=\S) {2,}(?=\S)/g;
const hasInnerDoubleSpace = (text) => new RegExp(INNER_DOUBLE_SPACE.source).test(text);

// Exactly three dots; longer runs are left alone as deliberate.
const THREE_DOTS = /(?<!\.)\.{3}(?!\.)/g;
const hasThreeDots = (text) => new RegExp(THREE_DOTS.source).test(text);

const HYPHEN_AS_DASH = /(?<=\s)-(?=\s)/g;

const hasHyphenAsDash = (text) => new RegExp(HYPHEN_AS_DASH.source).test(text);

// Typographic characters outside plain ASCII that translators tend to lose.
// Quotes and apostrophes are excluded: Ukrainian typography legitimately swaps
// “” for «» and uses ʼ. Format characters (zero-width etc.) are invisible.
const SPECIAL_CHAR = /[^\p{L}\p{N}\p{M}\p{Cf}\s\x20-\x7E]/gu;
const IGNORED_CHARS = new Set(["“", "”", "‘", "’", "„", "«", "»", "‹", "›", "ʼ"]);
// Dashes are interchangeable between languages (en dash ↔ em dash).
const DASHES = ["–", "—", "−"];

const specialCharsOf = (text) => {
  const found = new Set(text.match(SPECIAL_CHAR) || []);
  return [...found].filter((ch) => !IGNORED_CHARS.has(ch));
};

const containsSpecialChar = (text, ch) => {
  if (DASHES.includes(ch)) return DASHES.some((dash) => text.includes(dash));
  if (ch === "…") return text.includes("…") || text.includes("...");
  return text.includes(ch);
};

// Counts each extension token, keyed by its value. Every syntax-code token
// belongs to an active extension, so `syntax.byId` resolves it.
const countSyntaxCodes = (text, syntax) => {
  const counts = new Map();
  for (const part of tokenizeString(text, syntax)) {
    if (part.type === "syntax-code") {
      const entry = counts.get(part.value) ?? { count: 0, extension: syntax.byId[part.syntax] };
      entry.count += 1;
      counts.set(part.value, entry);
    }
  }
  return counts;
};

// Drops the last `count` tokens equal to `code`, so the leading ones (which
// usually mirror the original's order) are kept. Works on tokens rather than
// raw text: "_" or "$s" also occur inside words and "%1$s".
const removeLastTokens = (value, code, count, syntax) => {
  const parts = tokenizeString(value, syntax);
  let left = count;
  for (let i = parts.length - 1; i >= 0 && left > 0; i -= 1) {
    if (parts[i].type === "syntax-code" && parts[i].value === code) {
      parts.splice(i, 1);
      left -= 1;
    }
  }
  return parts.map((part) => part.value).join("");
};

const syntaxCodeIssues = (origStr, transStr, syntax) => {
  const issues = [];
  const origCounts = countSyntaxCodes(origStr, syntax);
  const transCounts = countSyntaxCodes(transStr, syntax);
  for (const [code, { count, extension }] of transCounts) {
    const extra = count - (origCounts.get(code)?.count ?? 0);
    if (extra > 0 && !extension.toggles?.[code]) {
      issues.push({
        id: `extra-token-${code}`,
        message:
          extra === 1
            ? `Зайвий код ${extension.label}: ${code}`
            : `Зайвий код ${extension.label}: ${code} (×${extra})`,
        severity: "warning",
        fix: (value) => removeLastTokens(value, code, extra, syntax),
      });
    }
  }
  // An unpaired toggle marker restyles the rest of the string in game, so
  // missing ones matter as much as extra ones.
  const toggles = new Map(
    [...origCounts, ...transCounts]
      .filter(([code, { extension }]) => extension.toggles?.[code])
      .map(([code, { extension }]) => [code, extension])
  );
  for (const [code, extension] of toggles) {
    if ((origCounts.get(code)?.count ?? 0) !== (transCounts.get(code)?.count ?? 0)) {
      issues.push({
        id: `toggle-count-${code}`,
        message: `Кількість «${code}» (${extension.label}) не збігається з оригіналом`,
        severity: "warning",
      });
    }
  }
  return issues;
};

export const checkTranslationQA = (original, translated, syntax = CORE_SYNTAX) => {
  if (!original || !translated || !translated.trim()) {
    return [];
  }

  const issues = [];
  const origStr = String(original);
  const transStr = String(translated);
  const origText = blankTokens(origStr, syntax);
  const transText = blankTokens(transStr, syntax);

  // 1. Whitespace mismatch
  const origLeadWs = (origStr.match(/^\s+/) || [""])[0];
  const transLeadWs = (transStr.match(/^\s+/) || [""])[0];
  if (origLeadWs && !transLeadWs) {
    issues.push({
      id: "missing-leading-ws",
      message: "Відсутній пробіл на початку",
      severity: "warning",
      fix: (value) => origLeadWs + value,
    });
  } else if (!origLeadWs && transLeadWs) {
    issues.push({
      id: "extra-leading-ws",
      message: "Зайвий пробіл на початку",
      severity: "warning",
      fix: (value) => value.trimStart(),
    });
  }

  const origTrailWs = (origStr.match(/\s+$/) || [""])[0];
  const transTrailWs = (transStr.match(/\s+$/) || [""])[0];
  if (origTrailWs && !transTrailWs) {
    issues.push({
      id: "missing-trailing-ws",
      message: "Відсутній пробіл або перенесення рядка в кінці",
      severity: "warning",
      fix: (value) => value + origTrailWs,
    });
  } else if (!origTrailWs && transTrailWs) {
    issues.push({
      id: "extra-trailing-ws",
      message: "Зайвий пробіл або перенесення рядка в кінці",
      severity: "warning",
      fix: (value) => value.trimEnd(),
    });
  }

  // 2. Double spaces inside the text
  if (hasInnerDoubleSpace(transStr) && !hasInnerDoubleSpace(origStr)) {
    issues.push({
      id: "double-space",
      message: "Подвійний пробіл",
      severity: "warning",
      fix: (value) => value.replace(INNER_DOUBLE_SPACE, " "),
    });
  }

  // 3. Trailing punctuation mismatch ("..." and "…" count as the same mark)
  const origPunct = splitTrailing(origText).punct;
  const transPunct = splitTrailing(transText).punct;

  if (origPunct && !transPunct) {
    issues.push({
      id: "missing-trailing-punct",
      message: `Відсутній розділовий знак у кінці («${origPunct}»)`,
      severity: "warning",
      fix: withTrailingPunct(origPunct, syntax),
    });
  } else if (!origPunct && transPunct) {
    issues.push({
      id: "extra-trailing-punct",
      message: `Зайвий розділовий знак у кінці («${transPunct}»)`,
      severity: "warning",
      fix: withTrailingPunct("", syntax),
    });
  } else if (origPunct && normalizeEllipsis(origPunct) !== normalizeEllipsis(transPunct)) {
    issues.push({
      id: "mismatched-trailing-punct",
      message: `Розділовий знак у кінці («${transPunct}») не збігається з оригіналом («${origPunct}»)`,
      severity: "warning",
      fix: withTrailingPunct(origPunct, syntax),
    });
  }

  // 4. Capitalization of first letter
  const origFirst = origText.match(/\p{L}/u);
  const transFirst = transText.match(/\p{L}/u);

  if (origFirst && transFirst) {
    const origIsUpper = isUpper(origFirst[0]);
    const transIsUpper = isUpper(transFirst[0]);

    if (origIsUpper && !transIsUpper) {
      issues.push({
        id: "capitalization-should-be-upper",
        message: "Перша літера має бути великою",
        severity: "warning",
        fix: (value) => flipFirstLetter(value, syntax),
      });
    } else if (!origIsUpper && transIsUpper) {
      issues.push({
        id: "capitalization-should-be-lower",
        message: "Перша літера має бути маленькою",
        severity: "warning",
        fix: (value) => flipFirstLetter(value, syntax),
      });
    }
  }

  // 5. Missing tokens, Minecraft formatting codes, or placeholders
  const origTokens = extractTokens(origStr, syntax);
  for (const token of origTokens) {
    if (!transStr.includes(token.value)) {
      issues.push({
        id: `missing-token-${token.value}`,
        message: `Пропущено елемент форматування: ${token.value}`,
        severity: "warning",
        token: token.value,
      });
    }
  }

  // 5b. Extension codes added or, for paired markers, unbalanced
  issues.push(...syntaxCodeIssues(origStr, transStr, syntax));
  issues.push(...syntax.extensions.flatMap((extension) => extension.checks?.(origStr, transStr) ?? []));

  // 6. Special characters from the original missing in the translation
  for (const ch of specialCharsOf(origText)) {
    if (!containsSpecialChar(transText, ch)) {
      const issue = {
        id: `missing-special-char-${ch}`,
        message: `Відсутній спецсимвол з оригіналу: «${ch}»`,
        severity: "info",
      };
      // The translator most likely typed a hyphen where the original has a dash.
      if (DASHES.includes(ch) && hasHyphenAsDash(transText)) {
        issue.fix = (value) => value.replace(HYPHEN_AS_DASH, "—");
      }
      issues.push(issue);
    }
  }

  // 7. Three dots instead of the ellipsis character
  if (hasThreeDots(transStr)) {
    issues.push({
      id: "three-dots",
      message: "Три крапки замість «…»",
      severity: "info",
      fix: (value) => value.replace(THREE_DOTS, "…"),
    });
  }

  // 7b. Hyphen-minus used as a sentence dash, unless the original uses it too
  if (hasHyphenAsDash(transText) && !hasHyphenAsDash(origText)) {
    issues.push({
      id: "hyphen-as-dash",
      message: "Замініть дефіс на довге тире «—»",
      severity: "info",
      fix: (value) => value.replace(HYPHEN_AS_DASH, "—"),
    });
  }

  // 8. Mixed Latin / Cyrillic script typos in words. Any non-letter (hyphen,
  // digit, symbol) ends a word, so deliberate compounds like "RF-енергія" pass.
  const words = transText.split(/[^\p{L}]+/u);
  for (const word of words) {
    if (word.length >= 2) {
      const hasCyrillic = /[\u0400-\u04FF]/.test(word);
      const hasLatin = /[a-zA-Z]/.test(word);
      if (hasCyrillic && hasLatin) {
        issues.push({
          id: `mixed-scripts-${word}`,
          message: `Змішано латиницю та кирилицю у слові «${word}»`,
          severity: "warning",
        });
        break; // Show once per string to avoid flooding
      }
    }
  }

  return issues;
};
