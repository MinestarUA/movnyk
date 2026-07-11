import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { List } from "react-window";
import TranslationRow from "./TranslationRow";
import Sidebar from "./Sidebar";

const ROW_HEIGHT = 150;

const EditorScreen = ({ template, onExportJson, onExportResourcePack }) => {
  const [translations, setTranslations] = useState(() =>
    Object.entries(template).map(([key, value]) => ({
      key,
      original: value,
      translated: "",
    }))
  );

  const [query, setQuery] = useState("");
  const [onlyUntranslated, setOnlyUntranslated] = useState(false);
  const [selectedKey, setSelectedKey] = useState(() => translations[0]?.key ?? null);

  const listRef = useRef(null);
  // Only pull focus into a row when the user navigates via keyboard, so typing
  // in the search box (or clicking elsewhere) is never interrupted.
  const focusRequestRef = useRef(true);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return translations
      .map((item, originalIndex) => ({ ...item, originalIndex }))
      .filter((item) => {
        if (onlyUntranslated && item.translated.trim()) return false;
        if (!normalized) return true;
        return (
          item.key.toLowerCase().includes(normalized) ||
          String(item.original).toLowerCase().includes(normalized)
        );
      });
  }, [translations, query, onlyUntranslated]);

  const translatedCount = useMemo(
    () => translations.filter((t) => t.translated.trim()).length,
    [translations]
  );
  const total = translations.length;
  const progress = total ? Math.round((translatedCount / total) * 100) : 0;

  // Derive the effective selection so it stays valid when the filtered set
  // changes, without needing an effect to reconcile state.
  const rawIndex = useMemo(
    () => filtered.findIndex((item) => item.key === selectedKey),
    [filtered, selectedKey]
  );
  const activeIndex = rawIndex >= 0 ? rawIndex : filtered.length > 0 ? 0 : -1;
  const activeKey = activeIndex >= 0 ? filtered[activeIndex].key : null;

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

      // Enter (without Shift) inside a translation field advances to the next entry.
      if (e.key === "Enter" && !e.shiftKey && isTranslationField) {
        e.preventDefault();
        move(1);
        return;
      }

      // Ctrl/Cmd + Arrow navigates even while typing.
      if ((e.ctrlKey || e.metaKey) && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        move(e.key === "ArrowDown" ? 1 : -1);
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
  }, [move]);

  const handleTranslationChange = useCallback((index, newValue) => {
    setTranslations((prev) =>
      prev.map((item, i) => (i === index ? { ...item, translated: newValue } : item))
    );
  }, []);

  const handleSelect = useCallback((key) => setSelectedKey(key), []);

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
  };

  const handleDefinition = (text) => {
    const input = "Переклади цей текст:\n" + text;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(input)}&udm=50`, "_blank");
  };

  const handleLoadLangFile = (loadedTranslations) => {
    let applied = 0;
    setTranslations((prev) =>
      prev.map((t) => {
        if (loadedTranslations[t.key] != null) {
          applied += 1;
          return { ...t, translated: loadedTranslations[t.key] };
        }
        return t;
      })
    );
    return applied;
  };

  return (
    <div className="flex h-screen text-base-content overflow-hidden animate-fade-in">
      <main className="flex-grow flex flex-col min-w-0">
        <header className="px-8 pt-6 pb-4 border-b-2 border-neutral bg-base-200/40 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black leading-none">Мовник</h1>
              <p className="text-xs text-base-content/50 mt-1">
                ↵ Enter — наступний запис · Ctrl + ↑/↓ — навігація
              </p>
            </div>
            <div className="flex items-center gap-3 min-w-[220px]">
              <progress
                className="progress progress-primary flex-1"
                value={translatedCount}
                max={total || 1}
                aria-label="Прогрес перекладу"
              />
              <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                {translatedCount} / {total}
                <span className="text-base-content/50 font-normal"> ({progress}%)</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <input
                id="translation-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук за ключем або оригіналом…"
                className="input input-bordered input-sm w-full"
                aria-label="Пошук перекладів"
              />
            </div>
            <label className="label cursor-pointer gap-2 py-0">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={onlyUntranslated}
                onChange={(e) => setOnlyUntranslated(e.target.checked)}
              />
              <span className="label-text text-sm">Лише неперекладені</span>
            </label>
            <span className="text-sm text-base-content/50 whitespace-nowrap">
              Показано: {filtered.length}
            </span>
          </div>
        </header>

        <div className="flex-1 min-h-0 px-6 py-4">
          {filtered.length === 0 ? (
            <div className="h-full flex items-center justify-center text-base-content/50 text-center">
              <p>Нічого не знайдено. Спробуйте змінити запит або зніміть фільтр.</p>
            </div>
          ) : (
            <List
              listRef={listRef}
              rowComponent={Row}
              rowCount={filtered.length}
              rowHeight={ROW_HEIGHT}
              style={{ width: "100%", height: "100%" }}
              rowProps={{
                filtered,
                selectedKey: activeKey,
                focusRequestRef,
                handleTranslationChange,
                handleSelect,
                handleCopy,
                handleDefinition,
              }}
            />
          )}
        </div>
      </main>
      <Sidebar
        translatedCount={translatedCount}
        total={total}
        onExportJson={() => onExportJson(translations)}
        onExportResourcePack={() => onExportResourcePack(translations)}
        onLoadLang={handleLoadLangFile}
      />
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
      onCopy={() => handleCopy(item.original)}
      onDefinition={() => handleDefinition(item.original)}
    />
  );
};

export default EditorScreen;
