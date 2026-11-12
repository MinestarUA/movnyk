// Rows whose source string is blank act as spacers in the resource pack: they
// cannot be translated, so they must stay out of every progress figure.
export const isTranslatable = (item) =>
  Boolean(item.original && String(item.original).trim());

export const isGroupSynced = (item, syncIdenticalTranslations = true) =>
  Boolean(syncIdenticalTranslations && item?.original && !item.unsynced);

export const toggleGroupSync = (translations, original) => {
  if (!original) return translations;
  const target = translations.find((t) => t.original === original);
  if (!target) return translations;
  const nextUnsynced = !target.unsynced;
  return translations.map((t) =>
    t.original === original ? { ...t, unsynced: nextUnsynced } : t
  );
};

export const updateTranslation = (
  translations,
  index,
  newValue,
  { syncIdenticalTranslations = true, unconfirmOnEdit = true } = {}
) => {
  const target = translations[index];
  if (!target) return translations;
  const syncIdentical = isGroupSynced(target, syncIdenticalTranslations);

  return translations.map((item, i) => {
    const isTarget = i === index;
    const isIdentical = syncIdentical && item.original === target.original && !item.unsynced;
    if (isTarget || isIdentical) {
      return {
        ...item,
        translated: newValue,
        confirmed: unconfirmOnEdit ? false : item.confirmed,
      };
    }
    return item;
  });
};

export const confirmTranslation = (
  translations,
  key,
  { syncIdenticalTranslations = true, toggle = true } = {}
) => {
  const target = translations.find((t) => t.key === key);
  if (!target) return translations;
  const syncIdentical = isGroupSynced(target, syncIdenticalTranslations);
  const newConfirmed = toggle ? !target.confirmed : true;

  return translations.map((t) => {
    const isMatch = syncIdentical
      ? t.original === target.original && !t.unsynced
      : t.key === key;
    return isMatch && t.translated.trim() ? { ...t, confirmed: newConfirmed } : t;
  });
};

// Fills only rows that are still empty with batch AI translations, leaving
// them unconfirmed so a human can review them.
export const applyAutoTranslations = (translations, result) =>
  translations.map((t) =>
    typeof result[t.key] === "string" && !t.translated.trim()
      ? { ...t, translated: result[t.key], confirmed: false }
      : t
  );



// Writes bulk results by key and records what each changed row held before,
// so the whole edit can be undone in one step. A synced group follows its
// edited member even where the group's other rows are filtered out of view,
// as it does for a manual edit. With `overwrite` off (a fill), followers are
// written only where they are still empty.
export const applyBulkEdit = (
  translations,
  edits,
  { unconfirm = false, overwrite = true, syncIdenticalTranslations = true } = {}
) => {
  const byOriginal = new Map();
  for (const t of translations) {
    if (edits.has(t.key) && isGroupSynced(t, syncIdenticalTranslations) && !byOriginal.has(t.original)) {
      byOriginal.set(t.original, edits.get(t.key));
    }
  }
  const undo = [];
  const next = translations.map((t) => {
    const translated = edits.has(t.key)
      ? edits.get(t.key)
      : isGroupSynced(t, syncIdenticalTranslations) && (overwrite || !t.translated.trim())
        ? byOriginal.get(t.original)
        : undefined;
    if (translated === undefined || translated === t.translated) return t;
    const confirmed = unconfirm ? false : t.confirmed;
    undo.push({ key: t.key, translated: t.translated, confirmed: t.confirmed, applied: translated, appliedConfirmed: confirmed });
    return { ...t, translated, confirmed };
  });
  return { next, undo };
};

// Rows edited or (un)confirmed after the bulk edit keep their newer state:
// undo must not throw away work done in the meantime.
export const revertBulkEdit = (translations, undo) => {
  const byKey = new Map(undo.map((entry) => [entry.key, entry]));
  return translations.map((t) => {
    const entry = byKey.get(t.key);
    if (!entry || t.translated !== entry.applied || t.confirmed !== entry.appliedConfirmed) return t;
    return { ...t, translated: entry.translated, confirmed: entry.confirmed };
  });
};
