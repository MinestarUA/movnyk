// Patchouli guide books: translatable text lives in en_us JSON files inside
// the jar, not in lang files. Each text field becomes an editor row keyed
// "book:<jar path>#<JSON pointer>".

const BOOK_KEY_PREFIX = "book:";

export const bookKey = (path, pointer) => `${BOOK_KEY_PREFIX}${path}#${pointer}`;
export const isBookKey = (key) => key.startsWith("book:assets/");
export const parseBookKey = (key) => {
  const hash = key.lastIndexOf("#"); // pointers never contain "#"
  return { path: key.slice(BOOK_KEY_PREFIX.length, hash), pointer: key.slice(hash + 1) };
};

const CATEGORY_FIELDS = ["name", "description"];
const ENTRY_FIELDS = ["name"];
const PAGE_FIELDS = ["title", "text", "name", "link_text"];
const RESOURCE_ID = /^[a-z0-9_.-]+:[a-z0-9_/.-]+$/;

// Values that are lang keys or resource ids are looked up by the game, not shown as written.
const isText = (value, langKeys) =>
  typeof value === "string" && value.trim() !== "" && !RESOURCE_ID.test(value) && !langKeys.has(value);

// path: jar path of an en_us categories/ or entries/ file. Returns [{ key, original }] in file order.
export const extractPatchouliUnits = (path, json, langKeys = new Set()) => {
  const isCategory = /\/en_us\/categories\//.test(path);
  const units = [];
  const add = (pointer, value) => {
    if (isText(value, langKeys)) units.push({ key: bookKey(path, pointer), original: value });
  };
  for (const field of isCategory ? CATEGORY_FIELDS : ENTRY_FIELDS) add(`/${field}`, json?.[field]);
  if (!isCategory && Array.isArray(json?.pages)) {
    json.pages.forEach((page, i) => {
      if (page && typeof page === "object") {
        for (const field of PAGE_FIELDS) add(`/pages/${i}/${field}`, page[field]);
      }
    });
  }
  return units;
};

// Only replaces existing string fields; never creates fields.
export const applyPatchouliTranslations = (json, translated) => {
  const out = structuredClone(json);
  for (const [pointer, text] of translated) {
    const parts = pointer.slice(1).split("/");
    const last = parts.pop();
    const parent = parts.reduce((node, part) => node?.[part], out);
    if (parent && typeof parent[last] === "string") parent[last] = text;
  }
  return out;
};
