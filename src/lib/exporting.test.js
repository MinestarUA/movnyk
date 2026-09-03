import { describe, expect, it } from "vitest";
import { createTranslationObject } from "./exporting";

describe("createTranslationObject", () => {
  it("includes translated items", () => {
    const translations = [
      { key: "item.apple", original: "Apple", translated: "Яблуко" },
      { key: "item.sword", original: "Sword", translated: "" },
    ];
    expect(createTranslationObject(translations)).toEqual({
      "item.apple": "Яблуко",
    });
  });

  it("preserves empty rows without original on export", () => {
    const translations = [
      { key: "gui.spacer", original: "", translated: "" },
      { key: "gui.blank", original: "   ", translated: "" },
      { key: "item.bread", original: "Bread", translated: "" },
      { key: "item.cake", original: "Cake", translated: "Торт" },
    ];
    expect(createTranslationObject(translations)).toEqual({
      "gui.spacer": "",
      "gui.blank": "   ",
      "item.cake": "Торт",
    });
  });
});
