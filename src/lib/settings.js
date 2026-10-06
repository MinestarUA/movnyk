// Lightweight persistence for user settings (Gemini / DeepL API keys + models + preferences).
// Everything lives in localStorage so the keys never leave the user's browser.

const STORAGE_KEY = "movnyk.settings";

export const DEFAULT_MODEL = "gemini-3.8-flash";

// Models exposed in the settings dropdown based on available text-out models.
export const GEMINI_MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (найновіша, рекомендовано)" },
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
  { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro (найвища якість)" },
  { id: "gemini-3-flash", label: "Gemini 3 Flash" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-2.0-flash", label: "Gemini 2 Flash" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2 Flash Lite" },
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
  useDeeplProxy: true,
  syncIdenticalTranslations: true,
  qaChecksEnabled: true,
  skipIdenticalImport: true,
  confirmImport: true,
  skipApprovedImport: true,
  unconfirmOnEdit: true,
  focusSearchOnFind: true,
};

const normalizeModel = (model) => {
  if (!model) return DEFAULT_MODEL;
  return String(model).replace(/^models\//, "").trim();
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
      useDeeplProxy: typeof parsed.useDeeplProxy === "boolean" ? parsed.useDeeplProxy : true,
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
        useDeeplProxy: settings.useDeeplProxy !== false,
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
