// Gemini-powered batch and single-string translation of Minecraft mod localization strings.
// Runs entirely from the browser against the Generative Language REST API,
// which supports CORS with an API key passed as a query parameter.

import { DEFAULT_MODEL } from "./settings";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// Turn off aggressive safety filtering so game terminology (weapons, explosions,
// death messages, hostile mobs, potions) is never falsely blocked by Google.
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
];

export const SYSTEM_PROMPT = `You are an expert game localizer translating Minecraft mod localization strings from English into Ukrainian (uk_ua) for a resource pack.

INPUT: a single JSON object. Each key is a Minecraft translation key — do NOT translate, reorder or alter keys. Each value is the English source string to translate.

OUTPUT: a JSON object with EXACTLY the same keys, where each value is the Ukrainian translation of the corresponding source string. Output ONLY the JSON object — no markdown, no comments, no extra text.

TRANSLATION RULES:
1. Produce natural, fluent, idiomatic Ukrainian as used in modern video games. Match the register of the source: playful flavour text stays playful, UI labels stay short, tooltips stay concise, technical config stays precise.
2. Use the terminology of the OFFICIAL Minecraft Ukrainian translation for vanilla concepts. Examples: Creeper → Кріпер, Enderman → Ендермен, Redstone → Редстоун, Nether → Незер, The End → Край, Overworld → Звичайний світ, Diamond → Алмаз, Netherite → Незерит, Crafting Table → Верстак, Furnace → Піч, Enchanting → Зачарування, Anvil → Ковадло, Mob → Моб, Block → Блок, Item → Предмет, Chunk → Чанк, Spawn → Спавн, Durability → Міцність, Stack → Стос. For mod-specific proper nouns keep the conventional rendering; transliterate names only when that reads naturally in Ukrainian.
3. NEVER translate, delete, reorder or modify any of the following — copy them VERBATIM, only moving them to the grammatically correct position:
   - Format placeholders: %s, %d, %f, %1$s, %2$d, {0}, {1}, {name}, {{value}}, %variable%, $(name), <player>, [count].
   - Minecraft formatting codes: a § or & followed by one character (e.g. §a, §l, §r, &6, &l). Keep them exactly and in the same relative order.
   - Escape sequences and line breaks: \\n, \\t, \\", \\\\. Preserve every one of them and their positions.
   - Keybind tokens, resource IDs (namespace:path), URLs, numbers and code identifiers.
4. Preserve leading and trailing spaces exactly. Preserve the source's capitalization intent: an ALL-CAPS label may stay uppercase when natural, Title Case UI text becomes normally-capitalized Ukrainian.
5. If a value contains no translatable words (only symbols, numbers, placeholders or codes), return it unchanged.
6. Use correct Ukrainian typography (« » quotation marks, — em dash, ' apostrophe) only when it does not risk breaking a placeholder or code.

Return the complete JSON object for every key you were given.`;

const cleanModelId = (m) => String(m || DEFAULT_MODEL).replace(/^models\//, "").trim();

const cleanJson = (raw) => {
  const trimmed = String(raw ?? "").trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
};

export const parseErrorMessage = (status, rawBody) => {
  let apiMessage;
  try {
    const parsed = JSON.parse(rawBody);
    apiMessage = parsed?.error?.message ?? "";
  } catch {
    apiMessage = rawBody?.slice?.(0, 300) ?? "";
  }

  if (status === 400 && /API key not valid/i.test(apiMessage)) {
    return "Недійсний ключ Gemini API. Перевірте його в налаштуваннях.";
  }
  if (status === 403) {
    return "Доступ заборонено (403). Перевірте, що ключ дійсний і має доступ до Gemini API.";
  }
  if (status === 429) {
    return "Перевищено ліміт запитів Gemini (429). Зачекайте трохи й спробуйте знову.";
  }
  if (status === 404) {
    return "Обрану модель Gemini не знайдено (404). Виберіть доступну модель у налаштуваннях.";
  }
  return `Помилка Gemini API (${status})${apiMessage ? `: ${apiMessage}` : ""}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retrieve the list of models actually available on the user's Google account
export const fetchAvailableGeminiModels = async (rawKey) => {
  const apiKey = rawKey?.trim();
  if (!apiKey) return [];
  try {
    const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`);
    if (!response.ok) return [];
    const data = await response.json();
    const list = data?.models || [];
    return list
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => {
        const id = m.name.replace(/^models\//, "");
        return {
          id,
          label: `${m.displayName || id}`,
        };
      });
  } catch {
    return [];
  }
};

