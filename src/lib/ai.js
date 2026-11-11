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

export const translateSingle = (text, settings, options) => {
  if (settings?.aiProvider === "deepl") {
    return translateSingleDeepL(text, settings, options);
  }
  return translateSingleGemini(text, settings, options);
};

export const testConnection = (settings) => {
  if (settings?.aiProvider === "deepl") {
    return testDeeplConnection({
      apiKey: settings.deeplApiKey,
    });
  }
  return testGeminiConnection(settings?.apiKey, settings?.model);
};
