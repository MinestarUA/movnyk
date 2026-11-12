import { Fragment, useState, useEffect, useRef, useMemo, useCallback } from "react";
import JSZip from "jszip";
import { List } from "react-window";
import TranslationRow, { GRID_COLUMNS, ROW_COLLAPSED, ROW_EXPANDED } from "./TranslationRow";
import Sidebar from "./Sidebar";
import SettingsModal from "./SettingsModal";
import WalkingCat from "./WalkingCat.jsx";
import RewardsLayer from "./RewardsLayer";
import LevelUpScreen from "./LevelUpScreen";
import { useToast } from "./Toast";
import { loadSettings, saveSettings, hasApiKey, buildSearchPrompt } from "../lib/settings";
import { translateAll, translateSingle } from "../lib/ai";
import { ApiKeyError } from "../lib/apiErrors";
import { mergeLangFile } from "../lib/importing";
import { collectTranslationFiles, translationsFromArchive } from "../lib/translationArchive";
import { saveSession } from "../lib/sessions";
import { loadBookSources } from "../lib/bookSources";
import { levelForProgress } from "../lib/rewards";
import { useLevelUps } from "../lib/useLevelUps";
import { GOOSE_MIN_LEVEL, useGooseEvent } from "../lib/useGooseEvent";
import GooseEvent from "./GooseEvent";
import {
  isTranslatable,
  isGroupSynced,
  toggleGroupSync,
  updateTranslation,
  confirmTranslation,
  applyAutoTranslations,
  applyBulkEdit,
  revertBulkEdit,
} from "../lib/translations";
import ProjectReferenceDrawer from "./ProjectReferenceDrawer";
import { applyNewLangOriginal } from "../lib/originalUpdate";
import {
  compileQuery,
  isFindShortcut,
  isReferenceSearchShortcut,
  itemMatches,
  translationMatches,
  replaceInTranslation,
  planOriginalFill,
} from "../lib/searching";
import { getCaseShortcutAction, applyCaseShortcut } from "../lib/caseConversion";
import { getTokenShortcutIndex, isQaShortcut } from "../lib/keyboardShortcuts";
import { checkTranslationQA } from "../lib/qa";
import { extractTokens } from "../lib/tokens";
import { buildWordAutocompleteWords } from "../lib/wordAutocomplete";
import { activeSyntaxIds, detectSyntaxExtensions, getSyntax } from "../lib/syntaxExtensions";
import { bookFormatOf, isBookKey, rowInScope } from "../lib/patchouli";

// Text the user has selected: inside a text field it is the field's selection,
// elsewhere the page selection. Trimmed, empty string when nothing is selected.
const getSelectedText = (active) => {
  let selected;
  if (
    (active?.tagName === "TEXTAREA" || active?.tagName === "INPUT") &&
    typeof active.selectionStart === "number"
  ) {
    selected = active.value.substring(active.selectionStart, active.selectionEnd);
  } else {
    selected = window.getSelection()?.toString() ?? "";
  }
  return selected.trim();
};

const COLUMN_HEADER = "text-[10px] font-medium tracking-widest text-gray-500";
const PROGRESS_COUNTER = "whitespace-nowrap text-xs tabular-nums text-gray-400";
const HEADER_ICON_BTN =
  "flex shrink-0 items-center justify-center rounded-lg border border-base-content/15 text-gray-400";
const TEXT_INPUT =
  "h-9 w-full rounded-l-lg border border-r-0 bg-base-200 text-[13px] text-base-content outline-none";
// The lighter accent shade keeps small active text above 4:1 on the tinted background.
const ACCENT_TEXT = "text-[color:var(--color-accent-400)]";

// Segmented search toggles: the last one closes the group with a right edge.
const toggleBtnClass = (active, isLast = false) =>
  [
    "h-9 border-y border-l px-2.5 text-xs font-medium",
    isLast ? "rounded-r-lg border-r" : "border-r-0",
    active ? `border-accent bg-accent/10 ${ACCENT_TEXT}` : "border-base-content/15 bg-base-200 text-gray-400",
  ].join(" ");

const CHIP_BASE =
  "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold";
const chipClass = (active, tint) => `${CHIP_BASE} ${active ? tint.on : tint.off}`;
const CHIP_DOT = "size-1.5 shrink-0 rounded-full";
const SKY_CHIP = {
  on: "border-blue-400 bg-blue-400/20 text-blue-300",
  off: "border-blue-400/30 bg-blue-400/10 text-blue-300",
};
// Pink stays reserved for actions, so the untranslated filter uses the accent.
const ACCENT_CHIP = {
  on: `border-accent bg-accent/20 ${ACCENT_TEXT}`,
  off: `border-accent/30 bg-accent/10 ${ACCENT_TEXT}`,
  dot: "bg-accent",
};
const AMBER_CHIP = {
  on: "border-warning bg-warning/20 text-warning",
  off: "border-warning/30 bg-warning/10 text-warning",
  dot: "bg-warning",
};

const SHORTCUTS = [
  ["Enter", "наступний"],
  ["Ctrl+↑/↓", "навігація"],
  ["Ctrl+F", "пошук"],
  ["Alt+Z/X/C", "регістр"],
  ["Alt+Q", "попередження"],
  ["Alt+1…9", "токен з оригіналу"],
  ["Esc", "до рядка"],
];

