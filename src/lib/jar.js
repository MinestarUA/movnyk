import JSZip from "jszip";
import { findPatchouliBooks } from "./patchouli";
import { inferMinecraftVersion } from "./resourcePack";

const parseJson = (text, path) => {
  try {
    return JSON.parse(text);
  } catch {
    console.warn(`Could not parse ${path}, skipping.`);
    return null;
  }
};

const readText = async (zip, path) => (await zip.file(path)?.async("string")) ?? null;

export const readJar = async (file) => {
  const zip = await JSZip.loadAsync(file);
  const langFiles = [];
  const langFilePromises = [];

  zip.forEach((relativePath, zipEntry) => {
    if (relativePath.match(/assets\/.*\/lang\/.*\.json$/) && !zipEntry.dir) {
      langFilePromises.push(
        zipEntry.async("string").then((content) => {
          try {
            langFiles.push({
              name: relativePath,
              sessionName: `${file.name} · ${relativePath}`,
              content: JSON.parse(content),
            });
          } catch {
            console.warn(`Could not parse ${relativePath}, skipping.`);
          }
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
  const books = [];
  for (const { files, ...book } of foundBooks) {
    const readableFiles = [];
    for (const path of files) {
      const text = await readText(zip, path);
      if (parseJson(text, path) === null) continue;
      bookFiles[path] = text;
      readableFiles.push(path);
    }
    if (readableFiles.length === 0) continue;
    const bookJsonPath = `${book.root.replace(/^assets/, "data")}/book.json`;
    const bookJsonText = await readText(zip, bookJsonPath);
    const nameKey = bookJsonText && parseJson(bookJsonText, bookJsonPath)?.name;
    books.push({ ...book, files: readableFiles, nameKey });
  }

  return {
    langFiles,
    mcVersion: inferMinecraftVersion({ modsToml, fabricModJson }),
    books,
    unsupportedBooks,
    bookFiles,
  };
};
