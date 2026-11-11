import { isTranslatable } from "./translations";
import { CORE_SYNTAX, tokenizeString } from "./tokens";

const WORD_PATTERN = /\p{L}[\p{L}\p{M}]*(?:['’ʼ-]\p{L}[\p{L}\p{M}]*)*/gu;
const WORD_PREFIX_PATTERN = /(\p{L}[\p{L}\p{M}]*(?:['’ʼ-]\p{L}[\p{L}\p{M}]*)*)$/u;
const WORD_CONTINUATION_PATTERN = /^[\p{L}\p{M}'’ʼ-]/u;
const UKRAINIAN_COLLATOR = new Intl.Collator("uk-UA", { sensitivity: "base" });

const normalizeWord = (word) => word.normalize("NFC").toLocaleLowerCase("uk-UA");

// Keyed by syntax, then by row object: edits replace only the changed row, so
// the rest of the project is not re-tokenized on every keystroke, and toggling
// an extension never serves words tokenized under the old syntax.
const wordsBySyntax = new WeakMap();

const extractRowWords = (item, syntax) => {
  if (!isTranslatable(item) || !item.translated?.trim()) return [];

  const words = [];
  for (const segment of tokenizeString(item.translated, syntax)) {
    if (segment.type !== "text") continue;
    for (const match of segment.value.matchAll(WORD_PATTERN)) {
      words.push({ word: match[0], normalizedWord: normalizeWord(match[0]) });
    }
  }
  return words;
};

const getRowWords = (item, syntax) => {
  let wordsByRow = wordsBySyntax.get(syntax);
  if (!wordsByRow) {
    wordsByRow = new WeakMap();
    wordsBySyntax.set(syntax, wordsByRow);
  }
  let words = wordsByRow.get(item);
  if (!words) {
    words = extractRowWords(item, syntax);
    wordsByRow.set(item, words);
  }
  return words;
};

export const buildWordAutocompleteWords = (translations, syntax = CORE_SYNTAX) => {
  const wordsByNormalizedValue = new Map();

  for (const item of translations) {
    for (const { word, normalizedWord } of getRowWords(item, syntax)) {
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
