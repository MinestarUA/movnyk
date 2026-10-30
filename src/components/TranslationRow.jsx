import { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { checkTranslationQA } from "../lib/qa";
import { splitMatches } from "../lib/searching";
import { tokenizeString } from "../lib/tokens";
import {
  findWordAutocompleteSuggestions,
  getWordAutocompleteContext,
  matchFragmentCase,
} from "../lib/wordAutocomplete";
import { colorOfCode, displayColor, patchouliColorOf } from "../lib/mcFormatting";
import { getCaseShortcutAction, applyCaseShortcut } from "../lib/caseConversion";
import FormattedText from "./FormattedText";

const WORD_AUTOCOMPLETE_CLOSING_KEYS = new Set(["Enter", "Tab", "Escape"]);

const ROW_RULE =
  "linear-gradient(to right, transparent, color-mix(in srgb, var(--color-text) 8%, transparent) 48px, color-mix(in srgb, var(--color-text) 8%, transparent) calc(100% - 48px), transparent) no-repeat bottom / 100% 1px";

export const GRID_COLUMNS = "26px minmax(240px,1.3fr) minmax(240px,1.4fr) 140px";

// Renders text with search query highlighting
const HighlightedText = ({ text, queryRe }) => {
  const chunks = useMemo(() => splitMatches(text, queryRe), [text, queryRe]);
  return (
    <>
      {chunks.map((chunk, i) =>
        chunk.isMatch ? (
          <mark
            key={i}
            className="bg-yellow-400/35 text-yellow-200 px-0.5 rounded font-semibold"
          >
            {chunk.text}
          </mark>
        ) : (
          chunk.text
        )
      )}
    </>
  );
};

// Patchouli line/paragraph breaks look like "\n" escapes in the original.
const LINE_BREAK_CODE = /^\$\((?:br|br2|2br|p)\)$/i;

// Renders interactive tokens (formatting codes, escapes, placeholders) as clickable chips,
// with Minecraft formatting and colors previewed live.
const InteractiveOriginal = ({ text, onInsertToken, queryRe }) => {
  return (
    <FormattedText
      text={text}
      queryRe={queryRe}
      showWhitespace={true}
      renderToken={(run, css, idx) => {
        const token = run.token;
        const rawColor =
          token.type === "mc-code"
            ? colorOfCode(token.value)
            : token.type === "patchouli-code"
              ? patchouliColorOf(token.value)
              : null;
        const codeColor = rawColor && displayColor(rawColor);
        let badgeStyle = "bg-primary/20 text-primary border-primary/30";
        let customStyle = {};

        if (token.type === "mc-code" || codeColor) {
          if (codeColor) {
            badgeStyle = "";
            customStyle = {
              backgroundColor: `color-mix(in srgb, ${codeColor} 20%, transparent)`,
              color: codeColor,
              borderColor: `color-mix(in srgb, ${codeColor} 45%, transparent)`,
            };
          } else {
            badgeStyle = "bg-secondary/25 text-secondary border-secondary/40";
            const char = token.value[1]?.toLowerCase();
            customStyle = {
              fontWeight: char === "l" ? 700 : undefined,
              fontStyle: char === "o" ? "italic" : undefined,
              textDecoration: char === "n" ? "underline" : char === "m" ? "line-through" : undefined,
            };
          }
        } else if (token.type === "escape" || LINE_BREAK_CODE.test(token.value)) {
          badgeStyle = "bg-accent/20 text-accent border-accent/40";
        }

        return (
          <button
            key={idx}
            type="button"
            title={`Натисніть, щоб вставити «${token.value}» у переклад`}
            onClick={(e) => {
              e.stopPropagation();
              onInsertToken?.(token.value);
            }}
            style={customStyle}
            className={`inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-xs font-mono font-bold border transition-transform hover:scale-105 active:scale-95 cursor-pointer ${badgeStyle}`}
          >
            {token.value}
          </button>
        );
      }}
    />
  );
};

const SearchIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="6.5" />
    <line x1="19" y1="19" x2="14.5" y2="14.5" />
  </svg>
);

const CheckIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CopyIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const SparklesIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

