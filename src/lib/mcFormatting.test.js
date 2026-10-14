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

  describe("Patchouli codes", () => {
    const styleAfter = (text, marker) => {
      const runs = formatRuns(text);
      return runs.find((r) => textOf(text, r) === marker).style;
    };

    it("applies colours without clearing decorations", () => {
      expect(styleAfter("$(l)$(c)X", "X")).toMatchObject({ bold: true, color: MC_COLORS.c });
      expect(styleAfter("$(#f80)X", "X").color).toBe("#ff8800");
      expect(styleAfter("$(#1A2b3C)X", "X").color).toBe("#1a2b3c");
    });

    it("distinguishes $(l)/$(k) styles from $(l:...)/$(k:...) codes", () => {
      expect(styleAfter("$(l)X", "X").bold).toBe(true);
      expect(styleAfter("$(k)X", "X").obfuscated).toBe(true);
      expect(styleAfter("$(l:https://a.b)X", "X").bold).toBe(false);
      expect(styleAfter("$(k:jump)X", "X").obfuscated).toBe(false);
    });

    it("resolves default macros", () => {
      expect(styleAfter("$(bold)X", "X").bold).toBe(true);
      expect(styleAfter("$(italics)X", "X").italic).toBe(true);
      expect(styleAfter("$(item)X", "X").color).toBe("#bb00bb");
      expect(styleAfter("$(thing)X", "X").color).toBe("#449900");
    });

    it("resets on $() and its aliases", () => {
      for (const reset of ["$()", "$(reset)", "$(clear)"]) {
        expect(styleAfter(`$(l)$(c)${reset}X`, "X")).toMatchObject({ bold: false, color: null });
      }
    });

    it("keeps the style on structural codes", () => {
      const style = styleAfter("$(c)$(br)$(li)$(/l)X", "X");
      expect(style.color).toBe(MC_COLORS.c);
    });

    it("does not treat unknown codes as styles", () => {
      expect(styleAfter("$(playername)X", "X").color).toBeNull();
    });
  });
});
