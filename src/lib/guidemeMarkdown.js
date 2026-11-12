// Parses GuideME pages into translatable units and splices translations back
// into the raw page text. GuideME parses pages with a Java port of the same
// micromark/mdast stack used here, so unit boundaries match what the game
// shows. This is the only module that imports the parser: callers load it with
// import() to keep it out of the main bundle.

import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxJsx } from "micromark-extension-mdx-jsx";
import { mdxJsxFromMarkdown } from "mdast-util-mdx-jsx";
import { mdxMd } from "micromark-extension-mdx-md";
import { frontmatter } from "micromark-extension-frontmatter";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmTable } from "micromark-extension-gfm-table";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";
import { gfmStrikethroughFromMarkdown } from "mdast-util-gfm-strikethrough";
import { bookKey } from "./patchouli";
import { getSyntax } from "./syntaxExtensions";
import { tokenizeString } from "./tokens";

// micromark skips a leading BOM, so offsets are relative to the text without it.
const BOM = "\uFEFF";
const withoutBom = (text) => (text.startsWith(BOM) ? text.slice(1) : text);

const parse = (text) =>
  fromMarkdown(text, {
    extensions: [mdxJsx(), mdxMd(), frontmatter(["yaml"]), gfmTable(), gfmStrikethrough()],
    mdastExtensions: [
      mdxJsxFromMarkdown(),
      frontmatterFromMarkdown(["yaml"]),
      gfmTableFromMarkdown(),
      gfmStrikethroughFromMarkdown(),
    ],
  });

const LEAF = { paragraph: "paragraph", heading: "heading", tableCell: "cell" };
const PHRASING = new Set([
  "text",
  "emphasis",
  "strong",
  "delete",
  "link",
  "image",
  "inlineCode",
  "mdxJsxTextElement",
  "break",
]);
const SKIP = new Set(["code", "yaml"]);

// Segments of consecutive phrasing nodes, split at hard breaks → { kind, context, start, end }.
// `context` is the chain of ancestor node types: a paragraph that turns into a
// list item keeps its kind but changes context.
const pushRuns = (children, kind, context, out) => {
  let run = [];
  const flush = () => {
    if (run.length > 0) {
      out.push({ kind, context, start: run[0].position.start.offset, end: run.at(-1).position.end.offset });
    }
    run = [];
  };
  for (const child of children) {
    if (child.type === "break" || !PHRASING.has(child.type)) flush();
    else run.push(child);
  }
  flush();
};

const walk = (node, context, out) => {
  if (SKIP.has(node.type)) return;
  const here = `${context}>${node.type}`;
  if (LEAF[node.type]) return pushRuns(node.children, LEAF[node.type], here, out);
  if (node.type === "mdxJsxFlowElement") pushRuns(node.children, "paragraph", here, out);
  for (const child of node.children ?? []) if (!PHRASING.has(child.type)) walk(child, here, out);
};

// A quoted scalar ends at its closing quote; a plain one at a " #" comment or the line end.
const YAML_SCALAR = /^(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|.*?(?=\s+#|$))/;

// navigation.title inside the frontmatter: [start, end) of its scalar, or null.
const findNavigationTitle = (text, yaml) => {
  let inNavigation = false;
  let offset = yaml.position.start.offset;
  for (const line of text.slice(offset, yaml.position.end.offset).split("\n")) {
    const m = line.match(/^(\s*)([\w-]+):[ \t]*(.*?)\s*$/);
    if (m && m[1].length === 0) inNavigation = m[2] === "navigation";
    else if (m && inNavigation && m[2] === "title" && m[3]) {
      const valueStart = offset + line.indexOf(m[3], m[1].length + m[2].length + 1);
      return { start: valueStart, end: valueStart + m[3].match(YAML_SCALAR)[0].length };
    }
    offset += line.length + 1;
  }
  return null;
};

const yamlScalar = (value) =>
  /^[\p{L}\p{N}][^:#"'\n]*$/u.test(value) && !/\s$/.test(value) ? value : JSON.stringify(value);

const unquoteYaml = (scalar) => {
  if (scalar.startsWith('"')) {
    try {
      return JSON.parse(scalar);
    } catch {
      return null;
    }
  }
  return scalar.startsWith("'") ? scalar.slice(1, -1).replaceAll("''", "'") : scalar;
};

// Every segment in document order, with the navigation title first, including
// letterless ones: the sequence of kinds and contexts fingerprints a page's structure.
export const locateSegments = (rawText) => {
  const text = withoutBom(rawText);
  const root = parse(text);
  const segments = [];
  const yaml = root.children[0]?.type === "yaml" ? root.children[0] : null;
  const title = yaml && findNavigationTitle(text, yaml);
  if (title) segments.push({ kind: "title", context: "yaml", ...title });
  walk(root, "", segments);
  return segments;
};

const GUIDEME_SYNTAX = getSyntax(["guideme"]);
const hasLettersOutsideTokens = (original) =>
  tokenizeString(original, GUIDEME_SYNTAX).some((part) => part.type === "text" && /\p{L}/u.test(part.value));

const SOFT_BREAK = /[ \t]*\r?\n[ \t>]*/g;

// → [{ key, original, kind, start, end }] with offsets into `text` without its BOM. Throws when the page does not parse.
export const extractGuideUnits = (path, rawText) => {
  const text = withoutBom(rawText);
  const units = [];
  let ordinal = 0;
  for (const { kind, start, end } of locateSegments(text)) {
    const raw = text.slice(start, end);
    const original = kind === "title" ? unquoteYaml(raw) : raw.replace(SOFT_BREAK, " ");
    if (original === null || !hasLettersOutsideTokens(original)) continue;
    const pointer = kind === "title" ? "title" : String(ordinal++);
    units.push({ key: bookKey(path, pointer), original, kind, start, end });
  }
  return units;
};

const printed = (kind, translated) => {
  const oneLine = translated.replace(/\s*\n\s*/g, " ").trim();
  if (kind === "title") return yamlScalar(oneLine);
  return kind === "cell" ? oneLine.replace(/(?<!\\)\|/g, "\\|") : oneLine;
};

// translatedByKey: Map<key, translated text>. Units without a translation stay as written.
export const rewriteGuidePage = (path, rawText, translatedByKey) => {
  const text = withoutBom(rawText);
  let out = text;
  for (const { key, kind, start, end } of extractGuideUnits(path, text).reverse()) {
    const translated = translatedByKey.get(key);
    if (translated?.trim()) out = out.slice(0, start) + printed(kind, translated) + out.slice(end);
  }
  return rawText.slice(0, rawText.length - text.length) + out;
};

// A translation that changes the block structure (a paragraph turning into a
// list item or heading) would shift what the rest of the page means.
export const hasSameStructure = (sourceText, outputText) => {
  try {
    const shape = (text) => locateSegments(text).map(({ kind, context }) => `${kind}${context}`);
    return shape(sourceText).join("\n") === shape(outputText).join("\n");
  } catch {
    return false;
  }
};
