// Quality Assurance (QA) linter for Minecraft mod translations.
// Detects punctuation, whitespace, capitalization, missing variable/formatting tokens,
// and mixed-script typos (Latin letters inside Ukrainian words).

import { extractTokens } from "./tokens";

export const checkTranslationQA = (original, translated) => {
  if (!original || !translated || !translated.trim()) {
    return [];
  }

  const issues = [];
  const origStr = String(original);
  const transStr = String(translated);

  // 1. Whitespace mismatch
  const origLeadWs = (origStr.match(/^\s+/) || [""])[0];
  const transLeadWs = (transStr.match(/^\s+/) || [""])[0];
  if (origLeadWs && !transLeadWs) {
    issues.push({
      id: "missing-leading-ws",
      message: "Відсутній пробіл на початку",
      severity: "warning",
    });
  } else if (!origLeadWs && transLeadWs) {
    issues.push({
      id: "extra-leading-ws",
      message: "Зайвий пробіл на початку",
      severity: "warning",
    });
  }

  const origTrailWs = (origStr.match(/\s+$/) || [""])[0];
  const transTrailWs = (transStr.match(/\s+$/) || [""])[0];
  if (origTrailWs && !transTrailWs) {
    issues.push({
      id: "missing-trailing-ws",
      message: "Відсутній пробіл або перенесення рядка в кінці",
      severity: "warning",
    });
  } else if (!origTrailWs && transTrailWs) {
    issues.push({
      id: "extra-trailing-ws",
      message: "Зайвий пробіл або перенесення рядка в кінці",
      severity: "warning",
    });
  }

  // 2. Trailing punctuation mismatch
  // Normalize punctuation groups like '...' or single marks like '.', '!', '?', ':', ';'
  const getTrailingPunct = (s) => {
    const trimmed = s.trimEnd();
    const match = trimmed.match(/(\.{3}|…|[.!?:;])$/);
    return match ? match[0] : "";
  };

  const origPunct = getTrailingPunct(origStr);
  const transPunct = getTrailingPunct(transStr);

  if (origPunct && !transPunct) {
    issues.push({
      id: "missing-trailing-punct",
      message: `Відсутній розділовий знак у кінці («${origPunct}»)`,
      severity: "warning",
    });
  } else if (!origPunct && transPunct) {
    issues.push({
      id: "extra-trailing-punct",
      message: `Зайвий розділовий знак у кінці («${transPunct}»)`,
      severity: "warning",
    });
  } else if (origPunct && transPunct && origPunct !== transPunct) {
    // Normalise '...' and '…' to not conflict
    const norm = (p) => (p === "..." || p === "…" ? "…" : p);
    if (norm(origPunct) !== norm(transPunct)) {
      issues.push({
        id: "mismatched-trailing-punct",
        message: `Розділовий знак у кінці («${transPunct}») не збігається з оригіналом («${origPunct}»)`,
        severity: "warning",
      });
    }
  }

  // 3. Capitalization of first letter
  const origFirstMatch = origStr.trim().match(/\p{L}/u);
  const transFirstMatch = transStr.trim().match(/\p{L}/u);

  if (origFirstMatch && transFirstMatch) {
    const origChar = origFirstMatch[0];
    const transChar = transFirstMatch[0];
    const origIsUpper = origChar.toUpperCase() === origChar && origChar.toLowerCase() !== origChar;
    const transIsUpper = transChar.toUpperCase() === transChar && transChar.toLowerCase() !== transChar;

    if (origIsUpper && !transIsUpper) {
      issues.push({
        id: "capitalization-should-be-upper",
        message: "Перша літера має бути великою",
        severity: "warning",
      });
    } else if (!origIsUpper && transIsUpper) {
      issues.push({
        id: "capitalization-should-be-lower",
        message: "Перша літера має бути маленькою",
        severity: "warning",
      });
    }
  }

  // 4. Missing tokens, Minecraft formatting codes, or placeholders
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

  // 5. Mixed Latin / Cyrillic script typos in words
  const words = transStr.split(/[\s,.;:!?()[\]{}"'«»—/\\<>]+/);
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
