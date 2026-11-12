// GuideME guide pages (Markdown with JSX tags). Only used for rows read from a
// guide page, never from lang files, so it cannot be enabled or detected.

import { emphasis } from "./markdown";

const ATTRS = String.raw`(?:\s(?:"[^"\n]*"|'[^'\n]*'|\{[^}\n]*\}|[^"'{}<>\n])*)?`;
const TAG = String.raw`<\/?[A-Za-z][\w.:-]*${ATTRS}\/?>`;
const COMMENT = String.raw`\{\/\*[\s\S]*?\*\/\}`;
const IMAGE = String.raw`!\[[^\]\n]*\]\([^)\n]*\)`;
const TARGET = String.raw`[^)\s]+(?:\s+"[^"\n]*")?`;
const LINK_OPEN = String.raw`\[(?=[^\]\n]*\]\(${TARGET}\))`;
const LINK_CLOSE = String.raw`\]\(${TARGET}\)`;
// "[label][ref]" keeps its label translatable. "[label][]" uses the label as
// the reference id, so translating it would break the link: it stays whole,
// like images.
const IMAGE_REF = String.raw`!\[[^\]\n]*\]\[[^\]\n]*\]`;
const COLLAPSED_REF = String.raw`\[[^\]\n]*\]\[\]`;
const REF_OPEN = String.raw`\[(?=[^\]\n]*\]\[[^\]\n]+\])`;
const REF_CLOSE = String.raw`\]\[[^\]\n]+\]`;
const CODE = "`[^`\\n]+`";
// \x60 is a backtick: a backslash before a bare backtick is an invalid escape under the u flag.
const ESCAPE = String.raw`\\[\\\x60*_{}\[\]()#+\-.!|<>~]`;

const COLOR_OPEN = /^<Color\s[^>]*\bcolor=["']#([0-9A-Fa-f]{6})["']/;
const BREAK_TAG = /^<br[\s/>]/i;

// A translation that starts like a Markdown block turns the paragraph into a
// heading, list or quote.
const BLOCK_START = /^\s{0,3}(?:#{1,6}(?:\s|$)|[-+*](?:\s|$)|\d{1,9}[.)](?:\s|$)|>|```|~~~)/;

export default {
  id: "guideme",
  label: "GuideME",
  description: 'Markdown посібників GuideME: <ItemLink id="…" />, [назва](сторінка.md), **жирний**.',
  promptHint:
    "GuideME Markdown: keep JSX tags such as \"<ItemLink id=\"x\" />\" and \"<Color id=\"y\">…</Color>\", link targets \"](page.md)\", \"**\", \"`code`\" and backslash escapes exactly; translate link labels and the text between tags.",
  hidden: true,
  pattern: [
    COMMENT,
    IMAGE,
    IMAGE_REF,
    TAG,
    COLLAPSED_REF,
    LINK_OPEN,
    REF_OPEN,
    LINK_CLOSE,
    REF_CLOSE,
    CODE,
    ESCAPE,
    emphasis(String.raw`\*{1,3}`, "*"),
    emphasis("~~", "~"),
  ].join("|"),
  toggles: {
    "***": { bold: true, italic: true },
    "**": { bold: true },
    "*": { italic: true },
    "~~": { strikethrough: true },
  },
  applyStyle: (style, code) => {
    if (code === "</Color>") return { ...style, color: null };
    const hex = code.match(COLOR_OPEN);
    return hex ? { ...style, color: `#${hex[1].toLowerCase()}` } : style;
  },
  colorOf: (code) => {
    const hex = code.match(COLOR_OPEN);
    return hex ? `#${hex[1].toLowerCase()}` : null;
  },
  isLineBreak: (code) => BREAK_TAG.test(code),
  detect: () => false,
  checks: (original, translated) =>
    BLOCK_START.test(translated) && !BLOCK_START.test(original)
      ? [
          {
            id: "markdown-block-start",
            message: "Такий початок рядка перетворить абзац на заголовок, список або цитату Markdown",
            severity: "warning",
          },
        ]
      : [],
};
