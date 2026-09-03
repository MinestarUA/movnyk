// Merging an imported lang file (key → translated string) into the editor rows.
// With skipIdentical on, values that merely copy the English original are
// treated as untranslated and left alone, so they are neither exported as
// "done" nor hidden by the untranslated-only filter.
// With skipApproved on, already approved (confirmed) rows are kept as-is.

export const parseLangContent = (text) => {
  if (!text || typeof text !== "string") {
    throw new Error("Вміст порожній");
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("JSON повинен бути об'єктом");
    }
    return parsed;
  }

  const lines = text.split(/\r?\n/);
  const result = {};
  let found = false;
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx !== -1) {
      const key = line.slice(0, eqIdx).trim();
      // Whitespace hugging the "=" is separator padding, but a trailing space in
      // a value can be deliberate (prefix strings), so only the left side goes.
      const val = line.slice(eqIdx + 1).replace(/^[ \t]+/, "");
      if (key) {
        result[key] = val;
        found = true;
      }
    }
  }
  if (found) return result;
  throw new Error("Некоректний формат файлу. Очікується JSON або .lang");
};

export const mergeLangFile = (
  translations,
  loaded,
  { skipIdentical = true, confirmImported = true, skipApproved = false } = {}
) => {
  let applied = 0;
  let skipped = 0;
  const next = translations.map((t) => {
    const raw = loaded[t.key];
    if (raw == null) return t;
    if (skipApproved && t.confirmed) {
      skipped += 1;
      return t;
    }
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
