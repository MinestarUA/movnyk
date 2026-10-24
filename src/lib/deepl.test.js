import { describe, expect, it } from "vitest";
import {
  getDeepLEndpoint,
  shieldTokens,
  unshieldTokens,
} from "./deepl";

describe("deepl", () => {
  it("detects Free endpoint for :fx keys and Pro for standard keys", () => {
    expect(getDeepLEndpoint("abc:fx")).toBe("https://api-free.deepl.com/v2/translate");
    expect(getDeepLEndpoint("abc-pro-key")).toBe("https://api.deepl.com/v2/translate");
  });

  it("shields and unshields Minecraft tokens intact", () => {
    const original = "Diamond sword: §a%d damage!\\n<player>";
    const { shielded, tokenMap } = shieldTokens(original);

    expect(shielded).toContain('<x id="0">§a</x>');
    expect(shielded).toContain('<x id="1">%d</x>');
    expect(shielded).toContain('<x id="2">\\n</x>');
    expect(shielded).toContain('<x id="3">&lt;player&gt;</x>');

    // Simulate DeepL translating the surrounding text:
    const mockTranslated =
      'Алмазний меч: <x id="0">§a</x><x id="1">%d</x> шкоди!<x id="2">\\n</x><x id="3">&lt;player&gt;</x>';
    const restored = unshieldTokens(mockTranslated, tokenMap);

    expect(restored).toBe("Алмазний меч: §a%d шкоди!\\n<player>");
  });

  it("escapes ampersands so DeepL's XML parser accepts them", () => {
    const original = "Hold the default &o tilde &r key & mine <fast>";
    const { shielded, tokenMap } = shieldTokens(original);

    expect(shielded).not.toMatch(/&(?!amp;|lt;|gt;)/);

    const mockTranslated = shielded.replace("Hold the default", "Утримуйте");
    expect(unshieldTokens(mockTranslated, tokenMap)).toBe(
      "Утримуйте &o tilde &r key & mine <fast>"
    );
  });
});
