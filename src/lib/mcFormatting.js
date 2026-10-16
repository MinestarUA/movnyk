// Minecraft (Java Edition) formatting-code semantics, used to preview how a
// string will look in game. A colour code sets the colour and resets every
// decoration; k–o add a decoration; r resets everything. Only "§" is
// interpreted by the game, so "&x" (common in plain text like "R&D") never
// restyles the text that follows. Patchouli's "$(...)" codes are styled too.

import { tokenizeString } from "./tokens";

export const MC_COLORS = {
  0: "#000000",
  1: "#0000AA",
  2: "#00AA00",
  3: "#00AAAA",
  4: "#AA0000",
  5: "#AA00AA",
  6: "#FFAA00",
  7: "#AAAAAA",
  8: "#555555",
  9: "#5555FF",
  a: "#55FF55",
  b: "#55FFFF",
  c: "#FF5555",
  d: "#FF55FF",
  e: "#FFFF55",
  f: "#FFFFFF",
};

// Black is invisible on the dark editor, so it is drawn in the theme's text
// colour instead (it is the same as an unstyled run, which is how the game's
// black-on-parchment text reads there).
const BLACK = MC_COLORS[0];
const VISIBLE_BLACK = "var(--color-text)";
export const displayColor = (color) => (color === BLACK ? VISIBLE_BLACK : color);

// Converts a formatting state (or a partial one like { color }) to CSS. In the
// edit field only width-neutral styles are allowed, otherwise the preview
// drifts away from the textarea caret laid over it.
export const mcStyleToCss = (style, { widthNeutral = false } = {}) => {
  const css = {};
  if (style.color) css.color = displayColor(style.color);
  const lines = [];
  if (style.underline) lines.push("underline");
  if (style.strikethrough) lines.push("line-through");
  if (lines.length) css.textDecorationLine = lines.join(" ");
  // Real scrambling is just noise; a blur conveys "obfuscated" without it.
  if (style.obfuscated) css.filter = "blur(1.5px)";
  if (!widthNeutral) {
    if (style.bold) css.fontWeight = 700;
    if (style.italic) css.fontStyle = "italic";
  }
  return css;
};

const DECORATIONS = {
  k: "obfuscated",
  l: "bold",
  m: "strikethrough",
  n: "underline",
  o: "italic",
};

const PLAIN_STYLE = Object.freeze({
  color: null,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  obfuscated: false,
});

// Colour of a "§" formatting code such as "§c"; null for decoration codes and
// for "&" codes, which the game does not interpret.
export const colorOfCode = (code) =>
  code[0] === "§" ? (MC_COLORS[code[1].toLowerCase()] ?? null) : null;

const applyCode = (style, code) => {
  const codeChar = code[1].toLowerCase();
  if (codeChar in MC_COLORS) {
    return { ...PLAIN_STYLE, color: MC_COLORS[codeChar] };
  }
  if (codeChar in DECORATIONS) {
    return { ...style, [DECORATIONS[codeChar]]: true };
  }
  return PLAIN_STYLE;
};

// Patchouli ($(...)) codes that restyle text. Unlike "§" codes, a colour does
// not clear decorations. Aliases are Patchouli's default macros.
const PATCHOULI_COLOR_ALIASES = {
  nocolor: MC_COLORS[0],
  item: "#bb00bb",
  thing: "#449900",
};

const PATCHOULI_DECORATION_ALIASES = {
  obf: "k",
  bold: "l",
  strike: "m",
  italic: "o",
  italics: "o",
};

const PATCHOULI_RESETS = new Set(["", "reset", "clear"]);

const expandShortHex = (hex) =>
  hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;

const patchouliBody = (code) => code.slice(2, -1).toLowerCase();

// Colour set by a Patchouli code such as "$(thing)" or "$(#f00)"; null for
// decoration, reset and structural codes.
export const patchouliColorOf = (code) => {
  const body = patchouliBody(code);
  if (body in PATCHOULI_COLOR_ALIASES) return PATCHOULI_COLOR_ALIASES[body];
  const hex = body.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) return `#${expandShortHex(hex[1])}`;
  return MC_COLORS[body] ?? null;
};

const applyPatchouliCode = (style, code) => {
  const body = patchouliBody(code);
  if (PATCHOULI_RESETS.has(body)) return PLAIN_STYLE;
  const color = patchouliColorOf(code);
  if (color) return { ...style, color };
  const codeChar = PATCHOULI_DECORATION_ALIASES[body] ?? body;
  if (codeChar in DECORATIONS) return { ...style, [DECORATIONS[codeChar]]: true };
  // Structural or interactive codes ($(br), $(li), $(l:url), ...) keep the style.
  return style;
};

// Splits text into contiguous runs covering the whole string.
// Returns Array<{ start, end, token: null | { type, value }, style }>, where
// style is the formatting in effect for that run (a "§" code run already
// carries the style it switches to).
export const formatRuns = (text) => {
  const runs = [];
  let style = PLAIN_STYLE;
  let offset = 0;
  for (const part of tokenizeString(text)) {
    const start = offset;
    const end = offset + part.value.length;
    offset = end;
    if (part.type === "mc-code" && part.value[0] === "§") {
      style = applyCode(style, part.value);
    } else if (part.type === "patchouli-code") {
      style = applyPatchouliCode(style, part.value);
    }
    runs.push({
      start,
      end,
      token: part.type === "text" ? null : part,
      style,
    });
  }
  return runs;
};
