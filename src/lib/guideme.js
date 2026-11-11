// GuideME guides: Markdown pages under assets/<ns>/<guide folder>/. A page
// translated for a language lives under _<lang>/ inside the same folder. The
// Markdown parser is not imported here so this module stays in the main bundle.

const PAGE = /^assets\/([^/]+)\/([^/]+)\/(.+\.md)$/;
const TRANSLATION_FOLDER = /^_[^/]+\//;

// Candidate guides: every folder with Markdown pages, minus translated pages
// and Patchouli's folder. Whether a folder really is a guide is decided by
// reading its pages (see readJar).
export const findGuideBooks = (paths) => {
  const byRoot = new Map();
  for (const path of paths) {
    const match = path.match(PAGE);
    if (!match) continue;
    const [, namespace, folder, page] = match;
    if (folder === "patchouli_books" || TRANSLATION_FOLDER.test(page)) continue;
    const root = `assets/${namespace}/${folder}`;
    if (!byRoot.has(root)) byRoot.set(root, { root, id: `${namespace}:${folder}`, files: [] });
    byRoot.get(root).files.push(path);
  }
  return [...byRoot.values()].map((book) => ({ ...book, files: book.files.sort() }));
};

export const guideTargetPath = (path, language) => path.replace(/^(assets\/[^/]+\/[^/]+)\//, `$1/_${language}/`);
