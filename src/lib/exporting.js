// Helpers for serializing and exporting translations.
// Empty lines without original are preserved on export,
// while empty translations with an original are omitted (so Minecraft falls back).

export const createTranslationObject = (translations) => {
  return translations.reduce((acc, item) => {
    const hasOriginal = Boolean(item.original && String(item.original).trim());
    if (item.translated) {
      acc[item.key] = item.translated;
    } else if (!hasOriginal) {
      acc[item.key] = item.original != null ? String(item.original) : "";
    }
    return acc;
  }, {});
};
