import { createTranslationObject } from "./exporting";

// [first, last, format]; row id = last. Newest last. A format with a minor
// part is [major, minor]; min/max_format accept that form.
// Formats verified against minecraft.wiki/w/Pack_format.
export const RESOURCE_PACK_FORMATS = [
  ["1.16.2", "1.16.5", 6], ["1.17", "1.17.1", 7], ["1.18", "1.18.2", 8],
  ["1.19", "1.19.2", 9], ["1.19.3", "1.19.3", 12], ["1.19.4", "1.19.4", 13],
  ["1.20", "1.20.1", 15], ["1.20.2", "1.20.2", 18], ["1.20.3", "1.20.4", 22],
  ["1.20.5", "1.20.6", 32], ["1.21", "1.21.1", 34], ["1.21.2", "1.21.3", 42],
  ["1.21.4", "1.21.4", 46], ["1.21.5", "1.21.5", 55], ["1.21.6", "1.21.6", 63],
  ["1.21.7", "1.21.8", 64], ["1.21.9", "1.21.10", 69], ["1.21.11", "1.21.11", 75],
  ["26.1", "26.1.2", 84], ["26.2", "26.2", 88], ["26.3", "26.3", [97, 1]],
];
export const DEFAULT_MC_VERSION = "1.20.1";

// Numeric, not lexicographic: "1.21.10" > "1.21.9"; "1.20" == "1.20.0".
const compareVersions = (a, b) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
};

export const versionRowFor = (version) => {
  const row = RESOURCE_PACK_FORMATS.find(
    ([first, last]) => compareVersions(first, version) <= 0 && compareVersions(version, last) <= 0
  );
  if (!row) return null;
  const [first, last, format] = row;
  return { id: last, label: first === last ? first : `${first}–${last}`, format };
};

// Formats >= 65 (1.21.9+, 25w31a) use min/max_format; older only pack_format.
export const packMcmeta = (format, description) =>
  [format].flat()[0] >= 65
    ? { pack: { description, min_format: format, max_format: format } }
    : { pack: { pack_format: format, description } };

// The minecraft dependency block, not the first versionRange (neoforge/forge usually comes first).
const tomlMinecraftRange = (toml) => {
  for (const block of toml.split(/^\s*\[\[/m)) {
    if (/^\s*modId\s*=\s*["']minecraft["']/m.test(block)) {
      return block.match(/^\s*versionRange\s*=\s*["']([^"']*)["']/m)?.[1] ?? null;
    }
  }
  return null;
};

const firstVersion = (text) => text?.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? null;

const fabricMinecraftRange = (fabricModJson) => {
  try {
    const dependency = JSON.parse(fabricModJson)?.depends?.minecraft;
    return [dependency].flat().find((range) => typeof range === "string") ?? null;
  } catch {
    return null;
  }
};

// Inputs are raw file texts or null. Returns a row id or null.
export const inferMinecraftVersion = ({ modsToml = null, fabricModJson = null }) => {
  const range = (modsToml && tomlMinecraftRange(modsToml)) || (fabricModJson && fabricMinecraftRange(fabricModJson));
  const version = firstVersion(range);
  return version ? (versionRowFor(version)?.id ?? null) : null;
};

export const guessNamespace = (source, keys) => {
  const fromPath = source?.match(/assets\/([a-z0-9_.-]+)\/lang\//)?.[1];
  if (fromPath) return fromPath;
  const counts = new Map();
  for (const key of keys) {
    const namespace = key.split(".")[1];
    if (namespace) counts.set(namespace, (counts.get(namespace) ?? 0) + 1);
  }
  const [mostCommon] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  return mostCommon ?? "minecraft";
};

export const defaultPack = (sessionName, keys) => ({
  namespace: guessNamespace(sessionName, keys),
  mcVersion: DEFAULT_MC_VERSION,
  language: "uk_ua",
});

export const packTitle = (sessionName) => sessionName.split(" · ")[0].replace(/\.(jar|json)$/i, "");

export const packFileBase = (sessionName) => {
  const base = packTitle(sessionName).replace(/[^\p{L}\p{N}._-]+/gu, "_");
  return /[\p{L}\p{N}]/u.test(base) ? base : "movnyk";
};

// Messages keyed by field; empty when the pack is valid.
export const validatePack = ({ namespace, language }) => {
  const errors = {};
  if (!/^[a-z0-9_.-]+$/.test(namespace)) {
    errors.namespace = "Лише малі латинські літери, цифри та _ . -";
  }
  if (language === "en_us") {
    errors.language = "Код мови не може бути en_us — це перезапише англійський оригінал.";
  } else if (!/^[a-z]{2,3}_[a-z]{2,4}$/.test(language)) {
    errors.language = "Код мови має вигляд uk_ua";
  }
  return errors;
};

const toJson = (value) => JSON.stringify(value, null, 2);

export const buildResourcePackFiles = ({ translations, pack, description }) => {
  const files = {
    "pack.mcmeta": toJson(packMcmeta(versionRowFor(pack.mcVersion).format, description)),
  };
  const langObject = createTranslationObject(translations);
  if (Object.keys(langObject).length > 0) {
    files[`assets/${pack.namespace}/lang/${pack.language}.json`] = toJson(langObject);
  }
  return { files };
};
