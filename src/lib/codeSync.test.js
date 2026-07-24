import { describe, expect, it } from "vitest";
import { serializeOriginals, serializeTranslations, applyCode } from "./codeSync";

const rows = [
  { key: "block.stone", original: "Stone", translated: "Камінь", confirmed: true },
  { key: "item.stick", original: "Stick", translated: "", confirmed: false },
];

describe("serializeOriginals", () => {
  it("emits every key with its original value in row order", () => {
    expect(serializeOriginals(rows)).toBe(
      '{\n  "block.stone": "Stone",\n  "item.stick": "Stick"\n}'
    );
  });
});

describe("serializeTranslations", () => {
  it("emits every key including untranslated ones as empty strings", () => {
    expect(serializeTranslations(rows)).toBe(
      '{\n  "block.stone": "Камінь",\n  "item.stick": ""\n}'
    );
  });

  it("produces the same key order and line count as serializeOriginals", () => {
    const left = serializeOriginals(rows).split("\n");
    const right = serializeTranslations(rows).split("\n");
    expect(right.length).toBe(left.length);
  });
});

describe("applyCode", () => {
  it("round-trips: applying its own serialization changes nothing", () => {
    const { next, skipped } = applyCode(rows, JSON.parse(serializeTranslations(rows)));
    expect(next).toEqual(rows);
    expect(skipped).toBe(0);
  });

  it("clears confirmed on a changed value when unconfirmOnEdit is on", () => {
    const { next } = applyCode(rows, { "block.stone": "Каміння", "item.stick": "" }, {
      unconfirmOnEdit: true,
    });
    expect(next[0]).toEqual({
      key: "block.stone",
      original: "Stone",
      translated: "Каміння",
      confirmed: false,
    });
  });

  it("keeps confirmed on a changed value when unconfirmOnEdit is off", () => {
    const { next } = applyCode(rows, { "block.stone": "Каміння", "item.stick": "" }, {
      unconfirmOnEdit: false,
    });
    expect(next[0].translated).toBe("Каміння");
    expect(next[0].confirmed).toBe(true);
  });

  it("leaves an untouched value's confirmed flag alone", () => {
    const { next } = applyCode(rows, { "block.stone": "Камінь", "item.stick": "" }, {
      unconfirmOnEdit: true,
    });
    expect(next[0].confirmed).toBe(true);
  });

  it("empties and unconfirms a row whose key is absent from the pane", () => {
    const { next } = applyCode(rows, { "item.stick": "" });
    expect(next[0]).toEqual({
      key: "block.stone",
      original: "Stone",
      translated: "",
      confirmed: false,
    });
  });

  it("drops keys that are not in the template and counts them", () => {
    const { next, skipped } = applyCode(rows, {
      "block.stone": "Камінь",
      "item.stick": "",
      "block.ghost": "Привид",
    });
    expect(next).toEqual(rows);
    expect(next.some((t) => t.key === "block.ghost")).toBe(false);
    expect(skipped).toBe(1);
  });

  it("skips non-string values and counts them", () => {
    const { next, skipped } = applyCode(rows, { "block.stone": 42, "item.stick": null });
    expect(next[0].translated).toBe("Камінь");
    expect(next[0].confirmed).toBe(true);
    expect(skipped).toBe(2);
  });

  it("does not mutate the input array or its rows", () => {
    const input = [{ key: "block.stone", original: "Stone", translated: "Камінь", confirmed: true }];
    const snapshot = structuredClone(input);
    applyCode(input, { "block.stone": "Каміння" }, { unconfirmOnEdit: true });
    expect(input).toEqual(snapshot);
  });
});
