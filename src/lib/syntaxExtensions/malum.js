// Malum's Encyclopedia Arcana (ArcanaCodexHelper): "$i", "$b", "$s", "$u", "$k"
// switch a decoration on until "/$", which clears them all at once.

import { DECORATIONS } from "../mcFormatting";

const DECORATION_OF = {
  i: DECORATIONS.o,
  b: DECORATIONS.l,
  s: DECORATIONS.m,
  u: DECORATIONS.n,
  k: DECORATIONS.k,
};

const CLEARED = Object.fromEntries(Object.values(DECORATIONS).map((decoration) => [decoration, false]));

const MARKUP_PAIR = /\$[ibsuk][\s\S]*\/\$/;

export default {
  id: "malum",
  label: "Malum",
  description: "Курсив і жирний у книзі Malum: $iтекст/$, $bтекст/$.",
  promptHint: 'Malum style codes "$i", "$b", "$s", "$u", "$k" and the closing "/$" must be kept around the matching words.',
  pattern: String.raw`\$[ibsuk]|\/\$`,
  applyStyle: (style, code) =>
    code === "/$" ? { ...style, ...CLEARED } : { ...style, [DECORATION_OF[code[1]]]: true },
  detect: (entries) =>
    entries.filter(([key]) => key.startsWith("malum.")).length >= 3 &&
    entries.filter(([, value]) => MARKUP_PAIR.test(value)).length >= 2,
};