const statusDotStyle = (status) => {
  const base = { width: "8px", height: "8px", borderRadius: "50%", display: "block" };
  if (status === "confirmed")
    return { ...base, background: "var(--status-confirmed)", boxShadow: "0 0 0 3px rgba(99,214,138,0.15)" };
  if (status === "pending") return { ...base, border: "1.5px solid var(--status-pending)" };
  return { ...base, border: "1.5px solid var(--color-neutral-700)" };
};

const TranslationRow = ({
  rowStyle,
  item,
  isSelected,
  focusRequestRef,
  cursorPositionRef,
  queryRe,
  qaEnabled = true,
  wordAutocompleteEnabled = true,
  wordAutocompleteWords = [],
  wordAutocompleteKeyHandlerRef,
  duplicateCount = 1,
  isSynced = true,
  onSelect,
  onTranslate,
  onConfirmToggle,
  onToggleSync,
  onCopy,
  onDefinition,
  onSuggest,
  onHeight,
  isSuggesting = false,
  showQaDetails = false,
}) => {
  const textareaRef = useRef(null);
  const rowRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const copiedTimer = useRef(null);
  const [wordAutocompleteContext, setWordAutocompleteContext] = useState(null);
  const [activeWordSuggestionIndex, setActiveWordSuggestionIndex] = useState(0);
  const [wordAutocompletePosition, setWordAutocompletePosition] = useState(null);
  const wordAutocompletePopupRef = useRef(null);
  const composingRef = useRef(false);
  const wordAutocompleteListId = `word-autocomplete-${encodeURIComponent(item.key)}`;
  const wordAutocompleteSuggestions = useMemo(
    () =>
      wordAutocompleteContext
        ? findWordAutocompleteSuggestions(wordAutocompleteWords, wordAutocompleteContext.word)
        : [],
    [wordAutocompleteContext, wordAutocompleteWords]
  );
  const selectedWordSuggestionIndex = Math.min(
    activeWordSuggestionIndex,
    Math.max(wordAutocompleteSuggestions.length - 1, 0)
  );
  const wordAutocompleteOpen =
    wordAutocompleteEnabled &&
    isSelected &&
    Boolean(wordAutocompleteContext) &&
    wordAutocompleteSuggestions.length > 0;

  const refreshWordAutocomplete = useCallback(
    (textarea) => {
      if (!wordAutocompleteEnabled || !isSelected || composingRef.current) {
        setWordAutocompleteContext(null);
        return;
      }

      const context = getWordAutocompleteContext(
        textarea.value,
        textarea.selectionStart,
        textarea.selectionEnd
      );
      if (!context || !findWordAutocompleteSuggestions(wordAutocompleteWords, context.word).length) {
        setWordAutocompleteContext(null);
        return;
      }

      // Keep the highlight when the caret re-reports the same word (e.g. on keyup after ArrowDown).
      const isSameWord =
        wordAutocompleteContext?.start === context.start &&
        wordAutocompleteContext?.word === context.word;
      setWordAutocompleteContext(context);
      if (!isSameWord) setActiveWordSuggestionIndex(0);
    },
    [isSelected, wordAutocompleteContext, wordAutocompleteEnabled, wordAutocompleteWords]
  );

  const updateWordAutocompletePosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const bounds = textarea.getBoundingClientRect();
    const textareaStyle = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    const mirroredProperties = [
      "boxSizing",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "letterSpacing",
      "lineHeight",
      "textAlign",
      "textIndent",
      "textTransform",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
    ];
    for (const property of mirroredProperties) {
      mirror.style[property] = textareaStyle[property];
    }
    mirror.style.position = "fixed";
    mirror.style.left = `${bounds.left}px`;
    mirror.style.top = `${bounds.top}px`;
    mirror.style.width = `${bounds.width}px`;
    mirror.style.minHeight = "0";
    mirror.style.maxHeight = "none";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.overflowWrap = "break-word";
    mirror.style.wordBreak = "break-word";
    mirror.textContent = textarea.value.slice(0, textarea.selectionStart ?? textarea.value.length);
    const caretMarker = document.createElement("span");
    caretMarker.textContent = "\u200b";
    mirror.appendChild(caretMarker);
    document.body.appendChild(mirror);
    const caretBounds = caretMarker.getBoundingClientRect();
    mirror.remove();

    const popupHeight = Math.min(
      wordAutocompletePopupRef.current?.offsetHeight || 156,
      Math.max(window.innerHeight - 16, 0)
    );
    const popupWidth = Math.min(320, Math.max(window.innerWidth - 16, 0));
    const left = Math.max(8, Math.min(caretBounds.left, window.innerWidth - popupWidth - 8));
    const spaceBelow = window.innerHeight - caretBounds.bottom;
    const openAbove = spaceBelow < popupHeight + 8 && caretBounds.top > popupHeight + 8;
    const top = openAbove
      ? Math.max(8, caretBounds.top - popupHeight - 4)
      : Math.min(caretBounds.bottom + 4, window.innerHeight - popupHeight - 8);

    setWordAutocompletePosition({ left, top });
  }, []);

  const acceptWordSuggestion = useCallback(
    (word) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const context = getWordAutocompleteContext(
        textarea.value,
        textarea.selectionStart,
        textarea.selectionEnd
      );
      if (!context) {
        setWordAutocompleteContext(null);
        return;
      }

      const insertedWord = matchFragmentCase(word, context.word);
      const nextValue =
        textarea.value.slice(0, context.start) + insertedWord + textarea.value.slice(context.end);
      const caret = context.start + insertedWord.length;
      onTranslate(nextValue);
      if (cursorPositionRef) {
        cursorPositionRef.current = { key: item.key, start: caret, end: caret };
      }
      setWordAutocompleteContext(null);
      requestAnimationFrame(() => {
        const currentTextarea = textareaRef.current;
        if (!currentTextarea) return;
        currentTextarea.focus();
        currentTextarea.setSelectionRange(caret, caret);
      });
    },
    [cursorPositionRef, item.key, onTranslate]
  );

  const handleWordAutocompleteKeyDown = useCallback(
    (event) => {
      if (
        !wordAutocompleteOpen ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        composingRef.current
      ) {
        return false;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setActiveWordSuggestionIndex((current) =>
          (current + direction + wordAutocompleteSuggestions.length) %
          wordAutocompleteSuggestions.length
        );
        return true;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setWordAutocompleteContext(null);
        return true;
      }

      if (
        (event.key === "Enter" && !event.shiftKey) ||
        (event.key === "Tab" && !event.shiftKey)
      ) {
        const word = wordAutocompleteSuggestions[selectedWordSuggestionIndex];
        if (!word) return false;
        event.preventDefault();
        event.stopPropagation();
        acceptWordSuggestion(word);
        return true;
      }

      return false;
    },
    [
      acceptWordSuggestion,
      selectedWordSuggestionIndex,
      wordAutocompleteOpen,
      wordAutocompleteSuggestions,
    ]
  );

  useLayoutEffect(() => {
    if (wordAutocompleteOpen) updateWordAutocompletePosition();
  }, [
    item.translated,
    wordAutocompleteOpen,
    wordAutocompleteSuggestions.length,
    updateWordAutocompletePosition,
  ]);

  useEffect(() => {
    if (!wordAutocompleteOpen) return undefined;

    const updatePosition = () => updateWordAutocompletePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updateWordAutocompletePosition, wordAutocompleteOpen]);

  useLayoutEffect(() => {
    if (!wordAutocompleteOpen || !wordAutocompleteKeyHandlerRef) return undefined;

    wordAutocompleteKeyHandlerRef.current = {
      key: item.key,
      handle: handleWordAutocompleteKeyDown,
    };
    return () => {
      if (wordAutocompleteKeyHandlerRef.current?.key === item.key) {
        wordAutocompleteKeyHandlerRef.current = null;
      }
    };
  }, [
    handleWordAutocompleteKeyDown,
    item.key,
    wordAutocompleteKeyHandlerRef,
    wordAutocompleteOpen,
  ]);

  const handleCopyClick = () => {
    onCopy();
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyKey = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(item.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  };

  const handleToggleSync = (e) => {
    e.stopPropagation();
    onToggleSync?.();
  };

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    if (isSelected && focusRequestRef?.current) {
      // A stale request (left by a row that unmounted while focused) must not
      // steal focus from a field the user has since moved to, e.g. search.
      const active = document.activeElement;
      const isOtherField =
        active?.matches?.("input, textarea, select, [contenteditable]") &&
        active.dataset.role !== "translation";
      if (isOtherField) {
        focusRequestRef.current = false;
        return;
      }
      const el = textareaRef.current;
      if (el) {
        el.focus();
        focusRequestRef.current = false;
        if (
          cursorPositionRef?.current?.key === item.key &&
          cursorPositionRef.current.start != null
        ) {
          const { start, end } = cursorPositionRef.current;
          el.setSelectionRange(start, end);
        } else if (el.value) {
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }
    }
  }, [isSelected, item.key, focusRequestRef, cursorPositionRef]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!isSelected || !el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, ACTION_STACK_HEIGHT)}px`;
  }, [isSelected, item.translated]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    return () => {
      if (el && document.activeElement === el) {
        focusRequestRef.current = true;
        if (cursorPositionRef) {
          cursorPositionRef.current = {
            key: item.key,
            start: el.selectionStart,
            end: el.selectionEnd,
          };
        }
      }
    };
  }, [item.key, focusRequestRef, cursorPositionRef]);

  const handleInsertToken = (tokenValue) => {
    const el = textareaRef.current;
    if (!el) {
      onTranslate((item.translated || "") + tokenValue);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const val = el.value || "";
    const next = val.slice(0, start) + tokenValue + val.slice(end);
    onTranslate(next);
    setTimeout(() => {
      el.focus();
      const newPos = start + tokenValue.length;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleTextareaKeyDown = (e) => {
    if (e.defaultPrevented) return;
    const action = getCaseShortcutAction(e);
    if (!action) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { value, selectionStart, selectionEnd, changed } = applyCaseShortcut(
      el.value,
      el.selectionStart,
      el.selectionEnd,
      action
    );
    if (!changed) return;
    if (cursorPositionRef) {
      cursorPositionRef.current = {
        key: item.key,
        start: selectionStart,
        end: selectionEnd,
      };
    }
    onTranslate(value);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  };

  const hasDraft = Boolean(item.translated.trim());
  const hasCodes = useMemo(
    () => tokenizeString(item.translated || "").some((t) => t.type === "mc-code" && t.value[0] === "§"),
    [item.translated]
  );
  const status = item.confirmed ? "confirmed" : hasDraft ? "pending" : "empty";
  const expanded = isSelected;
  const stop = (e) => e.stopPropagation();

  // Report the expanded row's real height before paint, after the textarea has
  // been sized above, so the list never lays out a stale height for this row.
  useLayoutEffect(() => {
    if (expanded && rowRef.current && onHeight) onHeight(rowRef.current.offsetHeight);
  }, [expanded, item.translated, onHeight]);

  // Run QA checks
  const qaIssues = useMemo(() => {
    if (!qaEnabled || !hasDraft) return [];
    return checkTranslationQA(item.original, item.translated);
  }, [qaEnabled, hasDraft, item.original, item.translated]);

  const outerStyle = {
    ...rowStyle,
    // The list assigns the expanded row the height it last reported; sizing to
    // content instead lets offsetHeight measure the real height so it can grow.
    ...(expanded && { height: "auto" }),
    display: "grid",
    gridTemplateColumns: GRID_COLUMNS,
    gap: "var(--space-6)",
    padding: expanded ? "9px var(--space-2)" : "0 var(--space-2)",
    alignItems: expanded ? "start" : "center",
    minHeight: expanded ? ROW_EXPANDED : ROW_COLLAPSED,
    background: expanded ? "var(--color-surface)" : ROW_RULE,
    borderRadius: expanded ? "var(--radius-md)" : "0",
    borderLeft: expanded ? "2px solid var(--accent-pink)" : "2px solid transparent",
    boxShadow: expanded ? "var(--shadow-sm)" : "none",
    cursor: "pointer",
    boxSizing: "border-box",
  };

  const wordAutocompleteMenu =
    wordAutocompleteOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={wordAutocompletePopupRef}
            id={wordAutocompleteListId}
            role="listbox"
            aria-label="Підказки слів"
            className="rounded-lg border border-base-content/20 bg-base-200 py-1 shadow-xl"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "fixed",
              left: wordAutocompletePosition?.left ?? 8,
              top: wordAutocompletePosition?.top ?? 8,
              zIndex: 2000,
              minWidth: "144px",
              maxWidth: "min(320px, calc(100vw - 16px))",
              maxHeight: "min(160px, calc(100vh - 16px))",
              overflowY: "auto",
              visibility: wordAutocompletePosition ? "visible" : "hidden",
            }}
          >
            {wordAutocompleteSuggestions.map((word, index) => (
              <div
                key={`${word}-${index}`}
                id={`${wordAutocompleteListId}-option-${index}`}
                role="option"
                aria-selected={index === selectedWordSuggestionIndex}
                className={`cursor-pointer px-3 py-1 text-sm ${
                  index === selectedWordSuggestionIndex
                    ? "bg-primary/20 text-primary"
                    : "text-base-content hover:bg-base-300"
                }`}
                onMouseEnter={() => setActiveWordSuggestionIndex(index)}
                onClick={() => acceptWordSuggestion(word)}
              >
                {word}
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rowRef} style={outerStyle} onClick={onSelect}>
      {/* 1. Status Dot */}
      <div style={{ display: "flex", alignItems: expanded ? "flex-start" : "center", paddingTop: expanded ? "4px" : 0 }}>
        <span style={statusDotStyle(status)} />
      </div>

      {/* 2. Source Column: Original String on top, Key underneath (Compact 2-row layout) */}
      <div className="flex flex-col justify-center min-w-0 pr-2">
        {/* Top: Original text */}
        <div
          style={{
            fontSize: "13px",
            color: "var(--color-neutral-200)",
            lineHeight: 1.4,
            whiteSpace: expanded ? "pre-wrap" : "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {expanded ? (
            <InteractiveOriginal
              text={item.original}
              onInsertToken={handleInsertToken}
              queryRe={queryRe}
            />
          ) : (
            <FormattedText text={item.original} queryRe={queryRe} />
          )}
        </div>

        {/* Bottom: Key with optional duplicate badge */}
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0 text-[11px] text-base-content/40 font-mono">
          <span
            className="truncate select-text hover:text-base-content/70 transition-colors"
            title={item.key}
          >
            <HighlightedText text={item.key} queryRe={queryRe} />
          </span>
          {expanded && (
            <button
              type="button"
              onClick={handleCopyKey}
              className="text-[10px] opacity-60 hover:opacity-100 transition-opacity shrink-0 px-1 py-0.5 rounded bg-base-300"
              title="Скопіювати ключ"
            >
              {copiedKey ? "✓" : "📋"}
            </button>
          )}
          {duplicateCount > 1 && (
            <button
              type="button"
              onClick={handleToggleSync}
              aria-pressed={isSynced}
              className={
                isSynced
                  ? "badge badge-xs badge-info font-sans shrink-0 cursor-pointer hover:opacity-80 transition-opacity border-0"
                  : "badge badge-xs badge-ghost font-sans shrink-0 cursor-pointer opacity-55 hover:opacity-100 transition-opacity line-through"
              }
              title={
                isSynced
                  ? `Цей вихідний текст повторюється у ${duplicateCount} ключах. Зміни синхронізуються автоматично. Натисніть, щоб вимкнути синхронізацію для цієї групи.`
                  : `Цей вихідний текст повторюється у ${duplicateCount} ключах. Синхронізацію для цієї групи вимкнено. Натисніть, щоб увімкнути.`
              }
            >
              🔄 {duplicateCount}
            </button>
          )}
        </div>
      </div>

      {/* 3. Translation Column */}
      <div className="flex flex-col justify-center min-w-0">
        {expanded ? (
          <div>
            <div
              className="relative transition-colors"
              style={{
                width: "100%",
                minHeight: `${ACTION_STACK_HEIGHT}px`,
                background: "var(--color-bg)",
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-md)",
              }}
              onFocusCapture={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
              onBlurCapture={(e) => (e.currentTarget.style.borderColor = "var(--color-divider)")}
            >
              {/* Mirror overlay displaying formatted preview while editing */}
              {hasCodes && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    padding: "8px 10px",
                    color: "var(--color-text)",
                    fontSize: "13px",
                    fontFamily: "var(--font-body)",
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                    overflow: "hidden",
                    pointerEvents: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <FormattedText text={item.translated} widthNeutral={true} />
                  {item.translated.endsWith("\n") && "\u200b"}
                </div>
              )}

              <textarea
                ref={textareaRef}
                data-role="translation"
                data-key={item.key}
                value={item.translated}
                lang="uk"
                spellCheck={true}
                aria-autocomplete={wordAutocompleteEnabled ? "list" : undefined}
                aria-controls={wordAutocompleteOpen ? wordAutocompleteListId : undefined}
                aria-expanded={wordAutocompleteOpen}
                aria-activedescendant={
                  wordAutocompleteOpen
                    ? `${wordAutocompleteListId}-option-${selectedWordSuggestionIndex}`
                    : undefined
                }
                onKeyDown={handleTextareaKeyDown}
                onChange={(e) => {
                  onTranslate(e.target.value);
                  if (cursorPositionRef) {
                    cursorPositionRef.current = {
                      key: item.key,
                      start: e.target.selectionStart,
                      end: e.target.selectionEnd,
                    };
                  }
                  refreshWordAutocomplete(e.target);
                }}
                onSelect={(e) => {
                  if (cursorPositionRef) {
                    cursorPositionRef.current = {
                      key: item.key,
                      start: e.target.selectionStart,
                      end: e.target.selectionEnd,
                    };
                  }
                  refreshWordAutocomplete(e.target);
                }}
                onKeyUp={(e) => {
                  if (cursorPositionRef) {
                    cursorPositionRef.current = {
                      key: item.key,
                      start: e.target.selectionStart,
                      end: e.target.selectionEnd,
                    };
                  }
                  // Enter, Tab and Escape already handled the popup on keydown; refreshing here would reopen it.
                  if (!WORD_AUTOCOMPLETE_CLOSING_KEYS.has(e.key)) {
                    refreshWordAutocomplete(e.target);
                  }
                }}
                onMouseUp={(e) => {
                  if (cursorPositionRef) {
                    cursorPositionRef.current = {
                      key: item.key,
                      start: e.target.selectionStart,
                      end: e.target.selectionEnd,
                    };
                  }
                  refreshWordAutocomplete(e.target);
                }}
                onFocus={(e) => {
                  onSelect();
                  if (cursorPositionRef) {
                    cursorPositionRef.current = {
                      key: item.key,
                      start: e.target.selectionStart,
                      end: e.target.selectionEnd,
                    };
                  }
                  refreshWordAutocomplete(e.target);
                }}
                onBlur={() => setWordAutocompleteContext(null)}
                onCompositionStart={() => {
                  composingRef.current = true;
                  setWordAutocompleteContext(null);
                }}
                onCompositionEnd={(e) => {
                  composingRef.current = false;
                  refreshWordAutocomplete(e.target);
                }}
                onClick={stop}
                placeholder="Введіть український переклад…"
                aria-label={`Переклад для ${item.key}`}
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: `${ACTION_STACK_HEIGHT}px`,
                  background: "transparent",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 10px",
                  color: hasCodes ? "transparent" : "var(--color-text)",
                  caretColor: "var(--color-text)",
                  fontSize: "13px",
                  fontFamily: "var(--font-body)",
                  lineHeight: 1.4,
                  resize: "none",
                  overflow: "hidden",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              {/* QA Warnings with Quick Fix buttons */}
              {qaIssues.length > 0 && (
                <div className="absolute left-2 z-10 flex gap-1.5" style={{ bottom: "6px" }}>
                  {qaIssues.map((issue, idx) => {
                    const isInfo = issue.severity === "info";
                    const badgeClass = isInfo
                      ? "bg-info/15 text-info border-info/30"
                      : "bg-warning/15 text-warning border-warning/30";
                    const icon = isInfo ? "ℹ️" : "⚠️";
  
                    return (
                      <span
                        key={idx}
                        className={`qa-tip ${showQaDetails ? "qa-tip-open" : ""} inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] pl-2 pr-1.5 py-0.5 rounded border font-medium bg-base-200 ${badgeClass}`}
                        data-tip={issue.message}
                      >
                        <span>{icon}</span>
                        {typeof issue.fix === "function" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const fixed = issue.fix(item.translated);
                              if (fixed !== item.translated) {
                                onTranslate(fixed);
                              }
                            }}
                            className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-base-100/70 hover:bg-base-100 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-current/20 shadow-xs"
                          >
                            Виправити ⚡
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              style={{
                fontSize: "13px",
                color: hasDraft ? "var(--color-neutral-200)" : "var(--color-neutral-600)",
                fontStyle: hasDraft ? "normal" : "italic",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {hasDraft ? (
                <FormattedText text={item.translated} queryRe={queryRe} />
              ) : (
                "Переклади…"
              )}
            </div>
            {qaIssues.length > 0 && (
              <span
                className={`${qaIssues.every((i) => i.severity === "info") ? "text-info" : "text-warning"} text-xs shrink-0 cursor-help`}
                title={qaIssues.map((i) => i.message).join("\n")}
              >
                {qaIssues.every((i) => i.severity === "info") ? "ℹ️" : "⚠️"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. Actions Column */}
      {expanded ? (
        <div
          onClick={stop}
          style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "stretch" }}
        >
          {/* AI Suggestion Button */}
          {onSuggest && (
            <button
              type="button"
              className={`btn btn-sm btn-outline btn-primary text-xs ${isSuggesting ? "loading" : ""}`}
              onClick={() => onSuggest(item)}
              disabled={isSuggesting}
              title="Запропонувати автоматичний переклад через ШІ"
            >
              <SparklesIcon size={14} />
              {isSuggesting ? "Переклад..." : "ШІ-переклад"}
            </button>
          )}

          <button
            type="button"
            className={`btn btn-sm text-xs ${
              item.confirmed ? "btn-success" : "btn-neutral"
            }`}
            onClick={onConfirmToggle}
            disabled={!hasDraft}
            title={item.confirmed ? "Зняти затвердження" : "Затвердити переклад"}
          >
            <CheckIcon size={14} />
            {item.confirmed ? "Затверджено" : "Затвердити"}
          </button>

          <button
            type="button"
            className="btn btn-sm btn-ghost text-xs"
            onClick={handleCopyClick}
            title="Копіювати оригінальний текст"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            {copied ? "Скопійовано" : "Копіювати"}
          </button>

          {onDefinition && (
            <button
              type="button"
              className="btn btn-sm btn-ghost text-xs opacity-70 hover:opacity-100"
              onClick={onDefinition}
              title="Пошук перекладу в Google"
            >
              <SearchIcon size={13} />
              Google
            </button>
          )}
        </div>
      ) : (
        <div onClick={stop} style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
          {onSuggest && (
            <button
              type="button"
              className="btn btn-xs btn-ghost text-primary"
              onClick={() => onSuggest(item)}
              disabled={isSuggesting}
              title="Запропонувати ШІ-переклад"
            >
              <SparklesIcon size={13} />
            </button>
          )}
          <button
            type="button"
            className={`btn btn-xs ${
              item.confirmed ? "btn-success" : "btn-ghost text-base-content/50"
            }`}
            onClick={onConfirmToggle}
            disabled={!hasDraft}
            title={item.confirmed ? "Зняти затвердження" : "Затвердити переклад"}
          >
            <CheckIcon size={13} />
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost text-base-content/50"
            onClick={handleCopyClick}
            title={copied ? "Скопійовано" : "Копіювати оригінал"}
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          </button>
        </div>
      )}
      {wordAutocompleteMenu}
    </div>
  );
};

// Four btn-sm buttons (32px) plus three 6px gaps.
const ACTION_STACK_HEIGHT = 146;
export const ROW_COLLAPSED = 52;
export const ROW_EXPANDED = 165;

export default TranslationRow;
