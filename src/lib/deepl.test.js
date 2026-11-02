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

    expect(shielded).toBe('Diamond sword: <x id="0"/><x id="1"/> damage!<x id="2"/><x id="3"/>');

    // Simulate DeepL translating the surrounding text:
    const mockTranslated =
      'Алмазний меч: <x id="0"/><x id="1"/> шкоди!<x id="2"/><x id="3"/>';
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

  it("keeps a translated word that DeepL wrapped inside a placeholder tag", () => {
    const { tokenMap } = shieldTokens("§aSpeed Boost");
    const mockTranslated = '<x id="0">Прискорення</x> &amp; швидкості';
    expect(unshieldTokens(mockTranslated, tokenMap)).toBe("§aПрискорення & швидкості");
  });
});
