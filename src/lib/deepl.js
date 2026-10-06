// DeepL Translate API integration for Minecraft mod localization.
// Supports both DeepL Free (keys ending in :fx) and DeepL Pro.
// Protects Minecraft formatting codes (§a, &c, \n, %s, {0}) using XML tags
// so DeepL does not touch, strip, or corrupt them.
// Provides proxy support to bypass browser CORS restrictions.

import { tokenizeString } from "./tokens";

export const DEFAULT_CORS_PROXY = "https://corsproxy.io/?url=";

export const getDeepLEndpoint = (apiKey) => {
  const key = apiKey?.trim() || "";
  if (key.endsWith(":fx")) {
    return "https://api-free.deepl.com/v2/translate";
  }
  return "https://api.deepl.com/v2/translate";
};

export const buildDeepLUrl = (endpoint, { proxyUrl, useProxy }) => {
  if (useProxy || proxyUrl) {
    const proxy = (proxyUrl?.trim() || DEFAULT_CORS_PROXY);
    if (proxy.includes("?url=")) {
      return `${proxy}${encodeURIComponent(endpoint)}`;
    }
    return `${proxy.replace(/\/$/, "")}/v2/translate`;
  }
  return endpoint;
};

// Protect formatting codes and placeholders by wrapping in XML tags
// e.g. "Level §a%d / %d" -> "Level <x id='0'>§a</x><x id='1'>%d</x> / <x id='2'>%d</x>"
export const shieldTokens = (text) => {
  const tokens = tokenizeString(text);
  const tokenMap = [];
  let shielded = "";

  for (const part of tokens) {
    if (part.type === "text") {
      shielded += part.value;
    } else {
      const id = tokenMap.length;
      tokenMap.push(part.value);
      shielded += `<x id="${id}">${part.value}</x>`;
    }
  }

  return { shielded, tokenMap };
};

// Restore shielded tokens from translated XML
export const unshieldTokens = (text, tokenMap) => {
  if (!tokenMap || tokenMap.length === 0) return text;
  return text.replace(/<x id="(\d+)">.*?<\/x>/g, (match, idStr) => {
    const id = parseInt(idStr, 10);
    return tokenMap[id] !== undefined ? tokenMap[id] : match;
  });
};

const parseDeepLError = (status, text) => {
  if (status === 403) {
    return "Недійсний ключ DeepL або доступ заборонено (403). Якщо ви працюєте в браузері, увімкніть CORS-проксі в налаштуваннях.";
  }
  if (status === 456) {
    return "Перевищено квоту перекладу DeepL (456 Quota Exceeded).";
  }
  if (status === 429) {
    return "Забагато запитів до DeepL (429). Зачекайте трохи.";
  }
  return `Помилка DeepL API (${status})${text ? `: ${text}` : ""}`;
};

export const testDeeplConnection = async ({ apiKey, proxyUrl, useProxy }) => {
  const key = apiKey?.trim();
  if (!key) throw new Error("Введіть ключ DeepL API.");

  const endpoint = getDeepLEndpoint(key);
  const url = buildDeepLUrl(endpoint, { proxyUrl, useProxy });

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
    if (error.name === "TypeError" && !useProxy && !proxyUrl) {
      throw new Error(
        "Браузер заблокував запит до DeepL через CORS. Увімкніть опцію «Використовувати CORS-проксі» у налаштуваннях.",
        { cause: error }
      );
    }
    throw error;
  }
};

export const translateSingleDeepL = async (text, settings = {}, signal) => {
  const apiKey = settings?.deeplApiKey?.trim();
  if (!apiKey) throw new Error("Не вказано ключ DeepL API.");

  const { shielded, tokenMap } = shieldTokens(text);
  const endpoint = getDeepLEndpoint(apiKey);
  const url = buildDeepLUrl(endpoint, {
    proxyUrl: settings?.deeplProxyUrl,
    useProxy: settings?.useDeeplProxy,
  });

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
    if (error.name === "TypeError" && !settings?.useDeeplProxy && !settings?.deeplProxyUrl) {
      throw new Error(
        "Браузер заблокував запит до DeepL через CORS. Увімкніть опцію «Використовувати CORS-проксі» у налаштуваннях.",
        { cause: error }
      );
    }
    throw error;
  }
};

export const translateAllDeepL = async (
  entries,
  settings,
  { onBatch, signal, batchSize = 30 } = {}
) => {
  const apiKey = settings?.deeplApiKey?.trim();
  if (!apiKey) throw new Error("Не вказано ключ DeepL API.");

  const endpoint = getDeepLEndpoint(apiKey);
  const url = buildDeepLUrl(endpoint, {
    proxyUrl: settings?.deeplProxyUrl,
    useProxy: settings?.useDeeplProxy,
  });

  let succeeded = 0;
  let failed = 0;
  let firstError = null;

  for (let i = 0; i < entries.length; i += batchSize) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const batch = entries.slice(i, i + batchSize);

    try {
      const shieldedList = batch.map((item) => shieldTokens(String(item.original ?? "")));
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
        throw new Error(parseDeepLError(response.status, errText));
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
