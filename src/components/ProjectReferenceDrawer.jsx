import { useState, useMemo, useEffect, useCallback } from "react";
import { compileQuery, itemMatches } from "../lib/searching";
import CloseButton from "./CloseButton";
import FormattedText from "./FormattedText";

const BookIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0 text-accent-pink"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const ProjectReferenceDrawer = ({
  isOpen,
  onClose,
  translations,
  onNavigateToRow,
  activeKey,
  referenceInputRef,
  query,
  onQueryChange,
}) => {
  const [copiedKey, setCopiedKey] = useState(null);
  // The input mounts and unmounts with the drawer, so the parent's ref is set
  // from the input itself rather than once at mount, when it is still null.
  const setInputRef = useCallback(
    (el) => {
      referenceInputRef.current = el;
    },
    [referenceInputRef]
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => referenceInputRef.current?.focus(), 50);
    }
  }, [isOpen, referenceInputRef]);

  const { re: queryRe } = useMemo(
    () => compileQuery(query, { regex: false, caseSensitive: false, wholeWord: false }),
    [query]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    if (!queryRe) return [];
    // A removed row without a translation has nothing to reference.
    return translations
      .filter((item) => !(item.removed && !item.translated.trim()))
      .filter((item) => itemMatches(item, queryRe))
      .slice(0, 100);
  }, [translations, query, queryRe]);

  if (!isOpen) return null;

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <aside
      className="z-[5] flex h-full w-80 md:w-96 shrink-0 flex-col overflow-hidden border-l border-base-content/15 bg-base-200/75 p-3.5 shadow-[-4px_0_16px_rgba(0,0,0,0.25)] backdrop-blur-[14px]"
      style={{ boxSizing: "border-box" }}
    >
      <div className="flex items-center justify-between border-b border-base-content/15 pb-3">
        <div className="min-w-0 pr-2">
          <h2 className="flex items-center gap-2 truncate text-sm font-semibold tracking-tight">
            <BookIcon />
            Довідник проєкту
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-base-content/55">
            Шукайте терміни без втрати позиції в редакторі
          </p>
        </div>
        <CloseButton onClick={onClose} label="Сховати довідник" />
      </div>

      {/* Search Input */}
      <div className="py-3">
        <div className="relative flex items-center">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="pointer-events-none absolute left-2.5 text-gray-500"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="7" />
            <line x1="21" y1="21" x2="15.5" y2="15.5" />
          </svg>
          <input
            ref={setInputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                if (query) {
                  onQueryChange("");
                } else {
                  onClose();
                }
              }
            }}
            placeholder="Шукати в оригіналі, перекладі чи ключі…"
            className="input input-sm input-bordered w-full bg-base-100/70 pl-8 pr-8 text-xs focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              className="absolute right-2 flex h-5 w-5 items-center justify-center rounded text-base-content/55 transition-colors hover:bg-base-300 hover:text-base-content"
              onClick={() => onQueryChange("")}
              aria-label="Очистити пошук"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        {query.trim() && (
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-base-content/55">
            <span className="tabular-nums">Знайдено: {results.length >= 100 ? "100+" : results.length}</span>
            {activeKey && (
              <span className="max-w-[180px] truncate font-mono text-[10px] text-accent-pink" title={activeKey}>
                Рядок: {activeKey}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {!query.trim() ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-xs text-base-content/55">
            <p className="m-0 max-w-[220px]">Введіть запит, щоб знайти терміни у проєкті.</p>
            <p className="m-0 text-[11px] text-base-content/45">
              Порада: виділіть слово і натисніть <kbd className="kbd kbd-xs">Ctrl+D</kbd>
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-14 text-center text-xs text-base-content/55">
            Нічого не знайдено за цим запитом.
          </div>
        ) : (
          results.map((item) => (
            <div
              key={item.key}
              className="space-y-1.5 rounded-lg border border-base-content/10 bg-base-100/80 p-2.5 transition-colors hover:border-primary/45 hover:bg-base-100"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 text-xs font-medium text-base-content/90">
                  {item.removed && (
                    <span className="badge badge-warning badge-xs mr-1.5 align-middle">Видалено</span>
                  )}
                  <FormattedText text={item.original} queryRe={queryRe} />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost h-6 min-h-0 px-1.5 text-[10px]"
                    title="Скопіювати оригінал"
                    onClick={() => handleCopy(item.original, `orig-${item.key}`)}
                  >
                    {copiedKey === `orig-${item.key}` ? "✓" : "Оригінал"}
                  </button>
                  {item.translated && (
                    <button
                      type="button"
                      className="btn btn-xs btn-primary btn-outline h-6 min-h-0 px-1.5 text-[10px]"
                      title="Скопіювати переклад"
                      onClick={() => handleCopy(item.translated, `trans-${item.key}`)}
                    >
                      {copiedKey === `trans-${item.key}` ? "✓" : "Переклад"}
                    </button>
                  )}
                  {!item.removed && (
                    <button
                      type="button"
                      className="btn btn-xs btn-neutral h-6 min-h-0 gap-1 px-1.5 text-[10px]"
                      title="Перейти до цього рядка у редакторі (без закриття довідника)"
                      onClick={() => onNavigateToRow(item.key)}
                    >
                      Перейти
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="truncate font-mono text-[10px] text-base-content/45" title={item.key}>
                <FormattedText text={item.key} queryRe={queryRe} />
              </div>

              {item.translated ? (
                <div className="rounded border border-base-content/8 bg-base-200/80 p-1.5 font-sans text-xs text-primary-content">
                  <FormattedText text={item.translated} queryRe={queryRe} />
                </div>
              ) : (
                <div className="text-[10px] italic text-base-content/45">
                  Ще не перекладено
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

export default ProjectReferenceDrawer;
