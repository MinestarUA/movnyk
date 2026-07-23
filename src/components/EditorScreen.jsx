import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { List, useDynamicRowHeight } from "react-window";
import TranslationRow, { ROW_COLLAPSED } from "./TranslationRow";
import Sidebar from "./Sidebar";
import SettingsModal from "./SettingsModal";
import { useToast } from "./Toast";
import { loadSettings, saveSettings } from "../lib/settings";
import { translateAll } from "../lib/gemini";
import { mergeLangFile } from "../lib/importing";
import { saveAutosave } from "../lib/autosave";
import {
  compileQuery,
  isFindShortcut,
  itemMatches,
  translationMatches,
  replaceInTranslation,
} from "../lib/searching";

const COLUMN_HEADER_STYLE = {
  fontFamily: "var(--font-heading)",
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.08em",
  color: "var(--color-neutral-600)",
};

const GRID_COLUMNS_HEADER = "26px minmax(180px,1fr) minmax(200px,1.3fr) minmax(200px,1.3fr) 132px";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      if (isFindShortcut(e)) {
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

  const handleSelect = useCallback((key) => {
    setSelectedKey(key);
    // Interacting with a row hands the screen over to editing, so tuck the
    // action sidebar away to give the rows full width. The header toggle
    // brings it back.
    setSidebarOpen(false);
  }, []);

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

  // Rows are measured (ResizeObserver) so the expanded row can grow with its
  // translation content instead of scrolling inside a fixed field. Reset the
  // height cache whenever the visible set changes, since heights are keyed by
  // index and filtering/searching remaps which row sits at each index.
  const rowHeightCache = useDynamicRowHeight({
    defaultRowHeight: ROW_COLLAPSED,
    key: `${query}|${regexMode}|${filterUntranslated}|${filterUnconfirmed}`,
  });

  const regexBtnStyle = {
    height: "34px",
    padding: "0 10px",
    borderRadius: 0,
    fontSize: "12px",
    fontFamily: "var(--font-heading)",
    fontWeight: 500,
    cursor: "pointer",
    background: regexMode ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "var(--color-surface)",
    borderTop: "1px solid var(--color-divider)",
    borderBottom: "1px solid var(--color-divider)",
    borderLeft: "1px solid var(--color-divider)",
    borderRight: "none",
    color: regexMode ? "var(--color-accent)" : "var(--color-neutral-400)",
  };
  const replaceBtnStyle = {
    height: "34px",
    padding: "0 12px",
    borderRadius: "0 var(--radius-md) var(--radius-md) 0",
    fontSize: "12px",
    fontFamily: "var(--font-heading)",
    fontWeight: 500,
    cursor: "pointer",
    background: replaceMode ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "var(--color-surface)",
    border: replaceMode ? "1px solid var(--color-accent)" : "1px solid var(--color-divider)",
    color: replaceMode ? "var(--color-accent)" : "var(--color-neutral-400)",
  };
  const chipStyle = (active, tint) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "5px 11px",
    borderRadius: "999px",
    fontFamily: "var(--font-heading)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    background: active ? tint.bgOn : tint.bgOff,
    border: `1px solid ${active ? tint.borderOn : tint.borderOff}`,
    color: tint.color,
  });
  const pinkTint = {
    bgOn: "rgba(255,95,162,0.22)",
    bgOff: "rgba(255,95,162,0.1)",
    borderOn: "#ff5fa2",
    borderOff: "rgba(255,95,162,0.35)",
    color: "#ff9dc6",
    dot: "#ff5fa2",
  };
  const amberTint = {
    bgOn: "rgba(240,190,90,0.22)",
    bgOff: "rgba(240,190,90,0.08)",
    borderOn: "#f0be5a",
    borderOff: "rgba(240,190,90,0.3)",
    color: "#f2cd85",
    dot: "#f0be5a",
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        height: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
        color: "var(--color-text)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "var(--space-4) var(--space-6) var(--space-3)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 500,
                fontSize: "19px",
                letterSpacing: "-0.015em",
              }}
            >
              Мовник
            </div>
            <div style={{ fontSize: "10.5px", color: "var(--color-neutral-500)", whiteSpace: "nowrap" }}>
              Enter — наступний · Ctrl+↑/↓ — навігація · Ctrl+F — пошук
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, maxWidth: "280px" }}>
            <div
              style={{
                flex: 1,
                height: "5px",
                borderRadius: "3px",
                background: "var(--color-neutral-800)",
                overflow: "hidden",
              }}
              role="progressbar"
              aria-label="Прогрес перекладу"
              aria-valuenow={confirmedCount}
              aria-valuemax={total || 1}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(progress, total ? 0.6 : 0)}%`,
                  minWidth: total ? "3px" : 0,
                  background: "linear-gradient(90deg,#ff5fa2,#c860e8)",
                  borderRadius: "3px",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--color-neutral-400)",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {confirmedCount} / {total} · {progress}%
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Сховати панель дій" : "Показати панель дій"}
            aria-pressed={sidebarOpen}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "var(--radius-md)",
              background: "transparent",
              border: "1px solid var(--color-divider)",
              color: "var(--color-neutral-400)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <div style={{ flex: 1, position: "relative", maxWidth: "520px", display: "flex", alignItems: "center" }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-neutral-500)"
              strokeWidth="1.8"
              strokeLinecap="round"
              style={{ position: "absolute", left: "12px", pointerEvents: "none" }}
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
              style={{
                width: "100%",
                height: "34px",
                background: "var(--color-surface)",
                border: queryError ? "1px solid var(--color-error, #ff5f6d)" : "1px solid var(--color-divider)",
                borderRadius: "var(--radius-md) 0 0 var(--radius-md)",
                borderRight: "none",
                padding: "0 12px 0 32px",
                color: "var(--color-text)",
                fontSize: "13.5px",
                fontFamily: "var(--font-body)",
                outline: "none",
              }}
            />
            <button
              type="button"
              className="mono"
              style={regexBtnStyle}
              onClick={() => setRegexMode((v) => !v)}
              title="Пошук за регулярним виразом"
              aria-pressed={regexMode}
            >
              .*
            </button>
            <button
              type="button"
              style={replaceBtnStyle}
              onClick={() => setReplaceMode((v) => !v)}
              title="Режим заміни"
              aria-pressed={replaceMode}
            >
              Заміна
            </button>
          </div>

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: "12px", color: "var(--color-neutral-500)", whiteSpace: "nowrap" }}>
            Показано: {filtered.length}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setFilterUntranslated((v) => !v)}
              title="Показати лише неперекладені"
              aria-pressed={filterUntranslated}
              style={chipStyle(filterUntranslated, pinkTint)}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: pinkTint.dot, flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>Неперекладені {untranslatedCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterUnconfirmed((v) => !v)}
              title="Показати лише незатверджені"
              aria-pressed={filterUnconfirmed}
              style={chipStyle(filterUnconfirmed, amberTint)}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: amberTint.dot, flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>Незатверджені {unconfirmedCount}</span>
            </button>
          </div>
        </div>

        {replaceMode && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <input
              type="text"
              value={replaceValue}
              onChange={(e) => setReplaceValue(e.target.value)}
              placeholder="Замінити на… (у перекладах)"
              aria-label="Текст заміни"
              style={{
                flex: 1,
                minWidth: "200px",
                height: "34px",
                background: "var(--color-surface)",
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-md)",
                padding: "0 12px",
                color: "var(--color-text)",
                fontSize: "13.5px",
                fontFamily: "var(--font-body)",
                outline: "none",
              }}
            />
            <button type="button" className="btn btn-sm btn-neutral" onClick={handleReplaceOne} disabled={!queryRe}>
              Замінити
            </button>
            <button type="button" className="btn btn-sm btn-neutral" onClick={handleReplaceAll} disabled={!queryRe}>
              Замінити все
            </button>
          </div>
        )}

        <div
          style={{
            height: "1px",
            background:
              "linear-gradient(to right, transparent, var(--color-divider) 48px, var(--color-divider) calc(100% - 48px), transparent)",
          }}
        />
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <div
            style={{
              flexShrink: 0,
              display: "grid",
              gridTemplateColumns: GRID_COLUMNS_HEADER,
              gap: "var(--space-6)",
              padding: "0 var(--space-6)",
              height: "28px",
              alignItems: "center",
            }}
          >
            <div />
            <div style={COLUMN_HEADER_STYLE}>КЛЮЧ</div>
            <div style={COLUMN_HEADER_STYLE}>ОРИГІНАЛ</div>
            <div style={COLUMN_HEADER_STYLE}>ПЕРЕКЛАД</div>
            <div style={{ ...COLUMN_HEADER_STYLE, textAlign: "right" }}>ДІЇ</div>
          </div>

          {hiddenMatches > 0 && (
            <div
              style={{ margin: "0 var(--space-6) var(--space-3)" }}
              className="flex items-center justify-center gap-3 rounded-lg border border-warning/40 bg-base-200 px-4 py-2 text-sm"
            >
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
            <div className="flex-1 flex items-center justify-center text-center" style={{ color: "var(--color-neutral-500)" }}>
              <p>Нічого не знайдено. Спробуйте змінити запит або зніміть фільтр.</p>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, padding: "0 var(--space-6)", display: "flex" }}>
              <List
                listRef={listRef}
                rowComponent={Row}
                rowCount={filtered.length}
                rowHeight={rowHeightCache}
                style={{ width: "100%", height: "100%" }}
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
            </div>
          )}
        </div>

        <Sidebar
          open={sidebarOpen}
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
      </div>

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
