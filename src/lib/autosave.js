// Single-slot autosave of the current project in localStorage, so a page
// reload never wipes translation progress.

const STORAGE_KEY = "movnyk.autosave";

export const loadAutosave = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.template !== "object" ||
      parsed.template === null ||
      !Array.isArray(parsed.translations)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveAutosave = ({ template, translations }) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ template, translations, savedAt: Date.now() })
    );
    return true;
  } catch (error) {
    console.error("Could not persist autosave:", error);
    return false;
  }
};
