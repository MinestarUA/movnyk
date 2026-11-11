// Create's item tooltips (TooltipHelper): every "_" flips the highlight
// colour and is not drawn, so "_Sneak-Click_" is highlighted. An "_" between
// two letters/digits is snake_case and stays text, unless the letter before it
// ends a code or specifier ("§a_Text_", "%s_").

const HIGHLIGHT = { color: "#F1DD79" };

const TOOLTIP_KEY = /\.tooltip\.(?:summary|behaviour\d+|action\d+)$/;
const HIGHLIGHT_PAIR = /(?<![\p{L}\p{N}_])_[^\s_][^_]*_(?![\p{L}\p{N}_])/u;

export default {
  id: "create",
  label: "Create",
  description: "Підсвічування в підказках Create: _Shift-клік_.",
  promptHint: 'Underscores marking highlighted words, as in "_Sneak-Click_", must surround the translated words and stay paired.',
  pattern: String.raw`(?<![\p{L}\p{N}_])_|_(?![\p{L}\p{N}_])|(?<=[§&][0-9a-fk-orA-FK-OR]|%(?:\d+\$)?[a-zA-Z])_`,
  toggles: { _: HIGHLIGHT },
  colorOf: () => HIGHLIGHT.color,
  detect: (entries) => {
    const tooltips = entries.filter(([key]) => TOOLTIP_KEY.test(key));
    return tooltips.length >= 10 && tooltips.filter(([, value]) => HIGHLIGHT_PAIR.test(value)).length >= 5;
  },
};
