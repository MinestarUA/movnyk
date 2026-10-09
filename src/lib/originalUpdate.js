// Re-binding approved translations to a changed original (e.g. a new game
// version). The editor rows still hold the OLD original text next to the
// translation, so the new original is matched against them by key first and
// by unique original text second.
//
// Rules, per key in the new original:
// - same key, same text      → row kept untouched (translation and approval)
// - same key, changed text   → translation kept, approval dropped
// - new key, text matches exactly one removed old key (and only one new key
//   has that text) → treated as a rename: translation and approval carried over
// - any other new key        → empty, unapproved row
// Old rows that match nothing are "removed": they leave the editor but are
// returned so the reference panel can still find their translations.

const uniqueByText = (items, getText) => {
  const groups = new Map();
  for (const item of items) {
    const text = getText(item);
    groups.set(text, [...(groups.get(text) ?? []), item]);
  }
  return new Map(
    [...groups]
      .filter(([, group]) => group.length === 1)
      .map(([text, [item]]) => [text, item])
  );
};

export const applyNewOriginal = (translations, newOriginal) => {
  const newEntries = Object.entries(newOriginal).map(([key, value]) => [key, String(value)]);
  const newKeys = new Set(newEntries.map(([key]) => key));
  const oldByKey = new Map(translations.map((t) => [t.key, t]));

  const orphans = translations.filter((t) => !newKeys.has(t.key));
  const addedEntries = newEntries.filter(([key]) => !oldByKey.has(key));
  const orphanByText = uniqueByText(orphans, (t) => String(t.original));
  const addedByText = uniqueByText(addedEntries, ([, value]) => value);

  const renamedFrom = new Map();
  for (const [text, addedEntry] of addedByText) {
    const orphan = orphanByText.get(text);
    if (orphan) renamedFrom.set(addedEntry[0], orphan);
  }
  const renamedOldKeys = new Set([...renamedFrom.values()].map((t) => t.key));

  const stats = { unchanged: 0, changed: 0, renamed: 0, added: 0, removed: 0 };
  const next = newEntries.map(([key, value]) => {
    const old = oldByKey.get(key);
    if (old) {
      if (old.original === value) {
        stats.unchanged += 1;
        return old;
      }
      stats.changed += 1;
      return { ...old, original: value, confirmed: false };
    }
    const renamed = renamedFrom.get(key);
    if (renamed) {
      stats.renamed += 1;
      return { ...renamed, key };
    }
    stats.added += 1;
    return { key, original: value, translated: "", confirmed: false };
  });

  const removed = orphans
    .filter((t) => !renamedOldKeys.has(t.key))
    .map((t) => ({ ...t, removed: true }));
  stats.removed = removed.length;

  return { next, removed, stats };
};
