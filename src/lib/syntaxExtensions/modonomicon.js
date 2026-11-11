// Modonomicon books (markdown, e.g. Occultism's Dictionary of Spirits):
// emphasis toggles, "[#](RRGGBB)…[#]()" colours, "[label](entry://…)" links
// and a "\" before a line break as a hard break. Link labels stay translatable.

const LINK = String.raw`(?:item|entry|command|patchouli|https?):\/\/[^)\s]*`;

// An emphasis run counts only where it opens (nothing word-like before,
// non-space after) or closes (non-space before, nothing word-like after), so
// "* bullet", "2 * 3" and "2*3" stay text. "C++" is a known false closer.
const emphasis = (marker, char) =>
  String.raw`(?<![\p{L}\p{N}${char}])${marker}(?=[^\s${char}])|(?<=[^\s${char}])${marker}(?![\p{L}\p{N}${char}])`;

const COLOR_CODE = /^\[#\]\(([0-9A-Fa-f]{6})\)$/;
const COLOR_RESET = "[#]()";

const applyStyle = (style, code) => {
  if (code === COLOR_RESET) return { ...style, color: null };
  const hex = code.match(COLOR_CODE);
  return hex ? { ...style, color: `#${hex[1].toLowerCase()}` } : style;
};

const MARKUP = /\[#\]\([0-9A-Fa-f]{6}\)|\]\((?:item|entry):\/\//;

export default {
  id: "modonomicon",
  label: "Modonomicon",
  description: "Markdown у книгах Modonomicon: **жирний**, *курсив*, [#](ff0000)колір[#](), [назва](entry://…).",
  promptHint:
    'Markdown markup ("**", "*", "++", "~~", "[#](RRGGBB)", "[#]()", "[label](entry://…)") must be kept; translate only link labels and text.',
  pattern: [
    String.raw`\[#\]\([0-9A-Fa-f]{6}\)`,
    String.raw`\[#\]\(\)`,
    String.raw`\[\]\(${LINK}\)`,
    String.raw`\[(?=[^\]\n]*\]\(${LINK}\))`,
    String.raw`\]\(${LINK}\)`,
    String.raw`\\(?=\n)`,
    emphasis(String.raw`\*{1,3}`, String.raw`*`),
    emphasis(String.raw`\+\+`, String.raw`+`),
    emphasis("~~", "~"),
  ].join("|"),
  toggles: {
    "***": { bold: true, italic: true },
    "**": { bold: true },
    "*": { italic: true },
    "++": { underline: true },
    "~~": { strikethrough: true },
  },
  applyStyle,
  colorOf: (code) => {
    const hex = code.match(COLOR_CODE);
    return hex ? `#${hex[1].toLowerCase()}` : null;
  },
  isLineBreak: (code) => code === "\\",
  detect: (entries) =>
    entries.filter(([key]) => key.startsWith("book.")).length >= 3 &&
    entries.filter(([, value]) => MARKUP.test(value)).length >= 3,
};
