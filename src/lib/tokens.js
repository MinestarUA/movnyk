// Tokenizer for Minecraft localization strings.
// Identifies Minecraft formatting codes (§a, &c), escape sequences (\n, \t),
// and format specifiers/placeholders (%s, %1$s, {0}, {name}, etc.) so they can
// be visually distinguished, guarded, and inserted into translations with 1 click.

// Regex matching known formatting codes and placeholder patterns:
// 1. Minecraft color/format code: §[0-9a-fk-orA-FK-OR] or &[0-9a-fk-orA-FK-OR]
// 2. Escape sequences: \n, \r, \t, \\, \"
// 3. Positional printf specifiers: %1$s, %2$d, etc.
// 4. Standard printf specifiers: %s, %d, %f, %.2f, %10s, etc.
// 5. Named/indexed braces: {0}, {1}, {name}, {{name}}
// 6. Percent variables: %variable%, %(key)s
// 7. Bracketed placeholders: <player>, [count]
const TOKEN_PATTERN =
  /(?:(?:§|&)[0-9a-fk-orA-FK-OR])|(?:\\[nrt\\"])|(?:%[0-9]+\$[a-zA-Z])|(?:%[-+0 #]*\d*(?:\.\d+)?[a-zA-Z%])|(?:\{\{\s*[\w.-]+\s*\}\})|(?:\{[\w.-]+\})|(?:%\([\w.-]+\)[a-zA-Z])|(?:%[\w.-]+%)|(?:<[\w.-]+>)|(?:\[[\w.-]+\])/g;

export const classifyToken = (token) => {
  if (/^(?:§|&)[0-9a-fk-orA-FK-OR]$/.test(token)) {
    return "mc-code";
  }
  if (/^\\[nrt\\"]$/.test(token)) {
    return "escape";
  }
  return "placeholder";
};

// Splits a string into text chunks and token objects.
// Returns: Array<{ type: 'text' | 'mc-code' | 'escape' | 'placeholder', value: string }>
export const tokenizeString = (text) => {
  if (!text) return [];
  const str = String(text);
  const result = [];
  let lastIndex = 0;
  let match;

  const regex = new RegExp(TOKEN_PATTERN.source, "g");

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        type: "text",
        value: str.slice(lastIndex, match.index),
      });
    }
    const tokenVal = match[0];
    result.push({
      type: classifyToken(tokenVal),
      value: tokenVal,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < str.length) {
    result.push({
      type: "text",
      value: str.slice(lastIndex),
    });
  }

  return result;
};

// Extracts unique non-text tokens from a string in order of appearance.
export const extractTokens = (text) => {
  const tokens = tokenizeString(text).filter((t) => t.type !== "text");
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
