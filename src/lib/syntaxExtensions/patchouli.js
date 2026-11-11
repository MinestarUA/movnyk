// Patchouli guide books: "$(...)" codes up to the first ")" on the same line.
// Arguments such as tooltips or commands may contain spaces, so the body is
// not restricted. Unlike "§" codes, a colour does not clear decorations.
// Aliases are Patchouli's default macros.

import { DECORATIONS, MC_COLORS, PLAIN_STYLE } from "../mcFormatting";

const COLOR_ALIASES = {
  nocolor: MC_COLORS[0],
  item: "#bb00bb",
  thing: "#449900",
};

const DECORATION_ALIASES = {
  obf: "k",
  bold: "l",
  strike: "m",
  italic: "o",
  italics: "o",
};

const RESETS = new Set(["", "reset", "clear"]);

const LINE_BREAK_CODE = /^\$\((?:br|br2|2br|p)\)$/i;

const expandShortHex = (hex) =>
  hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;

const bodyOf = (code) => code.slice(2, -1).toLowerCase();

// Colour set by a code such as "$(thing)" or "$(#f00)"; null for decoration,
// reset and structural codes.
const colorOf = (code) => {
  const body = bodyOf(code);
  if (body in COLOR_ALIASES) return COLOR_ALIASES[body];
  const hex = body.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) return `#${expandShortHex(hex[1])}`;
  return MC_COLORS[body] ?? null;
};

const applyStyle = (style, code) => {
  const body = bodyOf(code);
  if (RESETS.has(body)) return PLAIN_STYLE;
  const color = colorOf(code);
  if (color) return { ...style, color };
  const codeChar = DECORATION_ALIASES[body] ?? body;
  if (codeChar in DECORATIONS) return { ...style, [DECORATIONS[codeChar]]: true };
  // Structural or interactive codes ($(br), $(li), $(l:url), ...) keep the style.
  return style;
};

export default {
  id: "patchouli",
  label: "Patchouli",
  description: "Коди книг Patchouli: $(l), $(#f80), $(br), $(l:посилання)…",
  promptHint: 'Patchouli codes like "$(l)", "$()", "$(br)" and "$(l:url)" must be kept exactly.',
  pattern: String.raw`\$\([^)\n]*\)`,
  applyStyle,
  colorOf,
  isLineBreak: (code) => LINE_BREAK_CODE.test(code),
  // The "$(" grammar is distinctive, so a single string is enough.
  detect: (entries) => entries.some(([, value]) => /\$\([^)\n]*\)/.test(value)),
};
