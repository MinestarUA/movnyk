import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT, systemPromptFor } from "./gemini";
import { getSyntax } from "./syntaxExtensions";
import { CORE_SYNTAX } from "./tokens";

describe("systemPromptFor", () => {
  it("adds a rule per active extension and nothing without one", () => {
    expect(systemPromptFor(CORE_SYNTAX)).toBe(SYSTEM_PROMPT);
    const prompt = systemPromptFor(getSyntax(["malum", "create"]));
    expect(prompt).toContain(getSyntax(["malum"]).byId.malum.promptHint);
    expect(prompt).toContain(getSyntax(["create"]).byId.create.promptHint);
  });
});
