// Matches a physical key (e.code) so shortcuts work on non-Latin layouts, with
// e.key and legacy keyCode fallbacks for other layouts.
export const matchesKey = (e, code, latinChar, ukChar, keyCode) => {
  if (e.code === code) return true;
  if (typeof e.key === "string") {
    const lower = e.key.toLowerCase();
    if (lower === latinChar || lower === ukChar) return true;
  }
  return e.keyCode === keyCode;
};

const isPlainAlt = (e) => e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;

// Alt + Q: show a row's QA warning details, press again to apply the fixes.
export const isQaShortcut = (e) => isPlainAlt(e) && matchesKey(e, "KeyQ", "q", "й", 81);

// Alt + 1…9 (digit or numpad): the 1-based index of the original's token to insert.
// Shift is excluded because it produces symbols on the Ukrainian layout.
export const getTokenShortcutIndex = (e) => {
  if (!isPlainAlt(e)) return null;
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  return match ? Number(match[1]) : null;
};
