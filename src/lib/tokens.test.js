import { describe, expect, it } from "vitest";
import { classifyToken, extractTokens, tokenizeString } from "./tokens";

describe("tokens", () => {
  it("classifies token types correctly", () => {
    expect(classifyToken("§a")).toBe("mc-code");
    expect(classifyToken("&e")).toBe("mc-code");
    expect(classifyToken("\\n")).toBe("escape");
    expect(classifyToken("%s")).toBe("placeholder");
    expect(classifyToken("{0}")).toBe("placeholder");
    expect(classifyToken("{player}")).toBe("placeholder");
    expect(classifyToken("%1$s")).toBe("placeholder");
  });

  it("tokenizes mixed strings preserving text segments", () => {
    const input = "§aFound &e%d diamonds in {location}\\nNext!";
    const tokens = tokenizeString(input);

    expect(tokens).toEqual([
      { type: "mc-code", value: "§a" },
      { type: "text", value: "Found " },
      { type: "mc-code", value: "&e" },
      { type: "placeholder", value: "%d" },
      { type: "text", value: " diamonds in " },
      { type: "placeholder", value: "{location}" },
      { type: "escape", value: "\\n" },
      { type: "text", value: "Next!" },
    ]);
  });

  it("extracts unique non-text tokens", () => {
    const input = "§aLevel §a%d / %d\\n\\n§r";
    const unique = extractTokens(input);

    expect(unique.map((t) => t.value)).toEqual(["§a", "%d", "\\n", "§r"]);
  });

  it("handles empty or plain strings", () => {
    expect(tokenizeString("")).toEqual([]);
    expect(tokenizeString("Hello world")).toEqual([
      { type: "text", value: "Hello world" },
    ]);
    expect(extractTokens("Hello world")).toEqual([]);
  });

  it("tokenizes Patchouli codes, including arguments with spaces", () => {
    const input = "$(l)Bold$() $(l:https://a.b/c)link$(/l) $(t:Some tip)hover$(/t) $(#f80)x";
    const codes = tokenizeString(input)
      .filter((t) => t.type === "patchouli-code")
      .map((t) => t.value);

    expect(codes).toEqual([
      "$(l)",
      "$()",
      "$(l:https://a.b/c)",
      "$(/l)",
      "$(t:Some tip)",
      "$(/t)",
      "$(#f80)",
    ]);
    expect(classifyToken("$(br)")).toBe("patchouli-code");
  });

  it("does not treat a lone dollar sign as a Patchouli code", () => {
    expect(extractTokens("Costs $5 (cheap)")).toEqual([]);
  });
});
