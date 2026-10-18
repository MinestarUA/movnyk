import { describe, expect, it } from "vitest";
import {
  isTranslatable,
  isGroupSynced,
  toggleGroupSync,
  updateTranslation,
  confirmTranslation,
  applyAutoTranslations,
} from "./translations";

const row = (key, original, translated = "", confirmed = false, unsynced = false) => ({
  key,
  original,
  translated,
  confirmed,
  unsynced,
});

describe("isTranslatable", () => {
  it("treats non-empty originals as translatable and blank originals as spacers", () => {
    expect(isTranslatable(row("a", "Stone"))).toBe(true);
    expect(isTranslatable(row("b", "   "))).toBe(false);
    expect(isTranslatable(row("c", ""))).toBe(false);
  });
});

describe("isGroupSynced", () => {
  it("returns true only when global sync is on, original is present, and group is not unsynced", () => {
    expect(isGroupSynced(row("a", "Stone", "", false, false), true)).toBe(true);
    expect(isGroupSynced(row("a", "Stone", "", false, true), true)).toBe(false);
    expect(isGroupSynced(row("a", "Stone", "", false, false), false)).toBe(false);
    expect(isGroupSynced(row("a", "", "", false, false), true)).toBe(false);
  });
});

describe("toggleGroupSync", () => {
  it("toggles unsynced on all rows sharing the same original without touching other groups", () => {
    const initial = [
      row("a1", "Lead", "Свинець", true),
      row("a2", "Lead", "Свинець", true),
      row("b1", "Stone", "Камінь", true),
    ];

    const unsynced = toggleGroupSync(initial, "Lead");
    expect(unsynced.map((r) => r.unsynced)).toEqual([true, true, false]);
    expect(unsynced.map((r) => r.translated)).toEqual(["Свинець", "Свинець", "Камінь"]);

    const resynced = toggleGroupSync(unsynced, "Lead");
    expect(resynced.map((r) => r.unsynced)).toEqual([false, false, false]);
  });

  it("does not overwrite separated translations when re-enabling sync", () => {
    const separated = [
      row("a1", "Lead", "Свинець", true, true),
      row("a2", "Lead", "Повідець", true, true),
    ];

    const resynced = toggleGroupSync(separated, "Lead");
    expect(resynced).toEqual([
      row("a1", "Lead", "Свинець", true, false),
      row("a2", "Lead", "Повідець", true, false),
    ]);
  });
});

describe("updateTranslation", () => {
  it("syncs edits across identical rows when the group is synced", () => {
    const rows = [
      row("a1", "Lead", "Свинець", true),
      row("a2", "Lead", "Свинець", true),
      row("b1", "Stone", "Камінь", true),
    ];

    const next = updateTranslation(rows, 0, "Повідець");
    expect(next).toEqual([
      row("a1", "Lead", "Повідець", false),
      row("a2", "Lead", "Повідець", false),
      row("b1", "Stone", "Камінь", true),
    ]);
  });

  it("updates only the edited row when the group is unsynced", () => {
    const rows = [
      row("a1", "Lead", "Свинець", true, true),
      row("a2", "Lead", "Свинець", true, true),
    ];

    const next = updateTranslation(rows, 1, "Повідець");
    expect(next).toEqual([
      row("a1", "Lead", "Свинець", true, true),
      row("a2", "Lead", "Повідець", false, true),
    ]);
  });

  it("updates only the edited row when global syncIdenticalTranslations is disabled", () => {
    const rows = [
      row("a1", "Lead", "Свинець", true),
      row("a2", "Lead", "Свинець", true),
    ];

    const next = updateTranslation(rows, 0, "Повідець", {
      syncIdenticalTranslations: false,
      unconfirmOnEdit: false,
    });
    expect(next).toEqual([
      row("a1", "Lead", "Повідець", true),
      row("a2", "Lead", "Свинець", true),
    ]);
  });
});

describe("confirmTranslation", () => {
  it("toggles confirmation across synced identical rows that have a translation", () => {
    const rows = [
      row("a1", "Lead", "Свинець", false),
      row("a2", "Lead", "Свинець", false),
      row("a3", "Lead", "   ", false),
    ];

    const confirmed = confirmTranslation(rows, "a1");
    expect(confirmed.map((r) => r.confirmed)).toEqual([true, true, false]);

    const unconfirmed = confirmTranslation(confirmed, "a2");
    expect(unconfirmed.map((r) => r.confirmed)).toEqual([false, false, false]);
  });

  it("confirms only the target row when the group is unsynced", () => {
    const rows = [
      row("a1", "Lead", "Свинець", false, true),
      row("a2", "Lead", "Повідець", false, true),
    ];

    const next = confirmTranslation(rows, "a1");
    expect(next.map((r) => r.confirmed)).toEqual([true, false]);
  });

  it("keeps already-confirmed rows confirmed when toggle is false (Enter key behavior)", () => {
    const rows = [
      row("a1", "Lead", "Свинець", true),
      row("a2", "Lead", "Свинець", false),
    ];

    const next = confirmTranslation(rows, "a1", { toggle: false });
    expect(next.map((r) => r.confirmed)).toEqual([true, true]);
  });
});

describe("applyAutoTranslations", () => {
  it("fills empty rows without confirming them and leaves already-translated rows untouched", () => {
    const rows = [
      row("a", "Apple", ""),
      row("b", "Bread", "Паляниця", true),
    ];

    const next = applyAutoTranslations(rows, { a: "Яблуко", b: "Хліб" });
    expect(next).toEqual([
      row("a", "Apple", "Яблуко", false),
      row("b", "Bread", "Паляниця", true),
    ]);
  });
});
