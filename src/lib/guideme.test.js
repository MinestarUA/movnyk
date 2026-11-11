import { describe, expect, it } from "vitest";
import { findGuideBooks } from "./guideme";

describe("findGuideBooks", () => {
  it.each([
    [
      "translated pages are not part of the source",
      ["assets/ae2/ae2guide/index.md", "assets/ae2/ae2guide/_de_de/index.md"],
      [{ root: "assets/ae2/ae2guide", id: "ae2:ae2guide", files: ["assets/ae2/ae2guide/index.md"] }],
    ],
    [
      "nested pages are kept, sorted",
      ["assets/ae2/ae2guide/items/inscriber.md", "assets/ae2/ae2guide/index.md"],
      [
        {
          root: "assets/ae2/ae2guide",
          id: "ae2:ae2guide",
          files: ["assets/ae2/ae2guide/index.md", "assets/ae2/ae2guide/items/inscriber.md"],
        },
      ],
    ],
    ["Patchouli folders are ignored", ["assets/a/patchouli_books/b/en_us/entries/x.md"], []],
    ["files outside a guide folder are ignored", ["assets/a/page.md", "data/a/guide/x.md", "assets/a/guide/x.json"], []],
  ])("%s", (_, paths, expected) => {
    expect(findGuideBooks(paths)).toEqual(expected);
  });
});
