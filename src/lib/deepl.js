// DeepL Translate API integration for Minecraft mod localization.
// Supports both DeepL Free (keys ending in :fx) and DeepL Pro.
// Protects Minecraft formatting codes (§a, &c, \n, %s, {0}) using XML tags
// so DeepL does not touch, strip, or corrupt them.
// Communicates directly with DeepL API (requires CORS Unblock extension in browser).

import { ApiKeyError } from "./apiErrors";
import { CORE_SYNTAX, tokenizeString } from "./tokens";

export const CORS_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/cors-unblock/lfhmikememgdcahcdlaciloancbhjino";

export const getDeepLEndpoint = (apiKey) => {
  const key = apiKey?.trim() || "";
  if (key.endsWith(":fx")) {
    return "https://api-free.deepl.com/v2/translate";
  }
  return "https://api.deepl.com/v2/translate";
};

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

// DeepL parses the input as XML, so bare "&" (e.g. "&o") or "<" would be rejected as malformed.
const escapeXml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Protect formatting codes and placeholders by replacing them with empty XML tags,
// e.g. "Level §a%d / %d" -> 'Level <x id="0"/><x id="1"/> / <x id="2"/>'.
// Empty tags matter: DeepL treats a wrapping tag as markup around words and may
// stretch it over the translated word next to it, which would then be lost.
export const shieldTokens = (text, syntax = CORE_SYNTAX) => {
  const tokens = tokenizeString(text, syntax);
  const tokenMap = [];
  let shielded = "";

  for (const part of tokens) {
    if (part.type === "text") {
      shielded += escapeXml(part.value);
    } else {
      const id = tokenMap.length;
      tokenMap.push(part.value);
      shielded += `<x id="${id}"/>`;
    }
  }

  return { shielded, tokenMap };
};

const decodeXmlEntities = (text) =>
  text.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => XML_ENTITIES[entity]);

// Restore shielded tokens from translated XML and decode the entities DeepL returns.
// A single pass keeps restored token values (e.g. a literal "&amp;") from being decoded twice.
// DeepL may still return a placeholder as an open/close pair wrapping a translated
// word; that word is kept after the token instead of being dropped.
export const unshieldTokens = (text, tokenMap) => {
  return text.replace(
    /<x id="(\d+)"\s*(?:\/>|>(.*?)<\/x>)|&(amp|lt|gt|quot|apos);/g,
    (match, idStr, wrappedText, entity) => {
      if (entity) return XML_ENTITIES[entity];
      const token = tokenMap?.[parseInt(idStr, 10)];
      if (token === undefined) return match;
      return token + decodeXmlEntities(wrappedText ?? "");
    }
  );
};

const parseDeepLError = (status, text) => {
  if (status === 403) {
    return "Недійсний ключ DeepL або доступ заборонено (403). Перевірте ключ у налаштуваннях.";
  }
  if (status === 456) {
    return "Перевищено квоту символів DeepL (456 Quota Exceeded).";
  }
  if (status === 429) {
    return "Забагато запитів до DeepL (429). Зачекайте трохи.";
  }
  return `Помилка DeepL API (${status})${text ? `: ${text}` : ""}`;
};

export const testDeeplConnection = async ({ apiKey }) => {
  const key = apiKey?.trim();
  if (!key) throw new Error("Введіть ключ DeepL API.");

  const url = getDeepLEndpoint(key);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: ["Hello"],
        target_lang: "UK",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(parseDeepLError(response.status, errText));
    }

    const data = await response.json();
    return Boolean(data?.translations?.[0]?.text);
  } catch (error) {
    if (error.name === "TypeError") {
      throw new Error(
        "Браузер заблокував прямий запит до DeepL (CORS). Будь ласка, увімкніть розширення CORS Unblock для цього сайту.",
        { cause: error }
      );
    }
    throw error;
  }
};

export const translateSingleDeepL = async (text, settings = {}, { signal, syntax } = {}) => {
  const apiKey = settings?.deeplApiKey?.trim();
  if (!apiKey) throw new Error("Не вказано ключ DeepL API.");

  const { shielded, tokenMap } = shieldTokens(text, syntax);
  const url = getDeepLEndpoint(apiKey);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [shielded],
        target_lang: "UK",
        tag_handling: "xml",
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(parseDeepLError(response.status, errText));
    }

    const data = await response.json();
    const rawResult = data?.translations?.[0]?.text ?? "";
    return unshieldTokens(rawResult, tokenMap);
  } catch (error) {
    if (error.name === "TypeError") {
      throw new Error(
        "Браузер заблокував прямий запит до DeepL (CORS). Будь ласка, увімкніть розширення CORS Unblock для цього сайту.",
        { cause: error }
      );
    }
    throw error;
  }
};

export const translateAllDeepL = async (
  entries,
  settings,
  { onBatch, signal, syntax, batchSize = 30 } = {}
) => {
  const apiKey = settings?.deeplApiKey?.trim();
  if (!apiKey) throw new Error("Не вказано ключ DeepL API.");

  const url = getDeepLEndpoint(apiKey);

  let succeeded = 0;
  let failed = 0;
  let firstError = null;

  for (let i = 0; i < entries.length; i += batchSize) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const batch = entries.slice(i, i + batchSize);

    try {
      const shieldedList = batch.map((item) => shieldTokens(String(item.original ?? ""), syntax));
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: shieldedList.map((s) => s.shielded),
          target_lang: "UK",
          tag_handling: "xml",
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        const message = parseDeepLError(response.status, errText);
        throw response.status === 403 ? new ApiKeyError(message) : new Error(message);
      }

      const data = await response.json();
      const result = {};
      batch.forEach((entry, idx) => {
        const trans = data?.translations?.[idx]?.text ?? "";
        result[entry.key] = unshieldTokens(trans, shieldedList[idx].tokenMap);
      });

      succeeded += Object.keys(result).length;
      onBatch?.(result, batch, null);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!firstError) firstError = error;
      failed += batch.length;
      onBatch?.({}, batch, error);
    }
  }

  if (succeeded === 0 && firstError) throw firstError;
  return { succeeded, failed, hadErrors: Boolean(firstError) };
};
