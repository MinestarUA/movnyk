import JSZip from "jszip";
import { findGuideBooks } from "./guideme";
import { findPatchouliBooks } from "./patchouli";
import { DEFAULT_LANGUAGE, inferMinecraftVersion } from "./resourcePack";
import { collectTranslationFiles } from "./translationArchive";

const parseJson = (text, path) => {
  try {
    return JSON.parse(text);
  } catch {
    console.warn(`Could not parse ${path}, skipping.`);
    return null;
  }
};

// A guide's pages carry navigation metadata in their frontmatter; other
// Markdown under assets/ (readmes, docs) does not.
const hasGuideFrontmatter = (text) => /^navigation:/m.test(text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "");

const readText = async (zip, path) => (await zip.file(path)?.async("string")) ?? null;

export const readJar = async (file) => {
  const zip = await JSZip.loadAsync(file);
  const langFiles = [];
  const langFilePromises = [];

  zip.forEach((relativePath, zipEntry) => {
    if (relativePath.match(/assets\/.*\/lang\/.*\.json$/) && !zipEntry.dir) {
      langFilePromises.push(
        zipEntry.async("string").then((text) => {
          const content = parseJson(text, relativePath);
          if (content === null) return;
          langFiles.push({ name: relativePath, sessionName: `${file.name} · ${relativePath}`, content });
        })
      );
    }
  });

  await Promise.all(langFilePromises);

  const modsToml =
    (await readText(zip, "META-INF/neoforge.mods.toml")) ?? (await readText(zip, "META-INF/mods.toml"));
  const fabricModJson = await readText(zip, "fabric.mod.json");

  const { books: foundBooks, unsupported: unsupportedBooks } = findPatchouliBooks(Object.keys(zip.files));
  const bookFiles = {};
  const bookJson = {};
  const books = [];
  for (const { files, ...book } of foundBooks) {
    const readableFiles = [];
    for (const path of files) {
      const text = await readText(zip, path);
      const json = parseJson(text, path);
      if (json === null) continue;
      bookFiles[path] = text;
      bookJson[path] = json;
      readableFiles.push(path);
    }
    if (readableFiles.length === 0) continue;
    const bookJsonPath = `${book.root.replace(/^assets/, "data")}/book.json`;
    const bookJsonText = await readText(zip, bookJsonPath);
    const nameKey = bookJsonText && parseJson(bookJsonText, bookJsonPath)?.name;
    books.push({ ...book, format: "patchouli", files: readableFiles, nameKey });
  }

  const guideUnits = {};
  let skippedGuidePages = 0;
  for (const { files, ...book } of findGuideBooks(Object.keys(zip.files))) {
    const pages = await Promise.all(files.map(async (path) => [path, await readText(zip, path)]));
    if (!pages.some(([, text]) => hasGuideFrontmatter(text))) continue;
    const { extractGuideUnits } = await import("./guidemeMarkdown");
    const parsedFiles = [];
    for (const [path, text] of pages) {
      try {
        guideUnits[path] = extractGuideUnits(path, text).map(({ key, original }) => ({ key, original }));
        bookFiles[path] = text;
        parsedFiles.push(path);
      } catch (error) {
        console.warn(`Could not parse ${path}, skipping.`, error);
        skippedGuidePages += 1;
      }
    }
    if (parsedFiles.length > 0) books.push({ ...book, format: "guideme", files: parsedFiles });
  }

  // The mod's own translation into the default language, as { path: text }.
  const translationFiles = Object.fromEntries(
    await Promise.all(
      collectTranslationFiles(Object.keys(zip.files), DEFAULT_LANGUAGE).map(async (path) => [path, await readText(zip, path)])
    )
  );

  return {
    langFiles,
    mcVersion: inferMinecraftVersion({ modsToml, fabricModJson }),
    books,
    unsupportedBooks,
    bookFiles,
    bookJson,
    guideUnits,
    skippedGuidePages,
    translationFiles,
  };
};
