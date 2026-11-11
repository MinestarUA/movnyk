// Tokenizer for Minecraft localization strings.
// Identifies Minecraft formatting codes (§a, &c), escape sequences (\n, \t)
// and format specifiers/placeholders (%s, %1$s, {0}, {name}, etc.) so they can
// be visually distinguished, guarded, and inserted into translations with 1 click.
// Mod-specific markup (Patchouli, Malum, ...) comes from syntax extensions, see
// ./syntaxExtensions; a compiled "syntax" is the core grammar plus the active ones.

// Core alternatives:
// 1. Minecraft color/format code: §[0-9a-fk-orA-FK-OR] or &[0-9a-fk-orA-FK-OR]
// 2. Escape sequences: \n, \r, \t, \\, \"
// 3. Positional printf specifiers: %1$s, %2$d, etc.
// 4. Standard printf specifiers: %s, %d, %f, %.2f, %10s, etc. The space flag
//    is omitted: "35% Fall" would otherwise read "% F" as a specifier.
// 5. Named/indexed braces: {0}, {1}, {name}, {{name}}
// 6. Percent variables: %variable%, %(key)s
// 7. Bracketed placeholders: <player>, [count]
const CORE_PATTERN =
  /(?:(?:§|&)[0-9a-fk-orA-FK-OR])|(?:\\[nrt\\"])|(?:%[0-9]+\$[a-zA-Z])|(?:%[-+0#]*\d*(?:\.\d+)?[a-zA-Z%])|(?:\{\{\s*[\w.-]+\s*\}\})|(?:\{[\w.-]+\})|(?:%\([\w.-]+\)[a-zA-Z])|(?:%[\w.-]+%)|(?:<[\w.-]+>)|(?:\[[\w.-]+\])/
    .source;

export const classifyToken = (token) => {
  if (/^(?:§|&)[0-9a-fk-orA-FK-OR]$/.test(token)) {
    return "mc-code";
  }
  if (/^\\[nrt\\"]$/.test(token)) {
    return "escape";
  }
  return "placeholder";
};

// Extension alternatives come first so that, at the same start index, a
// mod's token wins over a core one ("[Label](entry://...)" is a link part, not
// a "[x]" placeholder). The leftmost match still wins overall, which keeps
// "%1$s" a printf specifier rather than Malum's "$s".
// Extension patterns may only use non-capturing groups: group N identifies
// extension N.
export const compileSyntax = (extensions) => {
  const groups = extensions.map((extension) => `(${extension.pattern})`);
  return {
    extensions,
    byId: Object.fromEntries(extensions.map((extension) => [extension.id, extension])),
    regex: new RegExp([...groups, CORE_PATTERN].join("|"), "gu"),
  };
};

export const CORE_SYNTAX = compileSyntax([]);

const tokenOf = (match, syntax) => {
  const groupIndex = syntax.extensions.findIndex((_, i) => match[i + 1] !== undefined);
  if (groupIndex === -1) return { type: classifyToken(match[0]), value: match[0] };
  return { type: "syntax-code", syntax: syntax.extensions[groupIndex].id, value: match[0] };
};

// Splits a string into text chunks and token objects.
// Returns: Array<{ type: 'text' | 'mc-code' | 'escape' | 'placeholder' | 'syntax-code', value: string, syntax?: string }>
// where `syntax` is the id of the extension that owns a 'syntax-code' token.
export const tokenizeString = (text, syntax = CORE_SYNTAX) => {
  if (!text) return [];
  const str = String(text);
  const result = [];
  let lastIndex = 0;
  const regex = new RegExp(syntax.regex);

  for (const match of str.matchAll(regex)) {
    if (match.index > lastIndex) {
      result.push({ type: "text", value: str.slice(lastIndex, match.index) });
    }
    result.push(tokenOf(match, syntax));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < str.length) {
    result.push({ type: "text", value: str.slice(lastIndex) });
  }

  return result;
};

// Extracts unique non-text tokens from a string in order of appearance.
export const extractTokens = (text, syntax = CORE_SYNTAX) => {
  const tokens = tokenizeString(text, syntax).filter((t) => t.type !== "text");
  const unique = [];
  const seen = new Set();
  for (const t of tokens) {
    if (!seen.has(t.value)) {
      seen.add(t.value);
      unique.push(t);
    }
  }
  return unique;
};
