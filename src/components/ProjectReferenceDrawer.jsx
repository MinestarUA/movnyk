import { useState, useMemo, useEffect, useCallback } from "react";
import { compileQuery, itemMatches } from "../lib/searching";
import FormattedText from "./FormattedText";

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
    return translations.filter((item) => itemMatches(item, queryRe)).slice(0, 100);
  }, [translations, query, queryRe]);

  if (!isOpen) return null;

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <aside
      className="w-80 md:w-96 h-full bg-base-200 border-l border-neutral/70 shadow-lg flex flex-col p-4 overflow-hidden shrink-0 z-5"
      style={{ boxSizing: "border-box" }}
    >
      <div className="flex items-center justify-between pb-3 border-b border-neutral/70">
        <div className="min-w-0 pr-2">
          <h2 className="text-base font-bold flex items-center gap-2 truncate">
            <span>📖</span> Довідник проєкту
          </h2>
          <p className="text-[11px] text-base-content/60 truncate mt-0.5">
            Шукайте терміни без втрати позиції в редакторі
          </p>
        </div>
        <button
          type="button"
          className="btn btn-xs btn-circle btn-ghost"
          onClick={onClose}
          aria-label="Сховати довідник"
          title="Сховати довідник"
        >
          ✕
        </button>
      </div>

      {/* Search Input */}
      <div className="py-3">
        <div className="relative">
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
            className="input input-sm input-bordered w-full pr-8 text-xs"
          />
          {query && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content text-xs"
              onClick={() => onQueryChange("")}
            >
              ✕
            </button>
          )}
        </div>
        {query.trim() && (
          <div className="text-[11px] text-base-content/60 mt-1.5 flex justify-between">
            <span>Знайдено: {results.length >= 100 ? "100+" : results.length}</span>
            {activeKey && (
              <span className="text-primary font-mono text-[10px] truncate max-w-[180px]" title={activeKey}>
                Рядок: {activeKey}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {!query.trim() ? (
          <div className="text-center py-12 text-base-content/40 text-xs">
            Введіть запит, щоб знайти терміни у проєкті.
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12 text-base-content/40 text-xs">
            Нічого не знайдено за цим запитом.
          </div>
        ) : (
          results.map((item) => (
            <div
              key={item.key}
              className="rounded-lg border border-neutral/60 bg-base-100 p-2.5 space-y-1.5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-xs text-base-content/90 min-w-0">
                  {item.removed && (
                    <span className="badge badge-warning badge-xs mr-1.5 align-middle">Видалено</span>
                  )}
                  <FormattedText text={item.original} queryRe={queryRe} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost text-[10px] h-6 min-h-0 px-1.5"
                    title="Скопіювати оригінал"
                    onClick={() => handleCopy(item.original, `orig-${item.key}`)}
                  >
                    {copiedKey === `orig-${item.key}` ? "✓" : "Оригінал"}
                  </button>
                  {item.translated && (
                    <button
                      type="button"
                      className="btn btn-xs btn-primary btn-outline text-[10px] h-6 min-h-0 px-1.5"
                      title="Скопіювати переклад"
                      onClick={() => handleCopy(item.translated, `trans-${item.key}`)}
                    >
                      {copiedKey === `trans-${item.key}` ? "✓" : "Переклад"}
                    </button>
                  )}
                  {!item.removed && (
                    <button
                      type="button"
                      className="btn btn-xs btn-neutral text-[10px] h-6 min-h-0 px-1.5"
                      title="Перейти до цього рядка у редакторі (без закриття довідника)"
                      onClick={() => {
                        onNavigateToRow(item.key);
                      }}
                    >
                      Перейти ➔
                    </button>
                  )}
                </div>
              </div>

              <div className="text-[10px] font-mono text-base-content/50 truncate" title={item.key}>
                <FormattedText text={item.key} queryRe={queryRe} />
              </div>

              {item.translated ? (
                <div className="text-xs text-primary-content bg-base-200/80 rounded p-1.5 font-sans border border-base-content/5">
                  <FormattedText text={item.translated} queryRe={queryRe} />
                </div>
              ) : (
                <div className="text-[10px] text-base-content/30 italic">
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
