// Lightweight persistence for user settings (Gemini API key + model).
// Everything lives in localStorage so the key never leaves the user's browser.

const STORAGE_KEY = "movnyk.settings";

export const DEFAULT_MODEL = "gemini-2.5-flash";

// Models exposed in the settings dropdown. Flash is the sensible default —
// fast and cheap for bulk localization; Pro is available for tricky strings.
export const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (швидкий, рекомендовано)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (якісніший, повільніший)" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-flash-latest", label: "Gemini Flash (остання версія)" },
];

const DEFAULTS = { apiKey: "", model: DEFAULT_MODEL, skipIdenticalImport: true };

export const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" && parsed.model ? parsed.model : DEFAULT_MODEL,
      skipIdenticalImport:
        typeof parsed.skipIdenticalImport === "boolean" ? parsed.skipIdenticalImport : true,
    };
  } catch {
    return { ...DEFAULTS };
  }
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiKey: settings.apiKey ?? "",
        model: settings.model || DEFAULT_MODEL,
        skipIdenticalImport: settings.skipIdenticalImport !== false,
      })
    );
  } catch (error) {
    console.error("Could not persist settings:", error);
  }
};

export const hasApiKey = (settings) => Boolean(settings?.apiKey?.trim());
