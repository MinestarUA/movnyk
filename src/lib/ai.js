// Unified translation dispatch between Google Gemini and DeepL.

import {
  translateAll as translateAllGemini,
  translateSingleGemini,
  testGeminiConnection,
} from "./gemini";
import {
  translateAllDeepL,
  translateSingleDeepL,
  testDeeplConnection,
} from "./deepl";

export const translateAll = (entries, settings, options) => {
  if (settings?.aiProvider === "deepl") {
    return translateAllDeepL(entries, settings, options);
  }
  return translateAllGemini(entries, settings, options);
};

export const translateSingle = (text, settings, signal) => {
  if (settings?.aiProvider === "deepl") {
    return translateSingleDeepL(text, settings, signal);
  }
  return translateSingleGemini(text, settings, signal);
};

export const testConnection = (settings) => {
  if (settings?.aiProvider === "deepl") {
    return testDeeplConnection({
      apiKey: settings.deeplApiKey,
    });
  }
  return testGeminiConnection(settings?.apiKey, settings?.model);
};
