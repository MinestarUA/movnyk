import { useState, useMemo, useRef, useEffect } from "react";
import { compileQuery, itemMatches, splitMatches } from "../lib/searching";

const Highlighted = ({ text, queryRe }) => {
  const chunks = useMemo(() => splitMatches(text, queryRe), [text, queryRe]);
  return (
    <span>
      {chunks.map((chunk, idx) =>
        chunk.isMatch ? (
          <mark
            key={idx}
            className="bg-yellow-400/40 text-yellow-200 px-0.5 rounded font-semibold"
          >
            {chunk.text}
          </mark>
        ) : (
          chunk.text
        )
      )}
    </span>
  );
};

const ProjectReferenceDrawer = ({
  isOpen,
  onClose,
  translations,
  onNavigateToRow,
  activeKey,
}) => {
  const [query, setQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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
    <div
      className="fixed inset-0 z-[2500] flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full bg-base-200 border-l border-neutral shadow-2xl flex flex-col p-6 overflow-hidden animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-neutral">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>📖</span> Довідник проєкту (Друга панель)
            </h2>
            <p className="text-xs text-base-content/60 mt-0.5">
              Шукайте терміни та переклади без втрати позиції у головному списку
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <div className="py-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Шукати в оригіналі, перекладі чи ключі…"
              className="input input-bordered w-full pr-10 text-sm"
            />
            {query && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content text-sm"
                onClick={() => setQuery("")}
              >
                ✕
              </button>
            )}
          </div>
          {query.trim() && (
            <div className="text-xs text-base-content/60 mt-2 flex justify-between">
              <span>Знайдено: {results.length >= 100 ? "100+" : results.length}</span>
              {activeKey && (
                <span className="text-primary font-mono text-[11px]">
                  Поточний рядок: {activeKey}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {!query.trim() ? (
            <div className="text-center py-16 text-base-content/40 text-sm">
              Введіть запит, щоб знайти терміни у поточному проєкті.
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16 text-base-content/40 text-sm">
              Нічого не знайдено за цим запитом.
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-neutral/70 bg-base-100 p-3.5 space-y-2 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm text-base-content/90">
                    <Highlighted text={item.original} queryRe={queryRe} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost text-xs"
                      title="Скопіювати оригінал"
                      onClick={() => handleCopy(item.original, `orig-${item.key}`)}
                    >
                      {copiedKey === `orig-${item.key}` ? "✓" : "Оригінал"}
                    </button>
                    {item.translated && (
                      <button
                        type="button"
                        className="btn btn-xs btn-primary btn-outline text-xs"
                        title="Скопіювати переклад"
                        onClick={() => handleCopy(item.translated, `trans-${item.key}`)}
                      >
                        {copiedKey === `trans-${item.key}` ? "✓" : "Переклад"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-xs btn-neutral text-xs"
                      title="Перейти до цього рядка у редакторі"
                      onClick={() => {
                        onNavigateToRow(item.key);
                      }}
                    >
                      Перейти ➔
                    </button>
                  </div>
                </div>

                <div className="text-xs font-mono text-base-content/50 truncate">
                  <Highlighted text={item.key} queryRe={queryRe} />
                </div>

                {item.translated ? (
                  <div className="text-sm text-primary-content bg-base-200/80 rounded-lg p-2 font-sans border border-base-content/5">
                    <Highlighted text={item.translated} queryRe={queryRe} />
                  </div>
                ) : (
                  <div className="text-xs text-base-content/30 italic">
                    Ще не перекладено
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectReferenceDrawer;
