import { describe, it, expect } from "vitest";
import { getTokenShortcutIndex, isQaShortcut } from "./keyboardShortcuts";

const keyEvent = (overrides) => ({
  code: "",
  key: "",
  keyCode: 0,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

describe("isQaShortcut", () => {
  it.each([
    ["latin Q", { code: "KeyQ", key: "q", keyCode: 81 }],
    ["Ukrainian й on the same key", { code: "KeyQ", key: "й", keyCode: 81 }],
  ])("matches Alt+%s", (_, overrides) => {
    expect(isQaShortcut(keyEvent({ ...overrides, altKey: true }))).toBe(true);
  });

  it.each([
    ["without Alt", { altKey: false }],
    ["with Ctrl", { altKey: true, ctrlKey: true }],
    ["with Shift", { altKey: true, shiftKey: true }],
  ])("ignores Q %s", (_, overrides) => {
    expect(isQaShortcut(keyEvent({ code: "KeyQ", key: "q", keyCode: 81, ...overrides }))).toBe(false);
  });
});

describe("getTokenShortcutIndex", () => {
  it.each([
    ["Digit1", 1],
    ["Digit9", 9],
    ["Numpad4", 4],
  ])("maps %s to %i", (code, index) => {
    expect(getTokenShortcutIndex(keyEvent({ code, altKey: true }))).toBe(index);
  });

  it.each([
    ["zero has no token slot", { code: "Digit0", altKey: true }],
    ["without Alt", { code: "Digit1" }],
    ["with Shift (symbols on Ukrainian layout)", { code: "Digit1", altKey: true, shiftKey: true }],
    ["with Ctrl", { code: "Digit1", altKey: true, ctrlKey: true }],
    ["a letter", { code: "KeyA", altKey: true }],
  ])("ignores %s", (_, overrides) => {
    expect(getTokenShortcutIndex(keyEvent(overrides))).toBeNull();
  });
});
