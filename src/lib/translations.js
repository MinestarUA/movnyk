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


