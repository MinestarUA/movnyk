// Bridging the editor rows and the raw JSON text shown in code mode.
//
// Both panes are serialized over the same row order, and the translation pane
// includes every key — untranslated ones as "" — so the two texts have
// identical line counts. That is what lets the panes scroll in lockstep and
// line up key-for-key; the export path still drops empty values on its own.

const stringify = (obj) => JSON.stringify(obj, null, 2);

export const serializeOriginals = (translations) =>
  stringify(Object.fromEntries(translations.map((t) => [t.key, String(t.original)])));

export const serializeTranslations = (translations) =>
  stringify(Object.fromEntries(translations.map((t) => [t.key, t.translated])));

// Folds a parsed code buffer back into the rows. Keys the template does not
// know are dropped rather than invented as new rows: the template defines what
// the lang file contains, and a typo'd key would otherwise silently become a
// permanent phantom entry. Same for non-string values — the row model holds
// strings, so a number or object is a mistake, not a translation.
export const applyCode = (translations, parsed, { unconfirmOnEdit = true } = {}) => {
  let used = 0;
  let skipped = 0;

  const next = translations.map((t) => {
    const raw = Object.prototype.hasOwnProperty.call(parsed, t.key) ? parsed[t.key] : undefined;

    if (raw === undefined) {
      // Deleting a key in the pane means "no translation", not "leave as is".
      if (!t.translated && !t.confirmed) return t;
      return { ...t, translated: "", confirmed: false };
    }

    if (typeof raw !== "string") {
      used += 1;
      skipped += 1;
      return t;
    }

    used += 1;
    if (raw === t.translated) return t;
    return { ...t, translated: raw, confirmed: unconfirmOnEdit ? false : t.confirmed };
  });

  // Anything left over in the buffer had no matching row.
  skipped += Object.keys(parsed).length - used;

  return { next, skipped };
};
