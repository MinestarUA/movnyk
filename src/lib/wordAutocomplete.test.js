import { describe, expect, it } from "vitest";
import {
  buildWordAutocompleteWords,
  findWordAutocompleteSuggestions,
  getWordAutocompleteContext,
  matchFragmentCase,
} from "./wordAutocomplete";

describe("buildWordAutocompleteWords", () => {
  it("collects words from translated text of translatable rows only", () => {
    const words = buildWordAutocompleteWords([
      { original: "A", translated: "Привіт світ" },
      { original: "", translated: "Прихований" },
      { original: "B", translated: "" },
    ]);
    expect(words).toEqual(["Привіт", "світ"]);
  });

  it("keeps the first spelling of words that differ only in case", () => {
    const words = buildWordAutocompleteWords([
      { original: "A", translated: "Привіт" },
      { original: "B", translated: "привіт ПРИВІТ" },
    ]);
    expect(words).toEqual(["Привіт"]);
  });

  it("skips Minecraft format codes and placeholders", () => {
    const words = buildWordAutocompleteWords([{ original: "A", translated: "§aЗелений %s текст" }]);
    expect(words).toEqual(["Зелений", "текст"]);
  });
});

describe("getWordAutocompleteContext", () => {
  it("returns the word ending at the caret", () => {
    expect(getWordAutocompleteContext("Це при", 6, 6)).toEqual({ start: 3, end: 6, word: "при" });
  });

  it("returns null for a range selection", () => {
    expect(getWordAutocompleteContext("Це при", 3, 6)).toBeNull();
  });

  it("returns null when the caret is inside a word", () => {
    expect(getWordAutocompleteContext("привіт", 3, 3)).toBeNull();
  });

  it("returns null when the caret follows a space or punctuation", () => {
    expect(getWordAutocompleteContext("Це ", 3, 3)).toBeNull();
    expect(getWordAutocompleteContext("Це,", 3, 3)).toBeNull();
  });

  it("keeps apostrophes and hyphens inside the word", () => {
    expect(getWordAutocompleteContext("по-нашому", 9, 9)).toEqual({
      start: 0,
      end: 9,
      word: "по-нашому",
    });
    expect(getWordAutocompleteContext("м'яко", 5, 5).word).toBe("м'яко");
  });
});

describe("findWordAutocompleteSuggestions", () => {
  const words = ["Привіт", "приклад", "при", "світ"];

  it("matches prefixes case-insensitively", () => {
    expect(findWordAutocompleteSuggestions(words, "ПРИ")).toEqual(["Привіт", "приклад"]);
  });

  it("excludes a word that equals the fragment exactly", () => {
    expect(findWordAutocompleteSuggestions(words, "при")).toEqual(["Привіт", "приклад"]);
  });

  it("returns nothing for an empty fragment", () => {
    expect(findWordAutocompleteSuggestions(words, "")).toEqual([]);
  });

  it("caps the number of suggestions", () => {
    expect(findWordAutocompleteSuggestions(words, "п", 2)).toEqual(["Привіт", "приклад"]);
  });
});

describe("matchFragmentCase", () => {
  it("leaves the word alone for a lowercase fragment", () => {
    expect(matchFragmentCase("привіт", "пр")).toBe("привіт");
  });

  it("capitalizes the first letter for a capitalized fragment", () => {
    expect(matchFragmentCase("привіт", "Пр")).toBe("Привіт");
  });

  it("uppercases the word for an all-caps fragment", () => {
    expect(matchFragmentCase("привіт", "ПР")).toBe("ПРИВІТ");
  });

  it("treats a single capital letter as a capitalized fragment, not all caps", () => {
    expect(matchFragmentCase("привіт", "П")).toBe("Привіт");
  });
});
