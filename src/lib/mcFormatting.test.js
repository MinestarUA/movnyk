import { describe, expect, it } from "vitest";
import { formatRuns, MC_COLORS } from "./mcFormatting";

const textOf = (text, run) => text.slice(run.start, run.end);

describe("formatRuns", () => {
  it("returns a single plain run for unformatted text", () => {
    const runs = formatRuns("Hello");
    expect(runs).toHaveLength(1);
    expect(runs[0].token).toBeNull();
    expect(runs[0].style.color).toBeNull();
  });

  it("colours the code itself and the text after it", () => {
    const text = "Hi §cred";
    const runs = formatRuns(text);
    expect(runs.map((r) => textOf(text, r))).toEqual(["Hi ", "§c", "red"]);
    expect(runs[0].style.color).toBeNull();
    expect(runs[1].style.color).toBe(MC_COLORS.c);
    expect(runs[2].style.color).toBe(MC_COLORS.c);
  });

  it("stacks decorations and resets them on a colour code", () => {
    const text = "§lbold§oboth§aplain";
    const runs = formatRuns(text);
    const both = runs.find((r) => textOf(text, r) === "both");
    expect(both.style.bold).toBe(true);
    expect(both.style.italic).toBe(true);
    const plain = runs.find((r) => textOf(text, r) === "plain");
    expect(plain.style.bold).toBe(false);
    expect(plain.style.color).toBe(MC_COLORS.a);
  });

  it("resets everything on §r and accepts upper-case codes", () => {
    const text = "§Ccol§Ln§rx";
    const runs = formatRuns(text);
    expect(runs.find((r) => textOf(text, r) === "col").style.color).toBe(MC_COLORS.c);
    expect(runs.find((r) => textOf(text, r) === "n").style.bold).toBe(true);
    const reset = runs.find((r) => textOf(text, r) === "x");
    expect(reset.style.color).toBeNull();
    expect(reset.style.bold).toBe(false);
  });

  it("applies decoration only when it follows the colour code", () => {
    const boldThenColor = formatRuns("§l§aX").at(-1).style;
    expect(boldThenColor).toMatchObject({ color: MC_COLORS.a, bold: false });
    const colorThenBold = formatRuns("§a§lX").at(-1).style;
    expect(colorThenBold).toMatchObject({ color: MC_COLORS.a, bold: true });
  });

  it("does not restyle text after & codes", () => {
    const text = "R&D &cnot red";
    const runs = formatRuns(text);
    expect(runs.every((r) => r.style.color === null)).toBe(true);
  });

  it("keeps placeholders as tokens without changing style", () => {
    const text = "§e%s items";
    const runs = formatRuns(text);
    const placeholder = runs.find((r) => textOf(text, r) === "%s");
    expect(placeholder.token.type).toBe("placeholder");
    expect(placeholder.style.color).toBe(MC_COLORS.e);
  });
});
