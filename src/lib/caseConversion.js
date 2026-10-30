import { tokenizeString } from "./tokens";
import { matchesKey } from "./keyboardShortcuts";

const isWordChar = (ch) => Boolean(ch && /[\p{L}\p{M}\p{N}]/u.test(ch));

const isInternalApostrophe = (str, i) =>
  Boolean(str[i] && /^['’ʼ]$/u.test(str[i]) && isWordChar(str[i - 1]) && isWordChar(str[i + 1]));

const isWordIndex = (str, i) => isWordChar(str[i]) || isInternalApostrophe(str, i);

// Detects case conversion keyboard shortcuts in a layout-independent way:
// Conflict-free Alt shortcuts (no browser View Source, Linux IBus, or OS Alt+Shift conflicts):
// - Alt + Z or Alt + L  → "lower"
// - Alt + X or Alt + U  → "upper"
// - Alt + C             → "sentence" (first letter uppercase, rest lowercase)
// Also intercepts U-based combinations:
// - Ctrl/Cmd + U        → "lower"
// - Ctrl/Cmd + Shift + U → "upper"
// - Shift + Alt + U     → "sentence"
export const getCaseShortcutAction = (e) => {
  const hasPrimary = Boolean(e.ctrlKey || e.metaKey);

  // Conflict-free single-Alt shortcuts:
  if (!hasPrimary && !e.shiftKey && e.altKey) {
    if (matchesKey(e, "KeyZ", "z", "я", 90) || matchesKey(e, "KeyL", "l", "д", 76)) {
      return "lower";
    }
    if (matchesKey(e, "KeyX", "x", "ч", 88) || matchesKey(e, "KeyU", "u", "г", 85)) {
      return "upper";
    }
    if (matchesKey(e, "KeyC", "c", "с", 67)) {
      return "sentence";
    }
  }

  if (matchesKey(e, "KeyU", "u", "г", 85)) {
    if (hasPrimary && !e.shiftKey && !e.altKey) return "lower";
    if (hasPrimary && e.shiftKey && !e.altKey) return "upper";
    if (!hasPrimary && e.shiftKey && e.altKey) return "sentence";
  }

  return null;
};

// Finds the word boundaries touching `caret` while ignoring formatting tokens.
export const findWordRangeAtCaret = (text, caret) => {
  if (!text) return { start: 0, end: 0 };
  const blanked = tokenizeString(text)
    .map((seg) => (seg.type === "text" ? seg.value : " ".repeat(seg.value.length)))
    .join("");

  const pos = Math.max(0, Math.min(caret, blanked.length));
  let start = pos;
  let end = pos;

  while (start > 0 && isWordIndex(blanked, start - 1)) {
    start -= 1;
  }
  while (end < blanked.length && isWordIndex(blanked, end)) {
    end += 1;
  }

  return { start, end };
};

// Transforms the case of `text` according to `action` ("lower" | "upper" | "sentence"),
// leaving Minecraft/Patchouli formatting tokens and placeholders untouched.
export const transformCase = (text, action) => {
  if (!text) return "";
  const segments = tokenizeString(text);

  if (action === "lower") {
    return segments
      .map((seg) => (seg.type === "text" ? seg.value.toLowerCase() : seg.value))
      .join("");
  }

  if (action === "upper") {
    return segments
      .map((seg) => (seg.type === "text" ? seg.value.toUpperCase() : seg.value))
      .join("");
  }

  if (action === "sentence") {
    let capitalizedFirst = false;
    return segments
      .map((seg) => {
        if (seg.type !== "text") return seg.value;
        const lower = seg.value.toLowerCase();
        if (capitalizedFirst) return lower;
        return lower.replace(/\p{L}/u, (ch) => {
          capitalizedFirst = true;
          return ch.toUpperCase();
        });
      })
      .join("");
  }

  return text;
};

// Applies `action` to either the current selection or the word touching the caret.
export const applyCaseShortcut = (text, selectionStart, selectionEnd, action) => {
  const str = String(text ?? "");
  const startSel = Math.max(0, Math.min(selectionStart ?? 0, str.length));
  const endSel = Math.max(startSel, Math.min(selectionEnd ?? startSel, str.length));
  const collapsed = startSel === endSel;

  const { start, end } = collapsed
    ? findWordRangeAtCaret(str, startSel)
    : { start: startSel, end: endSel };

  if (start === end) {
    return {
      value: str,
      selectionStart: startSel,
      selectionEnd: endSel,
      changed: false,
    };
  }

  const target = str.slice(start, end);
  const transformed = transformCase(target, action);
  const value = str.slice(0, start) + transformed + str.slice(end);
  const nextEndBound = start + transformed.length;

  const nextStart = collapsed ? Math.min(startSel, nextEndBound) : start;
  const nextEnd = collapsed ? nextStart : nextEndBound;

  return {
    value,
    selectionStart: nextStart,
    selectionEnd: nextEnd,
    changed: value !== str,
  };
};
