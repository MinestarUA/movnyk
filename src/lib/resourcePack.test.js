import { describe, expect, it } from "vitest";
import { inferMinecraftVersion, packMcmeta, versionRowFor } from "./resourcePack";

describe("versionRowFor", () => {
  it.each([
    ["1.20", 15],
    ["1.21.10", 69],
    ["26.1.2", 84],
    ["1.12.2", null],
  ])("%s -> format %s", (version, format) => {
    expect(versionRowFor(version)?.format ?? null).toBe(format);
  });
});

describe("packMcmeta", () => {
  it("uses only pack_format before 1.21.9", () => {
    expect(packMcmeta(34, "d").pack).toEqual({ pack_format: 34, description: "d" });
  });

  it("uses min/max_format from 1.21.9", () => {
    expect(packMcmeta(69, "d").pack).toEqual({ description: "d", min_format: 69, max_format: 69 });
  });
});

describe("inferMinecraftVersion", () => {
  const neoforgeToml = `
[[dependencies.mymod]]
modId = "neoforge"
versionRange = "[21.1.1,)"

[[dependencies.mymod]]
modId = "minecraft"
versionRange = "[1.21.1,1.21.2)"
`;
  const fabric = (minecraft) => JSON.stringify({ depends: { minecraft } });

  it.each([
    ["neoforge block before the minecraft block", { modsToml: neoforgeToml }, "1.21.1"],
    ["fabric tilde range", { fabricModJson: fabric("~1.20.1") }, "1.20.1"],
    ["fabric array range", { fabricModJson: fabric([">=1.21"]) }, "1.21.1"],
    ["fabric wildcard", { fabricModJson: fabric("1.21.x") }, "1.21.1"],
    ["no metadata", {}, null],
  ])("%s", (_name, input, expected) => {
    expect(inferMinecraftVersion(input)).toBe(expected);
  });
});
