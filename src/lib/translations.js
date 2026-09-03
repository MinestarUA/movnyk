// Rows whose source string is blank act as spacers in the resource pack: they
// cannot be translated, so they must stay out of every progress figure.
export const isTranslatable = (item) =>
  Boolean(item.original && String(item.original).trim());
