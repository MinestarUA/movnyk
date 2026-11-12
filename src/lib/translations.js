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



// Plans a bulk action over the rows the list shows, then over the rows
// outside it that share a synced group with an edited row. Each follower is
// planned from its own text, so a group filtered partly out of view still
// follows its edited member, as on a manual edit, without copying one
// member's text over another's. Rows in `excludeKeys` are never followers.
export const planWithSyncedFollowers = (
  shownRows,
  translations,
  plan,
  { syncIdenticalTranslations = true, excludeKeys = [] } = {}
) => {
  const shown = plan(shownRows);
  const planned = new Set([...shownRows.map((row) => row.key), ...excludeKeys]);
  const editedOriginals = new Set(
    translations
      .filter((t) => shown.has(t.key) && isGroupSynced(t, syncIdenticalTranslations))
      .map((t) => t.original)
  );
  const followers = translations.filter(
    (t) => !planned.has(t.key) && editedOriginals.has(t.original) && isGroupSynced(t, syncIdenticalTranslations)
  );
  return followers.length > 0 ? new Map([...shown, ...plan(followers)]) : shown;
};

// Writes bulk results by key and records what each changed row held before,
// so the whole edit can be undone in one step.
export const applyBulkEdit = (translations, edits, { unconfirm = false } = {}) => {
  const undo = [];
  const next = translations.map((t) => {
    if (!edits.has(t.key)) return t;
    const translated = edits.get(t.key);
    if (translated === t.translated) return t;
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
