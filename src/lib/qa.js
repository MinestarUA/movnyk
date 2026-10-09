// Quality Assurance (QA) linter for Minecraft mod translations.
// Detects punctuation, whitespace, capitalization, missing variable/formatting tokens,
// typography slips and mixed-script typos (Latin letters inside Ukrainian words).
// Issues that have an unambiguous correction carry `fix(translated) => string`.

import { extractTokens, tokenizeString } from "./tokens";

// Tokens are blanked out with same-length spaces so that "§aТекст" or "%sшт"
// are not read as words, while character indices stay aligned with the input.
const blankTokens = (text) =>
  tokenizeString(text)
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
const withTrailingPunct = (punct) => (value) => {
  const { body, punct: current } = splitTrailing(blankTokens(value));
  return value.slice(0, body.length) + punct + value.slice(body.length + current.length);
};

const normalizeEllipsis = (punct) => (punct === "..." ? "…" : punct);

const isUpper = (ch) => ch.toUpperCase() === ch && ch.toLowerCase() !== ch;

const flipFirstLetter = (value) => {
  const first = blankTokens(value).match(/\p{L}/u);
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

export const checkTranslationQA = (original, translated) => {
  if (!original || !translated || !translated.trim()) {
    return [];
  }

  const issues = [];
  const origStr = String(original);
  const transStr = String(translated);
  const origText = blankTokens(origStr);
  const transText = blankTokens(transStr);

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
      fix: withTrailingPunct(origPunct),
    });
  } else if (!origPunct && transPunct) {
    issues.push({
      id: "extra-trailing-punct",
      message: `Зайвий розділовий знак у кінці («${transPunct}»)`,
      severity: "warning",
      fix: withTrailingPunct(""),
    });
  } else if (origPunct && normalizeEllipsis(origPunct) !== normalizeEllipsis(transPunct)) {
    issues.push({
      id: "mismatched-trailing-punct",
      message: `Розділовий знак у кінці («${transPunct}») не збігається з оригіналом («${origPunct}»)`,
      severity: "warning",
      fix: withTrailingPunct(origPunct),
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
        fix: flipFirstLetter,
      });
    } else if (!origIsUpper && transIsUpper) {
      issues.push({
        id: "capitalization-should-be-lower",
        message: "Перша літера має бути маленькою",
        severity: "warning",
        fix: flipFirstLetter,
      });
    }
  }

  // 5. Missing tokens, Minecraft formatting codes, or placeholders
  const origTokens = extractTokens(origStr);
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

  // 6. Special characters from the original missing in the translation
  for (const ch of specialCharsOf(origText)) {
    if (!containsSpecialChar(transText, ch)) {
      issues.push({
        id: `missing-special-char-${ch}`,
        message: `Відсутній спецсимвол з оригіналу: «${ch}»`,
        severity: "info",
      });
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

  // 8. Mixed Latin / Cyrillic script typos in words
  const words = transText.split(/[\s,.;:!?()[\]{}"'«»—/\\<>]+/);
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
