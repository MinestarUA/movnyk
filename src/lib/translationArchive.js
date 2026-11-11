// Translations that already exist in a mod jar or a resource pack: the lang
// file plus the translated guide files (Patchouli and GuideME) of a language.
// Values come back as one flat { editor row key: text } object so they can be
// merged like an imported lang file.

import { parseLangContent } from "./importing";
import { isBookKey, parseBookKey } from "./patchouli";

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const patterns = (language) => {
  const lang = escapeRegExp(language);
  return {
    lang: new RegExp(`^assets/[^/]+/lang/${lang}\\.json$`),
    patchouli: new RegExp(`^(assets/[^/]+/patchouli_books/[^/]+)/${lang}/((?:categories|entries)/.+\\.json)$`),
    guide: new RegExp(`^(assets/[^/]+/(?!patchouli_books/)[^/]+)/_${lang}/(.+\\.md)$`),
  };
};

export const collectTranslationFiles = (paths, language) => {
  const { lang, patchouli, guide } = patterns(language);
  return paths.filter((path) => lang.test(path) || patchouli.test(path) || guide.test(path));
};

const valueAtPointer = (json, pointer) => pointer.slice(1).split("/").reduce((node, part) => node?.[part], json);

const parseJsonOrNull = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// files: { path: text } for the paths collectTranslationFiles picked; rows: the
// editor rows. A Patchouli value is read at each row's pointer in the file's
// en_us twin. A GuideME page is bound only when it has as many units as the
// source page has rows, otherwise it is counted in skippedPageCount.
export const translationsFromArchive = async ({ files, language, rows }) => {
  const { lang, patchouli, guide } = patterns(language);
  const values = {};
  let skippedPageCount = 0;

  const rowsByPath = new Map();
  for (const row of rows) {
    if (!isBookKey(row.key)) continue;
    const { path } = parseBookKey(row.key);
    rowsByPath.set(path, [...(rowsByPath.get(path) ?? []), row]);
  }

  for (const [path, text] of Object.entries(files)) {
    if (lang.test(path)) {
      try {
        Object.assign(values, parseLangContent(text));
      } catch (error) {
        console.warn(`Could not read ${path}, skipping.`, error);
      }
      continue;
    }

    const patchouliMatch = path.match(patchouli);
    if (patchouliMatch) {
      const json = parseJsonOrNull(text);
      const sourcePath = `${patchouliMatch[1]}/en_us/${patchouliMatch[2]}`;
      for (const row of rowsByPath.get(sourcePath) ?? []) {
        const value = json && valueAtPointer(json, parseBookKey(row.key).pointer);
        if (typeof value === "string") values[row.key] = value;
      }
      continue;
    }

    const guideMatch = path.match(guide);
    const sourcePath = guideMatch && `${guideMatch[1]}/${guideMatch[2]}`;
    const pageRows = rowsByPath.get(sourcePath);
    if (!pageRows) continue;
    const { extractGuideUnits } = await import("./guidemeMarkdown");
    let units = null;
    try {
      units = extractGuideUnits(sourcePath, text);
    } catch (error) {
      console.warn(`Could not parse ${path}, skipping.`, error);
    }
    if (units?.length === pageRows.length) {
      for (const { key, original } of units) values[key] = original;
    } else {
      skippedPageCount += 1;
    }
  }

  return { values, skippedPageCount };
};
