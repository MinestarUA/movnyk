// Lightweight persistence for user settings (Gemini / DeepL API keys + models + preferences).
// Everything lives in localStorage so the keys never leave the user's browser.

const STORAGE_KEY = "movnyk.settings";

export const DEFAULT_MODEL = "gemini-2.0-flash";

// Models exposed in the settings dropdown.
export const GEMINI_MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (швидкий, рекомендовано)" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (найвища якість)" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (найшвидший)" },
];

export const AI_PROVIDERS = [
  { id: "gemini", label: "Google Gemini" },
  { id: "deepl", label: "DeepL Translate" },
];

const DEFAULTS = {
  apiKey: "", // Gemini API key
  model: DEFAULT_MODEL,
  aiProvider: "gemini", // "gemini" | "deepl"
  deeplApiKey: "",
  deeplProxyUrl: "",
  useDeeplProxy: false,
  syncIdenticalTranslations: true,
  qaChecksEnabled: true,
  skipIdenticalImport: true,
  confirmImport: true,
  skipApprovedImport: true,
  unconfirmOnEdit: true,
  focusSearchOnFind: true,
};

// Normalize old models that might be saved in user's localStorage
const normalizeModel = (model) => {
  if (!model || model === "gemini-2.5-flash" || model === "gemini-flash-latest") {
    return "gemini-2.0-flash";
  }
  if (model === "gemini-2.5-pro") {
    return "gemini-1.5-pro";
  }
  return model;
};

export const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: normalizeModel(typeof parsed.model === "string" && parsed.model ? parsed.model : DEFAULT_MODEL),
      aiProvider: parsed.aiProvider === "deepl" ? "deepl" : "gemini",
      deeplApiKey: typeof parsed.deeplApiKey === "string" ? parsed.deeplApiKey : "",
      deeplProxyUrl: typeof parsed.deeplProxyUrl === "string" ? parsed.deeplProxyUrl : "",
      useDeeplProxy: typeof parsed.useDeeplProxy === "boolean" ? parsed.useDeeplProxy : false,
      syncIdenticalTranslations:
        typeof parsed.syncIdenticalTranslations === "boolean" ? parsed.syncIdenticalTranslations : true,
      qaChecksEnabled:
        typeof parsed.qaChecksEnabled === "boolean" ? parsed.qaChecksEnabled : true,
      skipIdenticalImport:
        typeof parsed.skipIdenticalImport === "boolean" ? parsed.skipIdenticalImport : true,
      confirmImport:
        typeof parsed.confirmImport === "boolean" ? parsed.confirmImport : true,
      skipApprovedImport:
        typeof parsed.skipApprovedImport === "boolean" ? parsed.skipApprovedImport : true,
      unconfirmOnEdit:
        typeof parsed.unconfirmOnEdit === "boolean" ? parsed.unconfirmOnEdit : true,
      focusSearchOnFind:
        typeof parsed.focusSearchOnFind === "boolean" ? parsed.focusSearchOnFind : true,
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
        model: normalizeModel(settings.model || DEFAULT_MODEL),
        aiProvider: settings.aiProvider || "gemini",
        deeplApiKey: settings.deeplApiKey ?? "",
        deeplProxyUrl: settings.deeplProxyUrl ?? "",
        useDeeplProxy: Boolean(settings.useDeeplProxy),
        syncIdenticalTranslations: settings.syncIdenticalTranslations !== false,
        qaChecksEnabled: settings.qaChecksEnabled !== false,
        skipIdenticalImport: settings.skipIdenticalImport !== false,
        confirmImport: settings.confirmImport !== false,
        skipApprovedImport: settings.skipApprovedImport !== false,
        unconfirmOnEdit: settings.unconfirmOnEdit !== false,
        focusSearchOnFind: settings.focusSearchOnFind !== false,
      })
    );
  } catch (error) {
    console.error("Could not persist settings:", error);
  }
};

export const hasApiKey = (settings) => {
  if (settings?.aiProvider === "deepl") {
    return Boolean(settings?.deeplApiKey?.trim());
  }
  return Boolean(settings?.apiKey?.trim());
};
