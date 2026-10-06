import { describe, expect, it } from "vitest";
import {
  buildDeepLUrl,
  DEFAULT_CORS_PROXY,
  getDeepLEndpoint,
  shieldTokens,
  unshieldTokens,
} from "./deepl";

describe("deepl", () => {
  it("detects Free endpoint for :fx keys and Pro for standard keys", () => {
    expect(getDeepLEndpoint("abc:fx")).toBe("https://api-free.deepl.com/v2/translate");
    expect(getDeepLEndpoint("abc-pro-key")).toBe("https://api.deepl.com/v2/translate");
  });

  it("builds proxy URLs correctly", () => {
    const ep = "https://api.deepl.com/v2/translate";
    expect(buildDeepLUrl(ep, { useProxy: false })).toBe(ep);
    expect(buildDeepLUrl(ep, { useProxy: true })).toBe(
      `${DEFAULT_CORS_PROXY}${encodeURIComponent(ep)}`
    );
  });

  it("shields and unshields Minecraft tokens intact", () => {
    const original = "Diamond sword: §a%d damage!\\n<player>";
    const { shielded, tokenMap } = shieldTokens(original);

    expect(shielded).toContain('<x id="0">§a</x>');
    expect(shielded).toContain('<x id="1">%d</x>');
    expect(shielded).toContain('<x id="2">\\n</x>');
    expect(shielded).toContain('<x id="3"><player></x>');

    // Simulate DeepL translating the surrounding text:
    const mockTranslated = "Алмазний меч: <x id=\"0\">§a</x><x id=\"1\">%d</x> шкоди!<x id=\"2\">\\n</x><x id=\"3\"><player></x>";
    const restored = unshieldTokens(mockTranslated, tokenMap);

    expect(restored).toBe("Алмазний меч: §a%d шкоди!\\n<player>");
  });
});
