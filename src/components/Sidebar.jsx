import { useRef } from "react";
import { useToast } from "./Toast";
import { hasApiKey } from "../lib/settings";

const Sidebar = ({
  confirmedCount,
  total,
  onExportJson,
  onExportResourcePack,
  onLoadLang,
  settings,
  onOpenSettings,
  onAutoTranslate,
  onCancelAutoTranslate,
  aiState,
}) => {
  const fileInputRef = useRef(null);
  const toast = useToast();

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target.result);
          const applied = onLoadLang(content);
          if (applied > 0) {
            toast(`Застосовано перекладів: ${applied}.`, "success");
          } else {
            toast("Жоден ключ із цього файлу не збігся з поточним проєктом.", "warning");
          }
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          toast("Не вдалося обробити файл. Переконайтеся, що це коректний JSON.", "error");
        }
      };
      reader.onerror = () => toast("Не вдалося прочитати файл.", "error");
      reader.readAsText(file);
    }
    // Reset file input to allow loading the same file again
    e.target.value = null;
  };

  const keyReady = hasApiKey(settings);
  const running = aiState?.running;
  const aiProgress = running && aiState.total ? Math.round((aiState.done / aiState.total) * 100) : 0;

  return (
    <aside className="w-[300px] flex-shrink-0 bg-base-200 border-l-2 border-neutral h-screen p-8 flex flex-col shadow-[-5px_0_15px_rgba(0,0,0,0.1)] animate-slide-in-right overflow-y-auto">
      <div className="h-full flex flex-col">
        <div className="mb-6 flex items-center justify-between gap-2 border-b-2 border-b-neutral pb-6">
          <h2 className="text-3xl">Дії</h2>
          <button
            className="btn btn-ghost btn-sm gap-1"
            onClick={onOpenSettings}
            title="Налаштування"
            aria-label="Налаштування"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        <div className="mb-6 rounded-lg bg-base-300 p-4 text-center">
          <div className="text-3xl font-black text-primary tabular-nums">
            {confirmedCount}
            <span className="text-base-content/40 text-xl font-semibold"> / {total}</span>
          </div>
          <div className="text-xs uppercase tracking-wide text-base-content/50 mt-1">
            підтверджено
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {keyReady && (
            <>
              {running ? (
                <div className="rounded-lg border-2 border-primary/40 bg-base-300 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="loading loading-spinner loading-sm text-primary" />
                    Перекладаю з Gemini…
                  </div>
                  <progress
                    className="progress progress-primary mt-3 w-full"
                    value={aiState.done}
                    max={aiState.total || 1}
                    aria-label="Прогрес автоперекладу"
                  />
                  <div className="mt-1 text-xs tabular-nums text-base-content/60">
                    {aiState.done} / {aiState.total} ({aiProgress}%)
                  </div>
                  <button
                    className="btn btn-outline btn-error btn-sm mt-3 w-full"
                    onClick={onCancelAutoTranslate}
                  >
                    Скасувати
                  </button>
                </div>
              ) : (
                <button className="btn btn-secondary gap-2" onClick={onAutoTranslate}>
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                    />
                  </svg>
                  Автопереклад з Gemini
                </button>
              )}
              <div className="divider my-1 text-xs text-base-content/40">Файли</div>
            </>
          )}

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".json,.lang"
          />
          <button className="btn btn-neutral" onClick={handleLoadClick} disabled={running}>
            Приєднати Lang файл
          </button>
          <div className="divider my-1 text-xs text-base-content/40">Експорт</div>
          <button className="btn btn-primary" onClick={onExportJson}>
            Експортувати як JSON
          </button>
          <button className="btn btn-outline btn-primary" onClick={onExportResourcePack}>
            Експортувати як ресурспак
          </button>
        </div>

        {!keyReady && (
          <button
            className="mt-6 text-xs text-base-content/50 underline decoration-dotted hover:text-primary"
            onClick={onOpenSettings}
          >
            Додайте ключ Gemini API, щоб перекладати автоматично
          </button>
        )}

        <p className="mt-auto pt-6 text-xs text-base-content/40 text-center">
          Порожні переклади не потрапляють до експорту.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
