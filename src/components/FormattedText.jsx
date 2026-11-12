import { useMemo } from "react";
import { formatRuns, mcStyleToCss, colorOfCode } from "../lib/mcFormatting";
import { splitMatches } from "../lib/searching";
import { CORE_SYNTAX } from "../lib/tokens";

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

const rangeAt = (ranges, position) => ranges.find(([from, to]) => position >= from && position < to);

const SEARCH_MARK = "bg-yellow-400/35 text-yellow-200 px-0.5 rounded font-semibold";
const REPLACED_MARK = "bg-success/25 text-success px-0.5 rounded font-semibold";

// A deletion leaves nothing to highlight, so its position gets a marker that
// names what was removed.
const DeletionMarkers = ({ deletions }) =>
  deletions.map(({ original }, i) => (
    <span
      key={i}
      title={`Видалено: ${original}`}
      aria-label={`Видалено: ${original}`}
      className="mx-px inline-block h-[1em] w-0.5 rounded bg-error align-text-bottom"
    />
  ));

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
  changes = null,
  showWhitespace = false,
  widthNeutral = false,
  renderToken = renderDefaultToken,
  syntax = CORE_SYNTAX,
}) => {
  const str = String(text ?? "");
  const runs = useMemo(() => formatRuns(str, syntax), [str, syntax]);
  // Replacement previews highlight what the replacement inserted, with the
  // replaced source in a tooltip, instead of what the query matched.
  const matches = useMemo(
    () =>
      changes
        ? changes.filter(({ from, to }) => to > from).map(({ from, to, original }) => [from, to, original])
        : matchRanges(str, queryRe),
    [str, queryRe, changes]
  );
  const deletionsAt = useMemo(() => {
    const byPosition = new Map();
    for (const change of changes ?? []) {
      if (change.to > change.from) continue;
      byPosition.set(change.from, [...(byPosition.get(change.from) ?? []), change]);
    }
    return byPosition;
  }, [changes]);
  const matchBoundaries = [...matches.flatMap(([from, to]) => [from, to]), ...deletionsAt.keys()];
  const markersIn = (from, to) => {
    const deletions = [...deletionsAt].filter(([at]) => at >= from && at < to).flatMap(([, list]) => list);
    return deletions.length > 0 ? <DeletionMarkers key={`del-${from}`} deletions={deletions} /> : null;
  };
  const markersAt = (position) => markersIn(position, position + 1);
  const replacedTitle = (range) => (changes && range[2] ? `Було: ${range[2]}` : undefined);

  const rendered = runs.map((run, runIdx) => {
    const css = mcStyleToCss(run.style, { widthNeutral });
    if (run.token) {
      // A token is drawn whole, so a deletion inside it is marked at its start.
      const markers = markersIn(run.start, run.end);
      // A change that rewrites any part of a token reads as changing the token.
      const range = changes ? matches.find(([from, to]) => from < run.end && to > run.start) : null;
      const token = renderToken(run, css, runIdx);
      if (!markers && !range) return token;
      return (
        <span key={runIdx}>
          {markers}
          {range ? (
            <mark className={REPLACED_MARK} title={replacedTitle(range)}>
              {token}
            </mark>
          ) : (
            token
          )}
        </span>
      );
    }

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
          const markers = markersAt(from);
          if (from < coreStart || from >= coreEnd) {
            return <span key={key}>{markers}{renderWhitespaceRun(piece, key)}</span>;
          }
          const range = rangeAt(matches, from);
          if (!range) return <span key={key}>{markers}{piece}</span>;
          return (
            <span key={key}>
              {markers}
              <mark
                className={changes ? REPLACED_MARK : SEARCH_MARK}
                style={css.color ? { color: "inherit" } : undefined}
                title={replacedTitle(range)}
              >
                {piece}
              </mark>
            </span>
          );
        })}
      </span>
    );
  });
  return (
    <>
      {rendered}
      {markersAt(str.length)}
    </>
  );
};

export default FormattedText;
