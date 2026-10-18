import { describe, expect, it } from "vitest";
import {
  getCaseShortcutAction,
  findWordRangeAtCaret,
  transformCase,
  applyCaseShortcut,
} from "./caseConversion";

describe("getCaseShortcutAction", () => {
  it("recognizes Ctrl+U and Cmd+U as lower on Latin and Ukrainian layouts", () => {
    expect(
      getCaseShortcutAction({ key: "u", code: "KeyU", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })
    ).toBe("lower");
    expect(
      getCaseShortcutAction({ key: "г", code: "KeyU", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })
    ).toBe("lower");
    expect(
      getCaseShortcutAction({ key: "u", code: "KeyU", ctrlKey: false, metaKey: true, shiftKey: false, altKey: false })
    ).toBe("lower");
  });

  it("recognizes Ctrl+Shift+U and Cmd+Shift+U as upper on Latin and Ukrainian layouts", () => {
    expect(
      getCaseShortcutAction({ key: "U", code: "KeyU", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false })
    ).toBe("upper");
    expect(
      getCaseShortcutAction({ key: "Г", code: "KeyU", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false })
    ).toBe("upper");
    expect(
      getCaseShortcutAction({ key: "U", code: "KeyU", ctrlKey: false, metaKey: true, shiftKey: true, altKey: false })
    ).toBe("upper");
  });

  it("recognizes Shift+Alt+U as sentence on Latin and Ukrainian layouts", () => {
    expect(
      getCaseShortcutAction({ key: "U", code: "KeyU", ctrlKey: false, metaKey: false, shiftKey: true, altKey: true })
    ).toBe("sentence");
    expect(
      getCaseShortcutAction({ key: "Г", code: "KeyU", ctrlKey: false, metaKey: false, shiftKey: true, altKey: true })
    ).toBe("sentence");
  });

  it("returns null for unrelated keys or modifier combinations", () => {
    expect(
      getCaseShortcutAction({ key: "u", code: "KeyU", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false })
    ).toBeNull();
    expect(
      getCaseShortcutAction({ key: "u", code: "KeyU", ctrlKey: false, metaKey: false, shiftKey: false, altKey: true })
    ).toBeNull();
    expect(
      getCaseShortcutAction({ key: "u", code: "KeyU", ctrlKey: true, metaKey: false, shiftKey: true, altKey: true })
    ).toBeNull();
    expect(
      getCaseShortcutAction({ key: "f", code: "KeyF", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })
    ).toBeNull();
  });
});

describe("findWordRangeAtCaret", () => {
  it("finds the word when caret is at the start, middle, or end of the word", () => {
    const text = "Привіт світ";
    expect(findWordRangeAtCaret(text, 0)).toEqual({ start: 0, end: 6 });
    expect(findWordRangeAtCaret(text, 3)).toEqual({ start: 0, end: 6 });
    expect(findWordRangeAtCaret(text, 6)).toEqual({ start: 0, end: 6 });
    expect(findWordRangeAtCaret(text, 7)).toEqual({ start: 7, end: 11 });
    expect(findWordRangeAtCaret(text, 11)).toEqual({ start: 7, end: 11 });
  });

  it("treats Ukrainian words with internal apostrophes as a single word", () => {
    for (const word of ["м'ясо", "п’ять", "обʼєкт"]) {
      for (let pos = 0; pos <= word.length; pos++) {
        expect(findWordRangeAtCaret(word, pos)).toEqual({ start: 0, end: word.length });
      }
    }
  });

  it("does not include formatting tokens adjacent to the word under the caret", () => {
    expect(findWordRangeAtCaret("§aСлово§r", 2)).toEqual({ start: 2, end: 7 });
    expect(findWordRangeAtCaret("§aСлово§r", 7)).toEqual({ start: 2, end: 7 });
    expect(findWordRangeAtCaret("%sшт", 2)).toEqual({ start: 2, end: 4 });
  });

  it("returns an empty range when caret is between spaces or punctuation", () => {
    expect(findWordRangeAtCaret("а   б", 2)).toEqual({ start: 2, end: 2 });
    expect(findWordRangeAtCaret("...", 1)).toEqual({ start: 1, end: 1 });
  });
});

describe("transformCase", () => {
  it("converts text to lowercase and uppercase while preserving formatting tokens", () => {
    expect(transformCase("§aЗалізний %s Меч", "lower")).toBe("§aзалізний %s меч");
    expect(transformCase("§aЗалізний %s Меч\\n$(br)", "upper")).toBe("§aЗАЛІЗНИЙ %s МЕЧ\\n$(br)");
  });

  it("capitalizes only the first letter of the entire target in sentence mode, lowercasing all other words", () => {
    expect(transformCase("ЗАЛІЗНИЙ ВЕЛИКИЙ МЕЧ", "sentence")).toBe("Залізний великий меч");
    expect(transformCase("залізний великий меч", "sentence")).toBe("Залізний великий меч");
    expect(transformCase("ЗалізниЙ ВеликиЙ МеЧ", "sentence")).toBe("Залізний великий меч");
  });

  it("capitalizes the first letter after leading punctuation or formatting tokens in sentence mode", () => {
    expect(transformCase("«ЗАЛІЗНИЙ МЕЧ»", "sentence")).toBe("«Залізний меч»");
    expect(transformCase("§a$(l)ЗАЛІЗНИЙ %s МЕЧ", "sentence")).toBe("§a$(l)Залізний %s меч");
  });
});

describe("applyCaseShortcut", () => {
  it("transforms the word in focus when caret is collapsed and preserves caret offset", () => {
    const res = applyCaseShortcut("Привіт Світ", 9, 9, "lower");
    expect(res).toEqual({
      value: "Привіт світ",
      selectionStart: 9,
      selectionEnd: 9,
      changed: true,
    });
  });

  it("transforms the entire selection and keeps the selection range active", () => {
    const text = "Червоний Залізний Меч";
    const lower = applyCaseShortcut(text, 0, text.length, "lower");
    expect(lower).toEqual({
      value: "червоний залізний меч",
      selectionStart: 0,
      selectionEnd: text.length,
      changed: true,
    });

    const upper = applyCaseShortcut(lower.value, 0, text.length, "upper");
    expect(upper).toEqual({
      value: "ЧЕРВОНИЙ ЗАЛІЗНИЙ МЕЧ",
      selectionStart: 0,
      selectionEnd: text.length,
      changed: true,
    });

    const sentence = applyCaseShortcut(upper.value, 0, text.length, "sentence");
    expect(sentence).toEqual({
      value: "Червоний залізний меч",
      selectionStart: 0,
      selectionEnd: text.length,
      changed: true,
    });
  });

  it("returns changed: false when caret is not on a word and nothing is selected", () => {
    const res = applyCaseShortcut("Привіт   світ", 7, 7, "upper");
    expect(res).toEqual({
      value: "Привіт   світ",
      selectionStart: 7,
      selectionEnd: 7,
      changed: false,
    });
  });
});
