// Merging an imported lang file (key → translated string) into the editor rows.
// With skipIdentical on, values that merely copy the English original are
// treated as untranslated and left alone, so they are neither exported as
// "done" nor hidden by the untranslated-only filter.

export const mergeLangFile = (
  translations,
  loaded,
  { skipIdentical = true, confirmImported = true } = {}
) => {
  let applied = 0;
  let skipped = 0;
  const next = translations.map((t) => {
    const raw = loaded[t.key];
    if (raw == null) return t;
    const value = String(raw);
    if (skipIdentical && value === String(t.original)) {
      skipped += 1;
      return t;
    }
    applied += 1;
    return { ...t, translated: value, confirmed: confirmImported };
  });
  return { next, applied, skipped };
};
