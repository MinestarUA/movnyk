const shortName = (path) => path.split("/").pop() || path;

const LangSelectionScreen = ({ langFiles, onLangSelect, onBack }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base-100 p-6 sm:p-8 font-sans text-base-content animate-fade-in">
      <div className="w-full max-w-[600px] rounded-box border border-base-content/15 bg-base-200 p-7 sm:p-10 shadow-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="btn btn-ghost btn-sm gap-1.5 px-2 text-base-content/70 hover:text-base-content"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Назад
            </button>
          ) : (
            <div />
          )}
          <span className="rounded-full bg-base-300 px-2.5 py-0.5 text-xs tabular-nums text-base-content/65">
            Файлів: {langFiles.length}
          </span>
        </div>

        <h2 className="mt-0 mb-2 text-2xl sm:text-3xl font-bold text-base-content">
          Виберіть мовний файл
        </h2>
        <p className="mb-6 text-sm text-base-content/65">
          Оберіть файл, який стане основою (оригіналом) для перекладу.
        </p>

        <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
          {langFiles.map((langFile) => {
            const filename = shortName(langFile.name);
            const isEnglishSource = /^en_us\.json$/i.test(filename);
            const entryCount = langFile.content ? Object.keys(langFile.content).length : null;

            return (
              <button
                key={langFile.name}
                type="button"
                className="group flex w-full items-center gap-3.5 rounded-lg border border-base-content/10 bg-base-300/60 px-4 py-3 text-left transition-all duration-150 hover:border-primary/50 hover:bg-base-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
                onClick={() => onLangSelect(langFile)}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-accent-pink transition-colors group-hover:bg-primary/25">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="13" y2="17" />
                  </svg>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-base-content">{filename}</span>
                    {isEnglishSource && (
                      <span className="badge badge-xs badge-primary font-medium">Рекомендовано</span>
                    )}
                  </span>
                  <span className="truncate font-mono text-[11px] text-base-content/50">
                    {langFile.name}
                  </span>
                </span>
                {entryCount !== null && (
                  <span className="shrink-0 text-xs tabular-nums text-base-content/50">
                    {entryCount} рядків
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LangSelectionScreen;
