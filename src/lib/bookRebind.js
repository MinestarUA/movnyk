// Re-binding saved book rows to the units of an updated jar. Book keys hold
// positions ("#7", "/pages/2/text") that shift whenever a page is inserted, so
// unlike lang rows they cannot be matched by key. Within each file the old and
// new texts are aligned (longest common subsequence); rows are then matched by
// text, so an insertion moves no translation.
//
// Per file:
// - aligned texts          → row kept (translation, approval, sync mark)
// - gap of equal length    → paired in order: translation kept, approval dropped
// - gap of unequal length  → new units get empty rows, old rows become leftovers
// Leftovers are then paired across files when their text is unique on both
// sides (the file was renamed or split); the rest are "removed". The stats
// have the shape applyNewOriginal returns.

import { uniqueByText } from "./originalUpdate";
import { parseBookKey } from "./patchouli";

const lcsPairs = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = [];
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
};

const groupByPath = (items) => {
  const groups = new Map();
  for (const item of items) {
    const path = parseBookKey(item.key).path;
    groups.set(path, [...(groups.get(path) ?? []), item]);
  }
  return groups;
};

const emptyRow = ({ key, original }) => ({ key, original, translated: "", confirmed: false });

// savedRows: editor rows of the books; newUnits: [{ key, original }] in book order.
// Returns { next (in newUnits order), removed, stats }.
export const rebindBookRows = (savedRows, newUnits) => {
  const stats = { unchanged: 0, changed: 0, renamed: 0, added: 0, removed: 0 };
  const oldByPath = groupByPath(savedRows);
  const unitsByPath = groupByPath(newUnits);
  const rowByKey = new Map();
  const leftoverOld = [];
  const leftoverNew = [];

  for (const [path, old] of oldByPath) {
    if (!unitsByPath.has(path)) leftoverOld.push(...old);
  }

  for (const [path, units] of unitsByPath) {
    const old = oldByPath.get(path) ?? [];
    const oldTexts = old.map((row) => String(row.original));
    const newTexts = units.map((unit) => unit.original);
    let oldStart = 0;
    let newStart = 0;
    // The sentinel match makes the last step handle the gap after the final match.
    for (const [oldEnd, newEnd] of [...lcsPairs(oldTexts, newTexts), [old.length, units.length]]) {
      const gapOld = old.slice(oldStart, oldEnd);
      const gapNew = units.slice(newStart, newEnd);
      if (gapOld.length === gapNew.length) {
        gapNew.forEach((unit, k) => {
          const hasTranslation = gapOld[k].translated?.trim();
          stats[hasTranslation ? "changed" : "added"] += 1;
          rowByKey.set(unit.key, { ...gapOld[k], key: unit.key, original: unit.original, confirmed: false });
        });
      } else {
        leftoverOld.push(...gapOld);
        for (const unit of gapNew) {
          leftoverNew.push(unit);
          stats.added += 1;
          rowByKey.set(unit.key, emptyRow(unit));
        }
      }
      if (oldEnd < old.length) {
        stats.unchanged += 1;
        rowByKey.set(units[newEnd].key, { ...old[oldEnd], key: units[newEnd].key });
      }
      oldStart = oldEnd + 1;
      newStart = newEnd + 1;
    }
  }

  const newByText = uniqueByText(leftoverNew, (unit) => unit.original);
  const renamedOldKeys = new Set();
  for (const [text, row] of uniqueByText(leftoverOld, (row) => String(row.original))) {
    const unit = newByText.get(text);
    if (!unit) continue;
    stats.added -= 1;
    stats.renamed += 1;
    renamedOldKeys.add(row.key);
    rowByKey.set(unit.key, { ...row, key: unit.key });
  }

  const removed = leftoverOld.filter((row) => !renamedOldKeys.has(row.key)).map((row) => ({ ...row, removed: true }));
  stats.removed = removed.length;
  return { next: newUnits.map((unit) => rowByKey.get(unit.key)), removed, stats };
};