const EditorScreen = ({
  initialTranslations,
  initialRemovedRows = [],
  session,
  modalOpen = false,
  onExportJson,
  onExportResourcePack,
  onExportClipboard,
  onHome,
}) => {
  const toast = useToast();
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiState, setAiState] = useState({ running: false, done: 0, total: 0 });
  const abortRef = useRef(null);
  const [translations, setTranslations] = useState(() =>
    initialTranslations.map((t) => ({
      key: t.key,
      original: t.original,
      translated: typeof t.translated === "string" ? t.translated : "",
      confirmed: Boolean(t.confirmed),
      unsynced: Boolean(t.unsynced),
    }))
  );
  const openedTranslationsRef = useRef(translations);
  // An archive import awaits file reads, so it merges into the rows as they are
  // when the read finishes, not as they were when it started.
  const latestTranslationsRef = useRef(translations);
  useEffect(() => {
    latestTranslationsRef.current = translations;
  }, [translations]);

  // Detected from the current lang originals, so applying a new original re-detects.
  const [detectedSyntaxIds, setDetectedSyntaxIds] = useState(() =>
    detectSyntaxExtensions(
      Object.fromEntries(translations.filter((t) => !isBookKey(t.key)).map((t) => [t.key, t.original]))
    )
  );
  const books = session.books ?? [];
  // Book text is always the markup of its format, whatever the settings or
  // detection say; lang rows follow the settings.
  const langSyntaxIds = activeSyntaxIds(settings, detectedSyntaxIds);
  const langSyntax = getSyntax(langSyntaxIds);
  const syntaxFor = useCallback(
    (key) => {
      const format = bookFormatOf(key);
      return format ? getSyntax([format]) : langSyntax;
    },
    [langSyntax]
  );
  const wordSyntax = useMemo(() => {
    const bookFormats = translations.map((t) => bookFormatOf(t.key)).filter(Boolean);
    return getSyntax([...new Set([...langSyntax.extensions.map(({ id }) => id), ...bookFormats])]);
  }, [translations, langSyntax]);

  const [query, setQuery] = useState("");
  // { key, text }: the row whose QA warning details Alt+Q has opened, and the text they were opened for.
  const [qaDetails, setQaDetails] = useState(null);
  const [regexMode, setRegexMode] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [showFillPreview, setShowFillPreview] = useState(false);
  const [replaceValue, setReplaceValue] = useState("");
  const [preserveCase, setPreserveCase] = useState(false);
  const [filterUntranslated, setFilterUntranslated] = useState(false);
  const [filterUnconfirmed, setFilterUnconfirmed] = useState(false);
  const [scope, setScope] = useState("all"); // "all" | "lang" | a book root
  const [selectedKey, setSelectedKey] = useState(() => translations[0]?.key ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [referenceDrawerOpen, setReferenceDrawerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shortcutsRef = useRef(null);
  const [referenceQuery, setReferenceQuery] = useState("");
  // Rows dropped from the editor by an original update. Not editable, but the
  // reference panel still finds their translations.
  const [removedRows, setRemovedRows] = useState(initialRemovedRows);
  const [suggestingKey, setSuggestingKey] = useState(null);
  const wordAutocompleteEnabled = settings.wordAutocompleteEnabled !== false;
  const wordAutocompleteWords = useMemo(
    () => (wordAutocompleteEnabled ? buildWordAutocompleteWords(translations, wordSyntax) : []),
    [translations, wordAutocompleteEnabled, wordSyntax]
  );

  const duplicateCounts = useMemo(() => {
    const counts = new Map();
    for (const t of translations) {
      if (t.original) {
        counts.set(t.original, (counts.get(t.original) || 0) + 1);
      }
    }
    return counts;
  }, [translations]);

  const listRef = useRef(null);
  // Only pull focus into a row when the user navigates via keyboard, so typing
  // in the search box (or clicking elsewhere) is never interrupted.
  const focusRequestRef = useRef(true);
  const cursorPositionRef = useRef({ key: null, start: null, end: null });
  const referenceInputRef = useRef(null);
  const wordAutocompleteKeyHandlerRef = useRef(null);

  const { re: queryRe, error: queryError } = useMemo(
    () => compileQuery(query, { regex: regexMode, caseSensitive, wholeWord }),
    [query, regexMode, caseSensitive, wholeWord]
  );

  const confirmedCount = useMemo(
    () => translations.filter((t) => t.confirmed && isTranslatable(t)).length,
    [translations]
  );
  const total = useMemo(
    () => translations.filter(isTranslatable).length,
    [translations]
  );
  const progress = total ? Math.floor((confirmedCount / total) * 100) : 0;

  const rewardsEnabled = settings.rewardsEnabled !== false;
  const { unlockedLevel, celebratingLevel, queuedCount, dismiss, dismissAll } = useLevelUps(
    levelForProgress(confirmedCount, total),
    rewardsEnabled
  );
  const rewardClasses = rewardsEnabled
    ? [5, 6, 10, 14, 27].filter((n) => unlockedLevel >= n).map((n) => `rw-p${n}`).join(" ")
    : "";
  const { stolenKey, returnRow } = useGooseEvent({
    translations,
    selectedKey,
    active: rewardsEnabled && unlockedLevel >= GOOSE_MIN_LEVEL,
  });

  const filtered = useMemo(() => {
    const statusActive = filterUntranslated || filterUnconfirmed;
    const result = [];
    translations.forEach((item, originalIndex) => {
      if (item.key === stolenKey) return;
      const matchesQuery = queryError ? false : !queryRe || itemMatches(item, queryRe);
      const empty = !item.translated.trim();
      const translatable = isTranslatable(item);
      const matchesStatus =
        !statusActive ||
        (filterUntranslated && empty && translatable) ||
        (filterUnconfirmed && !empty && !item.confirmed && translatable);
      const passes = matchesQuery && matchesStatus && rowInScope(item.key, scope);
      // The selected row is pinned into view even when it fails the query or
      // status filter, so the row being edited never vanishes mid-work.
      const pinned = !passes && item.key === selectedKey;
      if (passes || pinned) result.push({ ...item, originalIndex, pinned });
    });
    return result;
  }, [translations, queryRe, queryError, filterUntranslated, filterUnconfirmed, scope, selectedKey, stolenKey]);

  // Rows the status filter hides even though they match the search query —
  // surfaced as a banner so a filtered-out search is never a dead end.
  const hiddenMatches = useMemo(() => {
    if (!queryRe || queryError) return 0;
    if (!(filterUntranslated || filterUnconfirmed)) return 0;
    if (filtered.some((item) => !item.pinned)) return 0;
    return translations.filter((t) => rowInScope(t.key, scope) && itemMatches(t, queryRe)).length;
  }, [translations, queryRe, queryError, filterUntranslated, filterUnconfirmed, scope, filtered]);

  const untranslatedCount = useMemo(
    () =>
      translations.filter((t) => !t.translated.trim() && isTranslatable(t)).length,
    [translations]
  );
  const unconfirmedCount = useMemo(
    () =>
      translations.filter((t) => t.translated.trim() && !t.confirmed && isTranslatable(t))
        .length,
    [translations]
  );

  // Character-weighted progress: a long confirmed row moves the second cat
  // further than a short one. Weight is the source string length.
  const charTotal = useMemo(
    () => translations.filter(isTranslatable).reduce((sum, t) => sum + t.original.length, 0),
    [translations]
  );
  const confirmedChars = useMemo(
    () =>
      translations
        .filter((t) => t.confirmed && isTranslatable(t))
        .reduce((sum, t) => sum + t.original.length, 0),
    [translations]
  );
  const charProgress = charTotal ? Math.floor((confirmedChars / charTotal) * 100) : 0;

  // Derive the effective selection so it stays valid when the filtered set
  // changes, without needing an effect to reconcile state.
  const rawIndex = useMemo(
    () => filtered.findIndex((item) => item.key === selectedKey),
    [filtered, selectedKey]
  );
  const activeIndex = rawIndex >= 0 ? rawIndex : filtered.length > 0 ? 0 : -1;
  const activeKey = activeIndex >= 0 ? filtered[activeIndex].key : null;
  // Warning details stay open only while the row's text is unchanged, so any edit or fix hides them.
  const activeItem = activeIndex >= 0 ? filtered[activeIndex] : null;
  const qaDetailsVisible = Boolean(
    qaDetails && activeItem && qaDetails.key === activeItem.key && qaDetails.text === activeItem.translated
  );

  // Persist progress to this session's slot, debounced so rapid typing does
  // not hammer localStorage. Merely opening a session saves nothing, so it
  // keeps its place in the recent list. Leaving the editor flushes a pending
  // save so the last edit survives.
  const quotaWarnedRef = useRef(false);
  const pendingSaveRef = useRef(null);
  useEffect(() => {
    if (translations === openedTranslationsRef.current) return;
    const save = () => {
      pendingSaveRef.current = null;
      const ok = saveSession({ ...session, translations });
      if (!ok && !quotaWarnedRef.current) {
        quotaWarnedRef.current = true;
        toast("Не вдалося зберегти сесію: вичерпано сховище браузера.", "warning");
      }
    };
    pendingSaveRef.current = save;
    const id = setTimeout(save, 400);
    return () => clearTimeout(id);
  }, [session, translations, toast]);
  useEffect(() => () => pendingSaveRef.current?.(), []);

  // Scroll the selected row into view.
  useEffect(() => {
    if (listRef.current && activeIndex >= 0) {
      listRef.current.scrollToRow({ index: activeIndex, align: "smart" });
    }
  }, [activeIndex]);

  const move = useCallback(
    (delta) => {
      if (filtered.length === 0) return;
      const base = activeIndex >= 0 ? activeIndex : 0;
      const next = Math.min(Math.max(base + delta, 0), filtered.length - 1);
      focusRequestRef.current = true;
      setSelectedKey(filtered[next].key);
    },
    [filtered, activeIndex]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Dialogs own the keyboard: the editor's shortcuts must not fire behind them.
      if (modalOpen || settingsOpen) return;
      // The editor listens in the capture phase, before the level-up screen dismisses on Enter.
      if (celebratingLevel && e.key === "Enter") {
        e.preventDefault();
        return;
      }

      // Escape closes the shortcut popover and goes no further, so it does not also run the editor's Esc handling.
      if (shortcutsOpen && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setShortcutsOpen(false);
        return;
      }

      const active = document.activeElement;
      const isTranslationField = active?.dataset?.role === "translation";

      const caseAction = getCaseShortcutAction(e);
      if (caseAction) {
        e.preventDefault();
        e.stopPropagation();
        const isOtherEditable =
          (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA") && !isTranslationField;
        if (isOtherEditable) return;

        const activeItem = activeIndex >= 0 ? filtered[activeIndex] : null;
        if (!activeItem) return;

        const el = isTranslationField
          ? active
          : document.querySelector(
              `textarea[data-role="translation"][data-key="${CSS.escape(activeItem.key)}"]`
            );
        const currentText = el ? el.value : activeItem.translated;
        const savedPos =
          cursorPositionRef.current?.key === activeItem.key ? cursorPositionRef.current : null;
        const selStart = el ? el.selectionStart : (savedPos?.start ?? currentText.length);
        const selEnd = el ? el.selectionEnd : (savedPos?.end ?? selStart);

        const { value, selectionStart, selectionEnd, changed } = applyCaseShortcut(
          currentText,
          selStart,
          selEnd,
          caseAction,
          syntaxFor(activeItem.key)
        );
        cursorPositionRef.current = {
          key: activeItem.key,
          start: selectionStart,
          end: selectionEnd,
        };
        if (changed) {
          setTranslations((prev) =>
            updateTranslation(prev, activeItem.originalIndex, value, {
              syncIdenticalTranslations: settings.syncIdenticalTranslations,
              unconfirmOnEdit: settings.unconfirmOnEdit,
            })
          );
        }
        requestAnimationFrame(() => {
          const targetEl = document.querySelector(
            `textarea[data-role="translation"][data-key="${CSS.escape(activeItem.key)}"]`
          );
          if (targetEl) {
            targetEl.focus();
            targetEl.setSelectionRange(selectionStart, selectionEnd);
          }
        });
        return;
      }

      // Alt+Q: first press shows the active row's QA details, second press applies its fixes.
      if (isQaShortcut(e)) {
        e.preventDefault();
        const item = activeItem;
        if (!item || settings.qaChecksEnabled === false) return;
        const issues = checkTranslationQA(item.original, item.translated, syntaxFor(item.key), item.key);
        if (issues.length === 0) return;
        if (!qaDetailsVisible) {
          setQaDetails({ key: item.key, text: item.translated });
          return;
        }
        const fixed = issues.reduce(
          (text, issue) => (typeof issue.fix === "function" ? issue.fix(text) : text),
          item.translated
        );
        setQaDetails(null);
        if (fixed !== item.translated) {
          setTranslations((prev) =>
            updateTranslation(prev, item.originalIndex, fixed, {
              syncIdenticalTranslations: settings.syncIdenticalTranslations,
              unconfirmOnEdit: settings.unconfirmOnEdit,
            })
          );
        }
        return;
      }

      // Alt+1…9 inserts the Nth token of the focused row's original at the caret.
      const tokenIndex = getTokenShortcutIndex(e);
      if (tokenIndex !== null && isTranslationField) {
        e.preventDefault();
        const item = filtered.find((row) => row.key === active.dataset.key);
        const token = item && extractTokens(item.original, syntaxFor(item.key))[tokenIndex - 1];
        if (!token) return;
        const next = active.value.slice(0, active.selectionStart) + token.value + active.value.slice(active.selectionEnd);
        const caret = active.selectionStart + token.value.length;
        cursorPositionRef.current = { key: item.key, start: caret, end: caret };
        setTranslations((prev) =>
          updateTranslation(prev, item.originalIndex, next, {
            syncIdenticalTranslations: settings.syncIdenticalTranslations,
            unconfirmOnEdit: settings.unconfirmOnEdit,
          })
        );
        requestAnimationFrame(() => {
          const el = document.querySelector(
            `textarea[data-role="translation"][data-key="${CSS.escape(item.key)}"]`
          );
          el?.focus();
          el?.setSelectionRange(caret, caret);
        });
        return;
      }

      if (
        isTranslationField &&
        wordAutocompleteKeyHandlerRef.current?.key === active.dataset.key &&
        wordAutocompleteKeyHandlerRef.current.handle(e)
      ) {
        return;
      }

      // Ctrl/Cmd + Shift + F toggles or focuses the independent project reference panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "F" || e.code === "KeyF" || e.key === "f")) {
        e.preventDefault();
        if (!referenceDrawerOpen) {
          setReferenceDrawerOpen(true);
        } else if (!referenceInputRef.current || document.activeElement === referenceInputRef.current) {
          setReferenceDrawerOpen(false);
        } else {
          referenceInputRef.current?.focus();
        }
        return;
      }

      // Ctrl/Cmd + F opens the in-app search instead of the browser's find,
      // carrying the current text selection (key, original or translation)
      // into the search field. Focus moves to search only if enabled in settings.
      // Ctrl/Cmd + D does the same for the reference panel: the selection becomes
      // its query and the panel takes focus.
      if (isReferenceSearchShortcut(e)) {
        e.preventDefault();
        const selected = getSelectedText(active);
        if (selected) setReferenceQuery(selected);
        setReferenceDrawerOpen(true);
        referenceInputRef.current?.focus();
        return;
      }

      if (isFindShortcut(e)) {
        const selected = getSelectedText(active);

        if (selected) {
          e.preventDefault();
          setQuery(selected);
          if (settings.focusSearchOnFind) {
            const searchInput = document.getElementById("translation-search");
            searchInput?.focus();
            searchInput?.select();
          }
          return;
        }

        if (settings.focusSearchOnFind) {
          e.preventDefault();
          const searchInput = document.getElementById("translation-search");
          searchInput?.focus();
          searchInput?.select();
          return;
        }
        return;
      }

      // Escape clears the search query from anywhere in the editor.
      // Keeps focus and caret in the current translation field without shifting.
      if (e.key === "Escape") {
        let cleared = false;
        setQuery((q) => {
          if (q) {
            cleared = true;
            return "";
          }
          return q;
        });
        if (cleared) {
          e.preventDefault();
          if (isTranslationField && active) {
            focusRequestRef.current = true;
            cursorPositionRef.current = {
              key: activeKey,
              start: active.selectionStart,
              end: active.selectionEnd,
            };
            requestAnimationFrame(() => {
              const el = document.querySelector(
                `textarea[data-role="translation"][data-key="${CSS.escape(activeKey)}"]`
              );
              if (el) {
                el.focus();
                if (cursorPositionRef.current?.start != null) {
                  el.setSelectionRange(
                    cursorPositionRef.current.start,
                    cursorPositionRef.current.end
                  );
                }
              }
            });
          }
          return;
        }
      }

      // Esc outside a field (or with focus on body) returns focus to the last working row.
      // Dialogs and the reference drawer keep their own Escape handling.
      if (
        e.key === "Escape" &&
        !isTranslationField &&
        activeKey &&
        !referenceDrawerOpen &&
        !celebratingLevel &&
        !active?.closest?.("dialog, [role='dialog']")
      ) {
        e.preventDefault();
        focusRequestRef.current = true;
        listRef.current?.scrollToRow({ index: activeIndex, align: "smart" });
        requestAnimationFrame(() => {
          document
            .querySelector(`textarea[data-role="translation"][data-key="${CSS.escape(activeKey)}"]`)
            ?.focus();
        });
        return;
      }

      // Enter (without Shift) inside a translation field confirms the current
      // entry (when non-empty) and advances to the next one.
      if (e.key === "Enter" && !e.shiftKey && isTranslationField) {
        e.preventDefault();
        if (activeKey) {
          setTranslations((prev) =>
            confirmTranslation(prev, activeKey, {
              syncIdenticalTranslations: settings.syncIdenticalTranslations,
              toggle: false,
            })
          );
        }
        move(1);
        return;
      }

      // Ctrl/Cmd + Arrow navigates even while typing.
      if ((e.ctrlKey || e.metaKey) && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        move(e.key === "ArrowDown" ? 1 : -1);
        return;
      }

      // If focus fell to <body> (the focused row was scrolled out of the
      // virtualized window), a printable key scrolls back and refocuses,
      // restoring the caret position.
      if (
        active === document.body &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        activeIndex >= 0 &&
        activeKey
      ) {
        e.preventDefault();
        focusRequestRef.current = true;
        listRef.current?.scrollToRow({ index: activeIndex, align: "smart" });
        requestAnimationFrame(() => {
          const el = document.querySelector(
            `textarea[data-role="translation"][data-key="${CSS.escape(activeKey)}"]`
          );
          if (el) {
            el.focus();
            if (
              cursorPositionRef.current?.key === activeKey &&
              cursorPositionRef.current.start != null
            ) {
              el.setSelectionRange(
                cursorPositionRef.current.start,
                cursorPositionRef.current.end
              );
            }
          }
        });
        return;
      }

      // Plain arrows navigate only when focus is not in an editable field.
      const inEditable = active?.tagName === "TEXTAREA" || active?.tagName === "INPUT";
      if (!inEditable && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        move(e.key === "ArrowDown" ? 1 : -1);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    move,
    modalOpen,
    settingsOpen,
    celebratingLevel,
    shortcutsOpen,
    activeKey,
    activeIndex,
    filtered,
    settings.focusSearchOnFind,
    settings.syncIdenticalTranslations,
    settings.unconfirmOnEdit,
    settings.qaChecksEnabled,
    syntaxFor,
    referenceDrawerOpen,
    activeItem,
    qaDetailsVisible,
    qaDetails,
  ]);

  useEffect(() => {
    if (!shortcutsOpen) return;
    const closeOnOutsidePress = (e) => {
      if (!shortcutsRef.current?.contains(e.target)) setShortcutsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress, true);
  }, [shortcutsOpen]);

  // Manual edits optionally drop the confirmed mark.
  // If syncIdenticalTranslations is enabled and the group is synced, updates all synced rows with identical original text.
  const handleTranslationChange = useCallback(
    (index, newValue) => {
      setTranslations((prev) =>
        updateTranslation(prev, index, newValue, {
          syncIdenticalTranslations: settings.syncIdenticalTranslations,
          unconfirmOnEdit: settings.unconfirmOnEdit,
        })
      );
    },
    [settings.unconfirmOnEdit, settings.syncIdenticalTranslations]
  );

  const handleSelect = useCallback((key) => {
    setSelectedKey(key);
    focusRequestRef.current = true;
    cursorPositionRef.current = { key, start: null, end: null };
    if (!window.getSelection()?.toString()) {
      const el = document.querySelector(
        `textarea[data-role="translation"][data-key="${CSS.escape(key)}"]`
      );
      el?.focus();
    }
  }, []);

  const handleConfirmToggle = useCallback(
    (key) => {
      setTranslations((prev) =>
        confirmTranslation(prev, key, {
          syncIdenticalTranslations: settings.syncIdenticalTranslations,
          toggle: true,
        })
      );
    },
    [settings.syncIdenticalTranslations]
  );

  const handleToggleSync = useCallback((original) => {
    setTranslations((prev) => toggleGroupSync(prev, original));
  }, []);

  const handleSuggest = useCallback(
    async (item) => {
      if (!hasApiKey(settings)) {
        toast("Вкажіть API ключ у налаштуваннях для автоматичного перекладу.", "warning");
        setSettingsOpen(true);
        return;
      }
      setSuggestingKey(item.key);
      try {
        const suggestion = await translateSingle(item.original, settings, { syntax: syntaxFor(item.key) });
        if (suggestion) {
          handleTranslationChange(item.originalIndex, suggestion);
          toast("Переклад застосовано!", "success");
        }
      } catch (err) {
        toast(err.message || "Не вдалося отримати переклад.", "error");
      } finally {
        setSuggestingKey(null);
      }
    },
    [settings, syntaxFor, toast, handleTranslationChange]
  );

  const handleNavigateFromDrawer = useCallback((key) => {
    // Clear search and filters so the target row is guaranteed to be listed
    setQuery("");
    setFilterUntranslated(false);
    setFilterUnconfirmed(false);
    setSelectedKey(key);
    focusRequestRef.current = true;
  }, []);

  const replaceOptions = useMemo(
    () => ({ regex: regexMode, caseSensitive, wholeWord, preserveCase }),
    [regexMode, caseSensitive, wholeWord, preserveCase]
  );

  // Bulk replacements touch only the rows the list shows: a scope or status
  // filter the user set narrows the edit too. The pinned row is shown only
  // to keep it in view, so it is not part of the result set.
  const visibleRows = useMemo(() => filtered.filter((item) => !item.pinned), [filtered]);

  const originalFills = useMemo(
    () =>
      replaceMode && queryRe
        ? planOriginalFill(visibleRows, query, replaceValue, replaceOptions)
        : new Map(),
    [replaceMode, queryRe, visibleRows, query, replaceValue, replaceOptions]
  );

  const replacePreview = useMemo(
    () =>
      replaceMode && queryRe
        ? { query, replacement: replaceValue, options: replaceOptions, showFill: showFillPreview }
        : null,
    [replaceMode, queryRe, query, replaceValue, replaceOptions, showFillPreview]
  );

  const applyBulkWithUndo = useCallback(
    (edits, { unconfirm, doneMessage }) => {
      const { next, undo } = applyBulkEdit(translations, edits, { unconfirm });
      setTranslations(next);
      toast(doneMessage(undo.length), "success", 10000, {
        label: "Скасувати",
        onClick: () => setTranslations((prev) => revertBulkEdit(prev, undo)),
      });
    },
    [translations, toast]
  );

  const handleReplaceAll = useCallback(() => {
    if (!queryRe) return;
    const edits = new Map();
    for (const item of visibleRows) {
      if (!translationMatches(item, queryRe)) continue;
      const replaced = replaceInTranslation(item.translated, query, replaceValue, replaceOptions);
      if (replaced !== item.translated) edits.set(item.key, replaced);
    }
    if (edits.size === 0) {
      toast("Збігів у перекладах не знайдено.", "info");
      return;
    }
    applyBulkWithUndo(edits, {
      unconfirm: false,
      doneMessage: (count) => `Замінено у рядках: ${count}.`,
    });
  }, [queryRe, visibleRows, query, replaceValue, replaceOptions, toast, applyBulkWithUndo]);

  const handleFillFromOriginal = useCallback(() => {
    if (originalFills.size === 0) {
      toast("Порожніх рядків зі збігом в оригіналі не знайдено.", "info");
      return;
    }
    applyBulkWithUndo(originalFills, {
      unconfirm: true,
      doneMessage: (count) => `Заповнено з оригіналу рядків: ${count}.`,
    });
  }, [originalFills, toast, applyBulkWithUndo]);

  const handleReplaceOne = useCallback(() => {
    if (!queryRe || filtered.length === 0) return;
    const start = activeIndex >= 0 ? activeIndex : 0;
    for (let step = 0; step < filtered.length; step++) {
      const i = (start + step) % filtered.length;
      const item = filtered[i];
      if (!translationMatches(item, queryRe)) continue;
      const replaced = replaceInTranslation(item.translated, query, replaceValue, replaceOptions);
      setTranslations((prev) =>
        prev.map((t) => (t.key === item.key ? { ...t, translated: replaced } : t))
      );
      // Move the selection to the next row whose translation also matches.
      for (let ahead = 1; ahead < filtered.length; ahead++) {
        const j = (i + ahead) % filtered.length;
        if (translationMatches(filtered[j], queryRe)) {
          setSelectedKey(filtered[j].key);
          break;
        }
      }
      return;
    }
    toast("Збігів у перекладах не знайдено.", "info");
  }, [queryRe, filtered, activeIndex, query, replaceValue, replaceOptions, toast]);

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
  };

  const handleDefinition = (item) => {
    const draft = item.translated.trim();
    const input = draft
      ? buildSearchPrompt(settings.searchPrompts.correct, { original: item.original, translation: draft })
      : buildSearchPrompt(settings.searchPrompts.translate, { original: item.original });
    window.open(`https://www.google.com/search?q=${encodeURIComponent(input)}&udm=50`, "_blank");
  };

  const handleLoadLangFile = (loaded) => {
    const { next, applied, skipped } = mergeLangFile(latestTranslationsRef.current, loaded, {
      skipIdentical: settings.skipIdenticalImport,
      confirmImported: settings.confirmImport,
      skipApproved: settings.skipApprovedImport,
    });
    latestTranslationsRef.current = next;
    setTranslations(next);
    return { applied, skipped };
  };

  const handleLoadArchive = async (file) => {
    const zip = await JSZip.loadAsync(file);
    const language = session.pack.language;
    const paths = collectTranslationFiles(Object.keys(zip.files), language);
    const files = Object.fromEntries(
      await Promise.all(paths.map(async (path) => [path, await zip.file(path).async("string")]))
    );
    const sources = await loadBookSources(session.id);
    const { values, skippedPageCount } = await translationsFromArchive({
      files,
      language,
      rows: latestTranslationsRef.current,
      sources,
    });
    return { ...handleLoadLangFile(values), skippedPageCount };
  };

  const handleApplyNewOriginal = (newOriginal) => {
    const { next, removed, stats } = applyNewLangOriginal(translations, newOriginal);
    const nextKeys = new Set(Object.keys(newOriginal));
    setTranslations(next);
    setDetectedSyntaxIds(detectSyntaxExtensions(newOriginal));
    // Earlier removals that came back in this original are back in the editor,
    // so they leave the reference panel.
    setRemovedRows((prev) => [...prev.filter((r) => !nextKeys.has(r.key)), ...removed]);
    return stats;
  };

  const referenceEntries = useMemo(
    () => [...translations, ...removedRows],
    [translations, removedRows]
  );

  const handleSkipIdenticalChange = useCallback((value) => {
    setSettings((prev) => {
      const next = { ...prev, skipIdenticalImport: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleConfirmImportChange = useCallback((value) => {
    setSettings((prev) => {
      const next = { ...prev, confirmImport: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleSkipApprovedChange = useCallback((value) => {
    setSettings((prev) => {
      const next = { ...prev, skipApprovedImport: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleSaveSettings = useCallback(
    (next) => {
      setSettings((prev) => {
        const merged = { ...prev, ...next };
        saveSettings(merged);
        return merged;
      });
      toast("Налаштування збережено.", "success");
    },
    [toast]
  );

  const handleCancelAutoTranslate = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleAutoTranslate = useCallback(async () => {
    // Snapshot the entries still needing a translation up front.
    // Empty lines without original are excluded.
    const targets = translations
      .filter((t) => !t.translated.trim() && isTranslatable(t))
      .map((t) => ({ key: t.key, original: t.original }));

    if (targets.length === 0) {
      toast("Усі рядки вже перекладені.", "info");
      return;
    }

    // Each syntax needs its own prompt hints, so targets go out in one run per syntax.
    const groups = Map.groupBy(targets, ({ key }) => syntaxFor(key));

    const controller = new AbortController();
    abortRef.current = controller;
    setAiState({ running: true, done: 0, total: targets.length });

    try {
      let succeeded = 0;
      let failed = 0;
      let firstError = null;
      for (const [syntax, group] of groups) {
        try {
          const result = await translateAll(group, settings, {
            signal: controller.signal,
            syntax,
            onBatch: (batchResult, batch) => {
              // Fill only rows that are still empty, so manual edits made while the
              // run is in flight are never overwritten.
              setTranslations((prev) => applyAutoTranslations(prev, batchResult));
              setAiState((s) => ({ ...s, done: Math.min(s.done + batch.length, s.total) }));
            },
          });
          succeeded += result.succeeded;
          failed += result.failed;
        } catch (error) {
          // A refused key fails every group the same way; any other failure
          // belongs to this group's rows only.
          if (controller.signal.aborted || error instanceof ApiKeyError) throw error;
          failed += group.length;
          firstError ??= error;
        }
      }
      if (succeeded === 0 && firstError) throw firstError;

      if (failed > 0) {
        toast(`Переклад завершено, але деякі рядки не вдалося обробити (${failed}).`, "warning");
      } else {
        toast("Автопереклад завершено.", "success");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        toast("Автопереклад скасовано.", "info");
      } else {
        console.error("Auto-translate failed:", error);
        toast(error.message || "Не вдалося виконати автопереклад.", "error");
      }
    } finally {
      abortRef.current = null;
      setAiState((s) => ({ ...s, running: false }));
    }
  }, [translations, settings, syntaxFor, toast]);

  // Only the selected row differs from the collapsed height, so row heights are
  // derived from the selection during render. Offsets then move in the same
  // render as the selection, instead of a frame later through a measured cache.
  // The expanded height is measured from the selected row itself.
  const [expandedRowHeight, setExpandedRowHeight] = useState(ROW_EXPANDED);
  const getRowHeight = useCallback(
    (index) => (index === activeIndex ? expandedRowHeight : ROW_COLLAPSED),
    [activeIndex, expandedRowHeight]
  );

  const scopeChips = [
    { id: "all", label: "Усе" },
    { id: "lang", label: "Мовний файл" },
    ...books.map(({ root, name }) => ({ id: root, label: name })),
  ];

  return (
    <div
      className={`flex h-screen w-full animate-fade-in flex-col overflow-hidden bg-base-100 text-base-content ${rewardClasses}`}
    >
      <div className="flex shrink-0 flex-col gap-2 px-4 pb-2 pt-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onHome}
            title="На головну"
            aria-label="На головну"
            className={`${HEADER_ICON_BTN} h-9 w-9`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
            </svg>
          </button>
          <div className="rw-title shrink-0 text-xl font-medium tracking-tight">Мовник</div>

          <div className="flex-1" />

          <div className="flex shrink-0 items-center gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <WalkingCat progress={progress} confirmedCount={confirmedCount} total={total} />
              <span className={PROGRESS_COUNTER}>
                <span className="text-gray-500">рядки</span> {confirmedCount} / {total} · {progress}%
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <WalkingCat
                tone="teal"
                label="Прогрес за символами"
                progress={charProgress}
                confirmedCount={confirmedChars}
                total={charTotal}
              />
              <span className={PROGRESS_COUNTER}>
                <span className="text-gray-500">символи</span> {confirmedChars} / {charTotal} · {charProgress}%
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReferenceDrawerOpen((v) => !v)}
            title="Довідник проєкту / Швидкий пошук (Ctrl+Shift+F)"
            className={`btn btn-sm gap-1.5 px-2.5 text-xs ${referenceDrawerOpen ? "btn-primary" : "btn-neutral"}`}
          >
            <span>📖</span>
            <span className="hidden sm:inline">Довідник</span>
          </button>

          <div
            ref={shortcutsRef}
            className="relative shrink-0"
            // Keyboard users can tab away to a control that opens a modal; the
            // pointerdown listener alone would leave the popover open behind it.
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setShortcutsOpen(false);
            }}
          >
            <button
              type="button"
              onClick={() => setShortcutsOpen((v) => !v)}
              title="Комбінації клавіш"
              aria-label="Комбінації клавіш"
              aria-expanded={shortcutsOpen}
              aria-controls="editor-shortcuts"
              className={`${HEADER_ICON_BTN} h-8 w-8`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" />
                <line x1="12" y1="17" x2="12" y2="17.01" />
              </svg>
            </button>
            {shortcutsOpen && (
              <div
                id="editor-shortcuts"
                className="absolute right-0 top-full z-30 mt-2 w-64 rounded-box border border-base-content/15 bg-base-300 p-3 shadow-xl"
              >
                <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs">
                  {SHORTCUTS.map(([keys, description]) => (
                    <Fragment key={keys}>
                      <dt>
                        <kbd className="kbd kbd-sm">{keys}</kbd>
                      </dt>
                      <dd className="text-gray-400">{description}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Сховати панель дій" : "Показати панель дій"}
            aria-pressed={sidebarOpen}
            className={`${HEADER_ICON_BTN} h-8 w-8`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-full shrink-0 basis-[560px]">
            <div className="relative flex min-w-[260px] items-center">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="pointer-events-none absolute left-3 text-gray-500"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="7" />
                <line x1="21" y1="21" x2="15.5" y2="15.5" />
              </svg>
              <input
                id="translation-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук за ключем, оригіналом або перекладом…"
                aria-label="Пошук перекладів"
                aria-invalid={Boolean(queryError)}
                className={`${TEXT_INPUT} pl-8 pr-3 ${queryError ? "border-error" : "border-base-content/15"}`}
              />
              <button
                type="button"
                className={`mono ${toggleBtnClass(caseSensitive)}`}
                onClick={() => setCaseSensitive((v) => !v)}
                title="Враховувати регістр"
                aria-pressed={caseSensitive}
              >
                Aa
              </button>
              <button
                type="button"
                className={`mono ${toggleBtnClass(wholeWord)}`}
                onClick={() => setWholeWord((v) => !v)}
                title="Цілі слова"
                aria-pressed={wholeWord}
              >
                \b
              </button>
              <button
                type="button"
                className={`mono ${toggleBtnClass(regexMode)}`}
                onClick={() => setRegexMode((v) => !v)}
                title="Пошук за регулярним виразом"
                aria-pressed={regexMode}
              >
                .*
              </button>
              <button
                type="button"
                className={toggleBtnClass(replaceMode, true)}
                onClick={() => setReplaceMode((v) => !v)}
                title="Режим заміни"
                aria-pressed={replaceMode}
              >
                Заміна
              </button>
            </div>
          </div>

          {replaceMode && (
            <div className="ml-2 flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className="btn btn-sm btn-neutral h-9 px-3 text-xs"
                onClick={handleReplaceOne}
                disabled={!queryRe}
              >
                Замінити
              </button>
              <button
                type="button"
                className="btn btn-sm btn-neutral h-9 px-3 text-xs"
                onClick={handleReplaceAll}
                disabled={!queryRe}
              >
                Замінити все
              </button>
              <button
                type="button"
                className="btn btn-sm btn-neutral h-9 px-3 text-xs"
                onClick={handleFillFromOriginal}
                disabled={!queryRe}
                title="Застосувати заміну до оригіналу й записати результат у порожні переклади"
              >
                З оригіналу ({originalFills.size})
              </button>
            </div>
          )}

          {query && activeKey && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                focusRequestRef.current = true;
              }}
              className="btn btn-xs btn-outline btn-warning ml-3 shrink-0"
              title="Очистити пошук та повернутися до робочого рядка"
            >
              📌 До рядка ({activeKey.length > 20 ? activeKey.slice(0, 20) + "…" : activeKey})
            </button>
          )}

          <div className="flex-1" />

          <span className="whitespace-nowrap text-xs text-gray-500">Показано: {filtered.length}</span>

          {books.length > 0 && (
            <div role="group" aria-label="Область" className="flex shrink-0 items-center gap-1.5">
              {scopeChips.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScope(id)}
                  aria-pressed={scope === id}
                  className={chipClass(scope === id, SKY_CHIP)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterUntranslated((v) => !v)}
              title="Показати лише неперекладені"
              aria-pressed={filterUntranslated}
              className={chipClass(filterUntranslated, ACCENT_CHIP)}
            >
              <span className={`${CHIP_DOT} ${ACCENT_CHIP.dot}`} />
              Неперекладені {untranslatedCount}
            </button>
            <button
              type="button"
              onClick={() => setFilterUnconfirmed((v) => !v)}
              title="Показати лише незатверджені"
              aria-pressed={filterUnconfirmed}
              className={chipClass(filterUnconfirmed, AMBER_CHIP)}
            >
              <span className={`${CHIP_DOT} ${AMBER_CHIP.dot}`} />
              Незатверджені {unconfirmedCount}
            </button>
          </div>
        </div>

        {replaceMode && (
          <div className="flex max-w-[560px] items-center">
            <input
              type="text"
              value={replaceValue}
              onChange={(e) => setReplaceValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    handleReplaceAll();
                  } else {
                    handleReplaceOne();
                  }
                }
              }}
              placeholder="Замінити на…"
              aria-label="Текст заміни"
              className={`${TEXT_INPUT} border-base-content/15 px-3`}
            />
            <button
              type="button"
              className={`mono ${toggleBtnClass(preserveCase)}`}
              onClick={() => setPreserveCase((v) => !v)}
              title="Зберігати регістр при заміні"
              aria-pressed={preserveCase}
            >
              AB
            </button>
            <button
              type="button"
              className={`whitespace-nowrap ${toggleBtnClass(showFillPreview, true)}`}
              onClick={() => setShowFillPreview((v) => !v)}
              title="Показувати в порожніх рядках, чим їх заповнить «З оригіналу»"
              aria-pressed={showFillPreview}
            >
              Заповнення
            </button>
          </div>
        )}

        <div className="h-px bg-base-content/15" />
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="grid h-7 shrink-0 items-center gap-[var(--space-6)] px-4"
            style={{ gridTemplateColumns: GRID_COLUMNS }}
          >
            <div />
            <div className={COLUMN_HEADER}>ОРИГІНАЛ ТА КЛЮЧ</div>
            <div className={COLUMN_HEADER}>ПЕРЕКЛАД</div>
            <div className={`${COLUMN_HEADER} text-right`}>ДІЇ</div>
          </div>

          {hiddenMatches > 0 && (
            <div className="mx-4 mb-2 flex items-center justify-center gap-3 rounded-lg border border-warning/40 bg-base-200 px-4 py-2 text-sm">
              <span>
                Фільтр приховує збігів: <span className="font-semibold tabular-nums">{hiddenMatches}</span>
              </span>
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={() => {
                  setFilterUntranslated(false);
                  setFilterUnconfirmed(false);
                }}
              >
                Зняти фільтри й показати
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center text-gray-500">
              <p>Нічого не знайдено. Спробуйте змінити запит або зніміть фільтр.</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 px-4">
              <List
                listRef={listRef}
                rowComponent={Row}
                rowCount={filtered.length}
                rowHeight={getRowHeight}
                className="h-full w-full"
                rowProps={{
                  filtered,
                  selectedKey: activeKey,
                  qaDetailsVisible,
                  queryRe,
                  replacePreview,
                  syntaxFor,
                  qaEnabled: settings.qaChecksEnabled !== false,
                  wordAutocompleteEnabled,
                  wordAutocompleteWords,
                  wordAutocompleteKeyHandlerRef,
                  syncIdenticalTranslations: settings.syncIdenticalTranslations !== false,
                  duplicateCounts,
                  suggestingKey,
                  focusRequestRef,
                  cursorPositionRef,
                  handleTranslationChange,
                  handleSelect,
                  handleConfirmToggle,
                  handleToggleSync,
                  handleCopy,
                  handleDefinition,
                  handleSuggest,
                  setExpandedRowHeight,
                  books: scope === "all" && books.length > 1 ? books : null,
                }}
              />
            </div>
          )}
        </div>

        <ProjectReferenceDrawer
          isOpen={referenceDrawerOpen}
          onClose={() => setReferenceDrawerOpen(false)}
          translations={referenceEntries}
          onNavigateToRow={handleNavigateFromDrawer}
          activeKey={activeKey}
          referenceInputRef={referenceInputRef}
          query={referenceQuery}
          onQueryChange={setReferenceQuery}
        />

        <Sidebar
          open={sidebarOpen}
          confirmedCount={confirmedCount}
          total={total}
          onExportJson={() => onExportJson(translations)}
          onExportResourcePack={() => onExportResourcePack(translations)}
          onExportClipboard={() => onExportClipboard(translations)}
          onLoadLang={handleLoadLangFile}
          onLoadArchive={handleLoadArchive}
          onApplyNewOriginal={handleApplyNewOriginal}
          skipApproved={settings.skipApprovedImport !== false}
          onSkipApprovedChange={handleSkipApprovedChange}
          skipIdentical={settings.skipIdenticalImport}
          onSkipIdenticalChange={handleSkipIdenticalChange}
          confirmImport={settings.confirmImport}
          onConfirmImportChange={handleConfirmImportChange}
          settings={settings}
          onOpenSettings={() => setSettingsOpen(true)}
          onAutoTranslate={handleAutoTranslate}
          onCancelAutoTranslate={handleCancelAutoTranslate}
          aiState={aiState}
        />
      </div>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          detectedSyntaxIds={detectedSyntaxIds}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {rewardsEnabled && <RewardsLayer level={unlockedLevel} />}
      {stolenKey && <GooseEvent stolenKey={stolenKey} onReturn={returnRow} />}
      {celebratingLevel && (
        <LevelUpScreen
          level={celebratingLevel}
          queuedCount={queuedCount}
          confirmed={confirmedCount}
          total={total}
          onDismiss={dismiss}
          onDismissAll={dismissAll}
        />
      )}
    </div>
  );
};

const Row = ({
  index,
  style,
  filtered,
  selectedKey,
  qaDetailsVisible,
  queryRe,
  replacePreview,
  syntaxFor,
  qaEnabled,
  wordAutocompleteEnabled,
  wordAutocompleteWords,
  wordAutocompleteKeyHandlerRef,
  syncIdenticalTranslations,
  duplicateCounts,
  suggestingKey,
  focusRequestRef,
  cursorPositionRef,
  handleTranslationChange,
  handleSelect,
  handleConfirmToggle,
  handleToggleSync,
  handleCopy,
  handleDefinition,
  handleSuggest,
  setExpandedRowHeight,
  books,
}) => {
  const item = filtered[index];
  const isSelected = item.key === selectedKey;

  return (
    <TranslationRow
      rowStyle={style}
      onHeight={setExpandedRowHeight}
      item={item}
      bookName={books?.find(({ root }) => rowInScope(item.key, root))?.name}
      isSelected={isSelected}
      showQaDetails={isSelected && qaDetailsVisible}
      queryRe={queryRe}
      replacePreview={replacePreview}
      syntax={syntaxFor(item.key)}
      qaEnabled={qaEnabled}
      wordAutocompleteEnabled={wordAutocompleteEnabled}
      wordAutocompleteWords={wordAutocompleteWords}
      wordAutocompleteKeyHandlerRef={wordAutocompleteKeyHandlerRef}
      duplicateCount={duplicateCounts?.get(item.original) || 1}
      isSynced={isGroupSynced(item, syncIdenticalTranslations)}
      isSuggesting={suggestingKey === item.key}
      focusRequestRef={focusRequestRef}
      cursorPositionRef={cursorPositionRef}
      onSelect={() => handleSelect(item.key)}
      onTranslate={(newValue) => handleTranslationChange(item.originalIndex, newValue)}
      onConfirmToggle={() => handleConfirmToggle(item.key)}
      onToggleSync={() => handleToggleSync(item.original)}
      onCopy={() => handleCopy(item.original)}
      onDefinition={() => handleDefinition(item)}
      onSuggest={handleSuggest}
    />
  );
};

export default EditorScreen;