// Test connection with a minimal request to verify key & model
export const testGeminiConnection = async (rawKey, rawModel) => {
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error("Введіть ключ Gemini API.");
  const model = cleanModelId(rawModel);

  const body = {
    contents: [{ role: "user", parts: [{ text: "Ping" }] }],
    safetySettings: SAFETY_SETTINGS,
  };

  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const rawBody = await response.text();
    throw new Error(parseErrorMessage(response.status, rawBody));
  }

  return true;
};

// Translate a single string using Gemini
export const translateSingleGemini = async (text, settings = {}, signal) => {
  const apiKey = settings?.apiKey?.trim();
  if (!apiKey) throw new Error("Не вказано ключ Gemini API.");
  const model = cleanModelId(settings?.model);

  const source = { test_key: String(text ?? "") };
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify(source) }] }],
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      responseMimeType: "application/json",
    },
  };

  const response = await fetch(
    `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }
  );

  if (!response.ok) {
    const rawBody = await response.text();
    throw new Error(parseErrorMessage(response.status, rawBody));
  }

  const data = await response.json();
  const rawText =
    data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

  const parsed = JSON.parse(cleanJson(rawText));
  return parsed.test_key ?? "";
};

// Translate one batch of entries. `entries` is [{ key, original }, ...].
const translateBatch = async (entries, { apiKey, model, signal }, attempt = 0) => {
  const source = {};
  for (const entry of entries) source[entry.key] = String(entry.original ?? "");

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify(source) }] }],
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      responseMimeType: "application/json",
    },
  };

  const cleanModel = cleanModelId(model);
  let response;
  try {
    response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Не вдалося з'єднатися з Gemini API. Перевірте підключення до мережі.", {
      cause: error,
    });
  }

  // Transient errors: back off and retry a couple of times before giving up.
  if ((response.status === 429 || response.status === 503) && attempt < 3) {
    await wait(1000 * 2 ** attempt);
    return translateBatch(entries, { apiKey, model, signal }, attempt + 1);
  }

  if (!response.ok) {
    const rawBody = await response.text();
    throw new Error(parseErrorMessage(response.status, rawBody));
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

  if (!text.trim()) {
    const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
    throw new Error(
      blockReason
        ? `Gemini заблокував відповідь (${blockReason}).`
        : "Gemini повернув порожню відповідь."
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanJson(text));
  } catch (cause) {
    throw new Error("Gemini повернув некоректний JSON.", { cause });
  }

  const result = {};
  for (const entry of entries) {
    const value = parsed[entry.key];
    if (typeof value === "string") result[entry.key] = value;
  }
  return result;
};

// Translate every entry with Gemini
export const translateAll = async (
  entries,
  settings,
  { onBatch, signal, batchSize = 35, concurrency = 2 } = {}
) => {
  const apiKey = settings?.apiKey?.trim();
  if (!apiKey) throw new Error("Не вказано ключ Gemini API.");
  const model = cleanModelId(settings?.model);

  const batches = [];
  for (let i = 0; i < entries.length; i += batchSize) {
    batches.push(entries.slice(i, i + batchSize));
  }

  let cursor = 0;
  let firstError = null;
  let succeeded = 0;
  let failed = 0;

  const worker = async () => {
    while (cursor < batches.length) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const batch = batches[cursor++];
      try {
        const result = await translateBatch(batch, { apiKey, model, signal });
        succeeded += Object.keys(result).length;
        onBatch?.(result, batch, null);
      } catch (error) {
        if (signal?.aborted) throw error;
        if (!firstError) firstError = error;
        failed += batch.length;
        onBatch?.({}, batch, error);
      }
    }
  };

  const workerCount = Math.min(concurrency, batches.length) || 0;
  await Promise.all(Array.from({ length: workerCount }, worker));

  if (succeeded === 0 && firstError) throw firstError;

  return { succeeded, failed, hadErrors: Boolean(firstError) };
};
