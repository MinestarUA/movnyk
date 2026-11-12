// Optional syntax extensions: mod-specific markup inside lang values. Each is
// off unless the user enables it or (with auto-detect on) the opened file
// uses it. Detection is per file and never written to settings.
//
// An extension is { id, label, description, promptHint, pattern, detect } plus
// optional styling: `applyStyle(style, code)` for set/reset codes, `toggles`
// ({ marker: partialStyle }) for paired markers, `colorOf(code)` for chip
// colours and `isLineBreak(code)`, and an optional `checks(original,
// translated)` returning extra QA issues. A `hidden` extension is not offered
// in settings. `pattern` is a regex source with only
// non-capturing groups, compiled with the "u" flag.

import { compileSyntax, CORE_SYNTAX } from "../tokens";
import patchouli from "./patchouli";
import malum from "./malum";
import create from "./create";
import modonomicon from "./modonomicon";
import guideme from "./guideme";

export const SYNTAX_EXTENSIONS = [patchouli, malum, create, modonomicon, guideme];

export const SYNTAX_EXTENSION_IDS = SYNTAX_EXTENSIONS.map((extension) => extension.id);

export const detectSyntaxExtensions = (template) => {
  const entries = Object.entries(template ?? {}).filter(([, value]) => typeof value === "string");
  return SYNTAX_EXTENSIONS.filter((extension) => extension.detect(entries)).map((extension) => extension.id);
};

// Hidden extensions apply to their own rows only, whatever the settings hold.
const SELECTABLE_IDS = SYNTAX_EXTENSIONS.filter((extension) => !extension.hidden).map((extension) => extension.id);

export const activeSyntaxIds = (settings, detectedIds) => {
  const enabled = SELECTABLE_IDS.filter((id) => settings.syntaxExtensions?.[id] === true);
  if (settings.syntaxAutoDetect === false) return enabled;
  return SYNTAX_EXTENSION_IDS.filter((id) => enabled.includes(id) || detectedIds.includes(id));
};

// Cached per id set so the same active set is always the same object: it is a
// memo dependency and a cache key elsewhere. Compiled in registry order.
const compiled = new Map([["", CORE_SYNTAX]]);

export const getSyntax = (ids) => {
  const extensions = SYNTAX_EXTENSIONS.filter((extension) => ids.includes(extension.id));
  const key = extensions.map((extension) => extension.id).join(",");
  if (!compiled.has(key)) compiled.set(key, compileSyntax(extensions));
  return compiled.get(key);
};
