import { useMemo } from "react";
import { formatRuns, mcStyleToCss, colorOfCode } from "../lib/mcFormatting";
import { splitMatches } from "../lib/searching";

const wsMarkStyle = {
  background: "color-mix(in srgb, var(--color-accent) 22%, transparent)",
  borderRadius: "2px",
  color: "var(--color-accent-700)",
  fontSize: "10px",
  lineHeight: "inherit",
};

const renderWhitespaceRun = (run, keyPrefix) =>
  [...run].map((ch, i) => {
    const key = `${keyPrefix}-${i}`;
    if (ch === "\n") {
      return (
        <span key={key}>
          <span style={wsMarkStyle}>↵</span>
          {"\n"}
        </span>
      );
    }
    return (
      <span key={key} style={wsMarkStyle}>
        ·
      </span>
    );
  });

const PLACEHOLDER_COLOR = "var(--color-accent-400)";

const matchRanges = (text, queryRe) => {
  const ranges = [];
  let offset = 0;
  for (const chunk of splitMatches(text, queryRe)) {
    if (chunk.isMatch) ranges.push([offset, offset + chunk.text.length]);
    offset += chunk.text.length;
  }
  return ranges;
};

// Cuts [start, end) at every boundary that falls inside it.
const splitAtBoundaries = (start, end, boundaries) => {
  const cuts = boundaries.filter((b) => b > start && b < end).sort((a, b) => a - b);
  const pieces = [];
  let from = start;
  for (const cut of [...cuts, end]) {
    if (cut > from) pieces.push([from, cut]);
    from = cut;
  }
  return pieces;
};

const isInside = (ranges, position) => ranges.some(([from, to]) => position >= from && position < to);

const renderDefaultToken = (run, css, key) => {
  const tokenColor = run.token.type === "mc-code" ? colorOfCode(run.token.value) : null;
  const tokenCss = tokenColor ? { color: tokenColor, ...css } : css;
  return (
    <span
      key={key}
      style={
        run.token.type === "mc-code"
          ? tokenCss
          : { color: PLACEHOLDER_COLOR, ...css }
      }
    >
      {run.token.value}
    </span>
  );
};

// Renders text the way Minecraft would format it, with optional search
// highlighting and whitespace markers. Tokens are drawn by `renderToken`
// (e.g. clickable chips) or, by default, as tinted inline text.
const FormattedText = ({
  text,
  queryRe = null,
  showWhitespace = false,
  widthNeutral = false,
  renderToken = renderDefaultToken,
}) => {
  const str = String(text ?? "");
  const runs = useMemo(() => formatRuns(str), [str]);
  const matches = useMemo(() => matchRanges(str, queryRe), [str, queryRe]);
  const matchBoundaries = matches.flat();

  return runs.map((run, runIdx) => {
    const css = mcStyleToCss(run.style, { widthNeutral });
    if (run.token) return renderToken(run, css, runIdx);

    const runText = str.slice(run.start, run.end);
    const lead = showWhitespace ? (runText.match(/^\s+/) || [""])[0].length : 0;
    const trail = showWhitespace ? (runText.match(/\s+$/) || [""])[0].length : 0;
    const coreStart = run.start + lead;
    const coreEnd = Math.max(coreStart, run.end - trail);
    const pieces = splitAtBoundaries(run.start, run.end, [coreStart, coreEnd, ...matchBoundaries]);

    return (
      <span key={runIdx} style={css}>
        {pieces.map(([from, to]) => {
          const piece = str.slice(from, to);
          const key = `${runIdx}-${from}`;
          if (from < coreStart || from >= coreEnd) return <span key={key}>{renderWhitespaceRun(piece, key)}</span>;
          if (!isInside(matches, from)) return <span key={key}>{piece}</span>;
          return (
            <mark
              key={key}
              className="bg-yellow-400/35 text-yellow-200 px-0.5 rounded font-semibold"
              style={css.color ? { color: "inherit" } : undefined}
            >
              {piece}
            </mark>
          );
        })}
      </span>
    );
  });
};

export default FormattedText;
