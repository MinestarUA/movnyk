import { applyNewOriginal } from "./originalUpdate";
import { rebindBookRows } from "./bookRebind";
import { extractPatchouliUnits, isBookKey } from "./patchouli";
import { findResumableSession } from "./sessions";

// Book rows per book that has any text, in file order. Patchouli text equal to
// a lang key is skipped, so the lang keys are passed in. GuideME units were
// already extracted when the jar was read.
const extractBooks = (books, bookJson, guideUnits, langKeys) =>
  books
    .map((book) => {
      const units = book.files.flatMap((path) =>
        book.format === "guideme" ? guideUnits[path] : extractPatchouliUnits(path, bookJson[path], langKeys)
      );
      return { book, units };
    })
    .filter(({ units }) => units.length > 0);

const sumStats = (a, b) => Object.fromEntries(Object.keys(a).map((name) => [name, a[name] + b[name]]));

// Decides which saved session (if any) a freshly loaded file continues and
// builds its editor rows. Reopening a file keeps its progress: saved rows are
// re-bound to the new original, which is a no-op when nothing changed.
//
// Lang rows and book rows are re-bound in separate passes: the rename
// heuristic matches by English text, and must never move a removed lang key's
// translation onto a book field that happens to read the same. Overlap with a
// saved session is measured on lang keys, so a large book cannot push an
// unchanged lang file below the resume threshold.
export const openSessionRows = ({
  savedSessions,
  name,
  content,
  resumable = true,
  books = [],
  bookJson = {},
  guideUnits = {},
}) => {
  const extracted = extractBooks(books, bookJson, guideUnits, new Set(Object.keys(content)));
  const newBookUnits = extracted.flatMap(({ units }) => units);
  const bookContent = Object.fromEntries(newBookUnits.map(({ key, original }) => [key, original]));
  const overlapSource = Object.keys(content).length > 0 ? content : bookContent;
  const existing = resumable ? findResumableSession(savedSessions, name, overlapSource) : null;
  const saved = existing?.translations ?? [];

  const lang = applyNewOriginal(saved.filter((row) => !isBookKey(row.key)), content);
  const book = rebindBookRows(saved.filter((row) => isBookKey(row.key)), newBookUnits);

  return {
    existing,
    next: [...lang.next, ...book.next],
    removed: [...lang.removed, ...book.removed],
    stats: sumStats(lang.stats, book.stats),
    books: extracted.map(({ book: { root, id, nameKey }, units }) => ({
      root,
      name: String(content[nameKey] ?? nameKey ?? id),
      rowCount: units.length,
    })),
  };
};
