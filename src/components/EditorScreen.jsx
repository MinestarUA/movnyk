import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { List } from "react-window";
import TranslationRow from "./TranslationRow";
import Sidebar from "./Sidebar";
import SettingsModal from "./SettingsModal";
import { useToast } from "./Toast";
import { loadSettings, saveSettings } from "../lib/settings";
import { translateAll } from "../lib/gemini";
import { mergeLangFile } from "../lib/importing";
import { saveAutosave } from "../lib/autosave";
import {
  compileQuery,
  itemMatches,
  translationMatches,
  replaceInTranslation,
} from "../lib/searching";

const ROW_HEIGHT = 150;

const EditorScreen = ({ template, initialTranslations, onExportJson, onExportResourcePack }) => {
  const toast = useToast();
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiState, setAiState] = useState({ running: false, done: 0, total: 0 });
  const abortRef = useRef(null);
  const [translations, setTranslations] = useState(() =>
    initialTranslations
      ? initialTranslations.map((t) => ({
          key: t.key,
          original: t.original,
          translated: typeof t.translated === "string" ? t.translated : "",
          confirmed: Boolean(t.confirmed),
        }))
      : Object.entries(template).map(([key, value]) => ({
          key,
          original: value,
          translated: "",
          confirmed: false,
        }))
  );

  const [query, setQuery] = useState("");
  const [regexMode, setRegexMode] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceValue, setReplaceValue] = useState("");
  const [filterUntranslated, setFilterUntranslated] = useState(false);
  const [filterUnconfirmed, setFilterUnconfirmed] = useState(false);
  const [selectedKey, setSelectedKey] = useState(() => translations[0]?.key ?? null);

  const listRef = useRef(null);
  // Only pull focus into a row when the user navigates via keyboard, so typing
  // in the search box (or clicking elsewhere) is never interrupted.
  const focusRequestRef = useRef(true);

  const { re: queryRe, error: queryError } = useMemo(
    () => compileQuery(query, { regex: regexMode }),
    [query, regexMode]
  );

  const filtered = useMemo(() => {
    const statusActive = filterUntranslated || filterUnconfirmed;
    const result = [];
    translations.forEach((item, originalIndex) => {
      const matchesQuery = queryError ? false : !queryRe || itemMatches(item, queryRe);
      const empty = !item.translated.trim();
      const matchesStatus =
        !statusActive ||
        (filterUntranslated && empty) ||
        (filterUnconfirmed && !empty && !item.confirmed);
      const passes = matchesQuery && matchesStatus;
      // The selected row is pinned into view even when it fails the query or
      // status filter, so the row being edited never vanishes mid-work.
      const pinned = !passes && item.key === selectedKey;
      if (passes || pinned) result.push({ ...item, originalIndex, pinned });
    });
    return result;
  }, [translations, queryRe, queryError, filterUntranslated, filterUnconfirmed, selectedKey]);

  // Rows the status filter hides even though they match the search query —
  // surfaced as a banner so a filtered-out search is never a dead end.
  const hiddenMatches = useMemo(() => {
    if (!queryRe || queryError) return 0;
    if (!(filterUntranslated || filterUnconfirmed)) return 0;
    if (filtered.some((item) => !item.pinned)) return 0;
    return translations.filter((t) => itemMatches(t, queryRe)).length;
  }, [translations, queryRe, queryError, filterUntranslated, filterUnconfirmed, filtered]);

  const confirmedCount = useMemo(
    () => translations.filter((t) => t.confirmed).length,
    [translations]
  );
  const untranslatedCount = useMemo(
    () => translations.filter((t) => !t.translated.trim()).length,
    [translations]
  );
  const unconfirmedCount = useMemo(
    () => translations.filter((t) => t.translated.trim() && !t.confirmed).length,
    [translations]
  );
  const total = translations.length;
  const progress = total ? Math.round((confirmedCount / total) * 100) : 0;

  // Derive the effective selection so it stays valid when the filtered set
  // changes, without needing an effect to reconcile state.
  const rawIndex = useMemo(
    () => filtered.findIndex((item) => item.key === selectedKey),
    [filtered, selectedKey]
  );
  const activeIndex = rawIndex >= 0 ? rawIndex : filtered.length > 0 ? 0 : -1;
  const activeKey = activeIndex >= 0 ? filtered[activeIndex].key : null;

  // Persist progress to the single autosave slot, debounced so rapid typing
  // does not hammer localStorage.
  const quotaWarnedRef = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => {
      const ok = saveAutosave({ template, translations });
      if (!ok && !quotaWarnedRef.current) {
        quotaWarnedRef.current = true;
        toast(
          "Не вдалося зберегти прогрес локально — сховище браузера переповнене.",
          "warning"
        );
      }
    }, 800);
    return () => clearTimeout(id);
  }, [template, translations, toast]);

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
      const active = document.activeElement;
      const isTranslationField = active?.dataset?.role === "translation";

      // Ctrl/Cmd + F opens the in-app search instead of the browser's find,
      // carrying the current text selection (key, original or translation)
      // into the search field.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        let selected;
        if (
          (active?.tagName === "TEXTAREA" || active?.tagName === "INPUT") &&
          typeof active.selectionStart === "number"
        ) {
          selected = active.value.substring(active.selectionStart, active.selectionEnd);
        } else {
          selected = window.getSelection()?.toString() ?? "";
        }
        selected = selected.trim();
        if (selected) setQuery(selected);
        const searchInput = document.getElementById("translation-search");
        searchInput?.focus();
        searchInput?.select();
        return;
      }

      // Enter (without Shift) inside a translation field confirms the current
      // entry (when non-empty) and advances to the next one.
      if (e.key === "Enter" && !e.shiftKey && isTranslationField) {
        e.preventDefault();
        if (activeKey) {
          setTranslations((prev) =>
            prev.map((t) =>
              t.key === activeKey && t.translated.trim() ? { ...t, confirmed: true } : t
            )
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
      // virtualized window), a printable key scrolls back and refocuses.
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
          document
            .querySelector(
              `textarea[data-role="translation"][data-key="${CSS.escape(activeKey)}"]`
            )
            ?.focus();
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move, activeKey, activeIndex]);

  // Manual edits (typing in the row) optionally drop the confirmed mark, so a
  // touched translation goes back through review. Replace operations go
  // through their own handlers and deliberately keep confirmation intact.
  const handleTranslationChange = useCallback(
    (index, newValue) => {
      const unconfirm = settings.unconfirmOnEdit;
      setTranslations((prev) =>
        prev.map((item, i) =>
          i === index
            ? { ...item, translated: newValue, confirmed: unconfirm ? false : item.confirmed }
            : item
        )
      );
    },
    [settings.unconfirmOnEdit]
  );

  const handleSelect = useCallback((key) => setSelectedKey(key), []);

  const handleConfirmToggle = useCallback((key) => {
    setTranslations((prev) =>
      prev.map((t) =>
        t.key === key && t.translated.trim() ? { ...t, confirmed: !t.confirmed } : t
      )
    );
  }, []);

  const handleReplaceAll = useCallback(() => {
    if (!queryRe) return;
    let changed = 0;
    const next = translations.map((t) => {
      if (!translationMatches(t, queryRe)) return t;
      const replaced = replaceInTranslation(t.translated, query, replaceValue, {
        regex: regexMode,
      });
      if (replaced === t.translated) return t;
      changed += 1;
      return { ...t, translated: replaced };
    });
    if (changed > 0) setTranslations(next);
    toast(
      changed > 0 ? `Замінено у рядках: ${changed}.` : "Збігів у перекладах не знайдено.",
      changed > 0 ? "success" : "info"
    );
  }, [queryRe, translations, query, replaceValue, regexMode, toast]);

  const handleReplaceOne = useCallback(() => {
    if (!queryRe || filtered.length === 0) return;
    const start = activeIndex >= 0 ? activeIndex : 0;
    for (let step = 0; step < filtered.length; step++) {
      const i = (start + step) % filtered.length;
      const item = filtered[i];
      if (!translationMatches(item, queryRe)) continue;
      const replaced = replaceInTranslation(item.translated, query, replaceValue, {
        regex: regexMode,
      });
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
  }, [queryRe, filtered, activeIndex, query, replaceValue, regexMode, toast]);

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
  };

  const handleDefinition = (item) => {
    const draft = item.translated.trim();
    const input = draft
      ? `Чи правильно перекладати "${item.original}" як "${draft}"?`
      : "Переклади цей текст:\n" + item.original;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(input)}&udm=50`, "_blank");
  };

  const handleLoadLangFile = (loaded) => {
    const { next, applied, skipped } = mergeLangFile(translations, loaded, {
      skipIdentical: settings.skipIdenticalImport,
    });
    setTranslations(next);
    return { applied, skipped };
  };

  const handleSkipIdenticalChange = useCallback((value) => {
    setSettings((prev) => {
      const next = { ...prev, skipIdenticalImport: value };
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
    const targets = translations
      .filter((t) => !t.translated.trim())
      .map((t) => ({ key: t.key, original: t.original }));

    if (targets.length === 0) {
      toast("Усі рядки вже перекладені.", "info");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setAiState({ running: true, done: 0, total: targets.length });

    try {
      const { failed, hadErrors } = await translateAll(targets, settings, {
        signal: controller.signal,
        onBatch: (result, batch) => {
          // Fill only rows that are still empty, so manual edits made while the
          // run is in flight are never overwritten.
          setTranslations((prev) =>
            prev.map((t) =>
              typeof result[t.key] === "string" && !t.translated.trim()
                ? { ...t, translated: result[t.key], confirmed: true }
                : t
            )
          );
          setAiState((s) => ({ ...s, done: Math.min(s.done + batch.length, s.total) }));
        },
      });

      if (hadErrors) {
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
  }, [translations, settings, toast]);

  return (
    <div className="flex h-screen text-base-content overflow-hidden animate-fade-in">
      <main className="flex-grow flex flex-col min-w-0">
        <header className="px-8 pt-6 pb-4 border-b-2 border-neutral bg-base-200/40 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black leading-none">Мовник</h1>
              <p className="text-xs text-base-content/50 mt-1">
                ↵ Enter — наступний запис · Ctrl + ↑/↓ — навігація · Ctrl + F — пошук виділеного
              </p>
            </div>
            <div className="flex items-center gap-3 min-w-[220px]">
              <progress
                className="progress progress-primary flex-1"
                value={confirmedCount}
                max={total || 1}
                aria-label="Прогрес перекладу"
              />
              <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                {confirmedCount} / {total}
                <span className="text-base-content/50 font-normal"> ({progress}%)</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] flex items-center gap-2">
              <input
                id="translation-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук за ключем, оригіналом або перекладом…"
                className={`input input-bordered input-sm w-full ${queryError ? "input-error" : ""}`}
                aria-label="Пошук перекладів"
                aria-invalid={Boolean(queryError)}
              />
              <button
                type="button"
                className={`btn btn-sm font-mono ${regexMode ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setRegexMode((v) => !v)}
                title="Регулярний вираз"
                aria-pressed={regexMode}
              >
                .*
              </button>
              <button
                type="button"
                className={`btn btn-sm ${replaceMode ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setReplaceMode((v) => !v)}
                title="Режим заміни"
                aria-pressed={replaceMode}
              >
                Заміна
              </button>
            </div>
            <label className="label cursor-pointer gap-2 py-0">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={filterUntranslated}
                onChange={(e) => setFilterUntranslated(e.target.checked)}
              />
              <span className="label-text text-sm">
                Неперекладені{" "}
                <span className="text-base-content/50 tabular-nums">({untranslatedCount})</span>
              </span>
            </label>
            <label className="label cursor-pointer gap-2 py-0">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-warning"
                checked={filterUnconfirmed}
                onChange={(e) => setFilterUnconfirmed(e.target.checked)}
              />
              <span className="label-text text-sm">
                Незатверджені{" "}
                <span className="text-base-content/50 tabular-nums">({unconfirmedCount})</span>
              </span>
            </label>
            <span className="text-sm text-base-content/50 whitespace-nowrap">
              Показано: {filtered.length}
            </span>
          </div>
          {replaceMode && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={replaceValue}
                onChange={(e) => setReplaceValue(e.target.value)}
                placeholder="Замінити на… (у перекладах)"
                className="input input-bordered input-sm flex-1 min-w-[200px]"
                aria-label="Текст заміни"
              />
              <button
                type="button"
                className="btn btn-sm btn-neutral"
                onClick={handleReplaceOne}
                disabled={!queryRe}
              >
                Замінити
              </button>
              <button
                type="button"
                className="btn btn-sm btn-neutral"
                onClick={handleReplaceAll}
                disabled={!queryRe}
              >
                Замінити все
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 min-h-0 px-6 py-4 flex flex-col">
          {hiddenMatches > 0 && (
            <div className="mb-3 flex items-center justify-center gap-3 rounded-lg border-2 border-warning/40 bg-base-200 px-4 py-2 text-sm">
              <span>
                Фільтр приховує збігів:{" "}
                <span className="font-semibold tabular-nums">{hiddenMatches}</span>
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
            <div className="flex-1 flex items-center justify-center text-base-content/50 text-center">
              <p>Нічого не знайдено. Спробуйте змінити запит або зніміть фільтр.</p>
            </div>
          ) : (
            <List
              listRef={listRef}
              className="[scrollbar-gutter:stable] pr-1 flex-1 min-h-0"
              rowComponent={Row}
              rowCount={filtered.length}
              rowHeight={ROW_HEIGHT}
              style={{ width: "100%" }}
              rowProps={{
                filtered,
                selectedKey: activeKey,
                focusRequestRef,
                handleTranslationChange,
                handleSelect,
                handleConfirmToggle,
                handleCopy,
                handleDefinition,
              }}
            />
          )}
        </div>
      </main>
      <Sidebar
        confirmedCount={confirmedCount}
        total={total}
        onExportJson={() => onExportJson(translations)}
        onExportResourcePack={() => onExportResourcePack(translations)}
        onLoadLang={handleLoadLangFile}
        skipIdentical={settings.skipIdenticalImport}
        onSkipIdenticalChange={handleSkipIdenticalChange}
        settings={settings}
        onOpenSettings={() => setSettingsOpen(true)}
        onAutoTranslate={handleAutoTranslate}
        onCancelAutoTranslate={handleCancelAutoTranslate}
        aiState={aiState}
      />
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
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
  focusRequestRef,
  handleTranslationChange,
  handleSelect,
  handleConfirmToggle,
  handleCopy,
  handleDefinition,
}) => {
  const item = filtered[index];

  return (
    <TranslationRow
      rowStyle={style}
      item={item}
      isSelected={item.key === selectedKey}
      focusRequestRef={focusRequestRef}
      onSelect={() => handleSelect(item.key)}
      onTranslate={(newValue) => handleTranslationChange(item.originalIndex, newValue)}
      onConfirmToggle={() => handleConfirmToggle(item.key)}
      onCopy={() => handleCopy(item.original)}
      onDefinition={() => handleDefinition(item)}
    />
  );
};

export default EditorScreen;
