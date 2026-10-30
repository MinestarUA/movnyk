import { isTranslatable } from "./translations";
import { tokenizeString } from "./tokens";

const WORD_PATTERN = /\p{L}[\p{L}\p{M}]*(?:['’ʼ-]\p{L}[\p{L}\p{M}]*)*/gu;
const WORD_PREFIX_PATTERN = /(\p{L}[\p{L}\p{M}]*(?:['’ʼ-]\p{L}[\p{L}\p{M}]*)*)$/u;
const WORD_CONTINUATION_PATTERN = /^[\p{L}\p{M}'’ʼ-]/u;
const UKRAINIAN_COLLATOR = new Intl.Collator("uk-UA", { sensitivity: "base" });

const normalizeWord = (word) => word.normalize("NFC").toLocaleLowerCase("uk-UA");

// Keyed by row object: edits replace only the changed row, so the rest of the
// project is not re-tokenized on every keystroke.
const wordsByRow = new WeakMap();

const extractRowWords = (item) => {
  if (!isTranslatable(item) || !item.translated?.trim()) return [];

  const words = [];
  for (const segment of tokenizeString(item.translated)) {
    if (segment.type !== "text") continue;
    for (const match of segment.value.matchAll(WORD_PATTERN)) {
      words.push({ word: match[0], normalizedWord: normalizeWord(match[0]) });
    }
  }
  return words;
};

const getRowWords = (item) => {
  let words = wordsByRow.get(item);
  if (!words) {
    words = extractRowWords(item);
    wordsByRow.set(item, words);
  }
  return words;
};

export const buildWordAutocompleteWords = (translations) => {
  const wordsByNormalizedValue = new Map();

  for (const item of translations) {
    for (const { word, normalizedWord } of getRowWords(item)) {
      if (!wordsByNormalizedValue.has(normalizedWord)) {
        wordsByNormalizedValue.set(normalizedWord, word);
      }
    }
  }

  return [...wordsByNormalizedValue.values()].sort(UKRAINIAN_COLLATOR.compare);
};

export const getWordAutocompleteContext = (value, selectionStart, selectionEnd) => {
  if (selectionStart !== selectionEnd) return null;

  const textBeforeCaret = value.slice(0, selectionStart);
  const wordMatch = WORD_PREFIX_PATTERN.exec(textBeforeCaret);
  if (!wordMatch) return null;

  const nextCharacter = value.slice(selectionStart);
  if (WORD_CONTINUATION_PATTERN.test(nextCharacter)) return null;

  const word = wordMatch[1];
  return {
    start: selectionStart - word.length,
    end: selectionStart,
    word,
  };
};

// Keeps the typed fragment's capitalization: "Пр" + "привіт" → "Привіт", "ПРИ" → "ПРИВІТ".
export const matchFragmentCase = (word, fragment) => {
  if (fragment.length > 1 && fragment === fragment.toLocaleUpperCase("uk-UA")) {
    return word.toLocaleUpperCase("uk-UA");
  }
  const fragmentStartsUpper = fragment.charAt(0) !== fragment.charAt(0).toLocaleLowerCase("uk-UA");
  if (!fragmentStartsUpper) return word;
  return word.charAt(0).toLocaleUpperCase("uk-UA") + word.slice(1);
};

export const findWordAutocompleteSuggestions = (words, fragment, limit = 5) => {
  const normalizedFragment = normalizeWord(fragment);
  if (!normalizedFragment) return [];

  return words
    .filter((word) => {
      const normalizedWord = normalizeWord(word);
      return normalizedWord.startsWith(normalizedFragment) && normalizedWord !== normalizedFragment;
    })
    .slice(0, limit);
};
