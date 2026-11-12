import { useRef } from "react";
import { useToast } from "./Toast";
import { hasApiKey } from "../lib/settings";
import { parseLangContent } from "../lib/importing";
import { describeOriginalUpdate } from "../lib/originalUpdate";

const DIVIDER = "h-px shrink-0 bg-base-content/15";
const SECTION_LABEL = "text-[10px] uppercase tracking-widest text-gray-500";
const IMPORT_BTN =
  "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-base-content/15 px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-base-content disabled:cursor-not-allowed disabled:opacity-50";
const CHECKBOX_LABEL = "flex cursor-pointer items-start gap-2 text-xs leading-snug text-gray-400";
const CHECKBOX = "mt-0.5 size-3.5 shrink-0 accent-accent";
const EXPORT_BTN =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-primary/40 text-xs font-semibold text-accent-pink";

const Sidebar = ({
  open = true,
  confirmedCount,
  total,
  onExportJson,
  onExportResourcePack,
  onExportClipboard,
  onLoadLang,
  onLoadArchive,
  onApplyNewOriginal,
  skipApproved,
  onSkipApprovedChange,
  skipIdentical,
  onSkipIdenticalChange,
  confirmImport,
  onConfirmImportChange,
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

  const toastLoadResult = ({ applied, skipped }, extra = "") => {
    if (applied > 0) {
      toast(`Застосовано перекладів: ${applied}.` + (skipped > 0 ? ` Пропущено: ${skipped}.` : "") + extra, "success");
    } else if (skipped > 0) {
      toast("Усі збіги пропущено." + extra, "warning");
    } else {
      toast("Жоден ключ із цього файлу не збігся з поточним проєктом." + extra, "warning");
    }
  };

  const handleArchive = async (file) => {
    let result;
    try {
      result = await onLoadArchive(file);
    } catch (error) {
      console.error("Error reading archive:", error);
      toast("Не вдалося прочитати архів. Можливо, він пошкоджений.", "error");
      return;
    }
    const { skippedPageCount } = result;
    toastLoadResult(
      result,
      skippedPageCount > 0 ? ` Сторінок посібника з іншою структурою пропущено: ${skippedPageCount}.` : ""
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && /\.(zip|jar)$/i.test(file.name)) {
      handleArchive(file);
    } else if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          toastLoadResult(onLoadLang(parseLangContent(event.target.result)));
        } catch (error) {
          console.error("Error parsing lang file:", error);
          toast("Не вдалося обробити файл. Переконайтеся, що це коректний JSON або .lang файл.", "error");
        }
      };
      reader.onerror = () => toast("Не вдалося прочитати файл.", "error");
      reader.readAsText(file);
    }
    // Reset file input to allow loading the same file again
    e.target.value = null;
  };

  const handlePasteLangClipboard = async () => {
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (error) {
      console.error("Clipboard read failed:", error);
      toast("Не вдалося прочитати буфер обміну. Дозвольте доступ до буфера обміну.", "error");
      return;
    }
    if (!text || !text.trim()) {
      toast("Буфер обміну порожній.", "warning");
      return;
    }
    try {
      const content = parseLangContent(text);
      const { applied, skipped } = onLoadLang(content);
      if (applied > 0) {
        toast(
          `Застосовано перекладів: ${applied}.` +
            (skipped > 0 ? ` Пропущено: ${skipped}.` : ""),
          "success"
        );
      } else if (skipped > 0) {
        toast("Усі збіги з буфера пропущено.", "warning");
      } else {
        toast("Жоден ключ із буфера не збігся з поточним проєктом.", "warning");
      }
    } catch (error) {
      console.error("Error parsing clipboard lang:", error);
      toast("Не вдалося обробити вміст буфера обміну. Переконайтеся, що це коректний JSON або .lang файл.", "error");
    }
  };

  const handlePasteOriginalClipboard = async () => {
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (error) {
      console.error("Clipboard read failed:", error);
      toast("Не вдалося прочитати буфер обміну. Дозвольте доступ до буфера обміну.", "error");
      return;
    }
    if (!text || !text.trim()) {
      toast("Буфер обміну порожній.", "warning");
      return;
    }
    try {
      const newOriginal = parseLangContent(text);
      toast(describeOriginalUpdate(onApplyNewOriginal(newOriginal)), "success");
    } catch (error) {
      console.error("Error parsing clipboard original:", error);
      toast("Не вдалося обробити вміст буфера обміну. Переконайтеся, що це коректний JSON або .lang файл.", "error");
    }
  };

  const keyReady = hasApiKey(settings);
  const running = aiState?.running;
  const aiProgress = running && aiState.total ? Math.floor((aiState.done / aiState.total) * 100) : 0;

  return (
    <aside
      className={`relative z-10 h-full shrink-0 overflow-hidden bg-base-200/70 backdrop-blur-[14px] transition-[width,min-width] duration-200 ${
        open
          ? "w-[260px] min-w-[260px] border-l border-base-content/15 shadow-[-4px_0_16px_rgba(0,0,0,0.25)]"
          : "w-0 min-w-0"
      }`}
    >
      <div className="flex h-full w-[260px] flex-col gap-3 overflow-y-auto px-3 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-base font-medium">Дії</div>
          <button
            onClick={onOpenSettings}
            title="Налаштування"
            aria-label="Налаштування"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-base-content/15 text-gray-400"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-0.5 py-2">
          <div className="text-2xl font-bold leading-[1.1]">
            {confirmedCount}{" "}
            <span className="text-sm font-medium text-gray-500">/ {total}</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500">Затверджено</div>
        </div>

        {keyReady &&
          (running ? (
            <div className="rounded-lg border border-primary/40 bg-base-100 p-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <span className="loading loading-spinner loading-sm text-accent-pink" />
                Перекладаю через ШІ…
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-[image:var(--accent-gradient)] transition-[width] duration-200"
                  style={{ width: `${aiProgress}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] tabular-nums text-gray-500">
                {aiState.done} / {aiState.total} ({aiProgress}%)
              </div>
              <button
                onClick={onCancelAutoTranslate}
                className="mt-2.5 h-8 w-full rounded-lg border border-error text-xs font-semibold text-error"
              >
                Скасувати
              </button>
            </div>
          ) : (
            <button
              onClick={onAutoTranslate}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[image:var(--accent-gradient)] text-[13px] font-bold text-white shadow-[shadow:var(--accent-glow)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
              Автопереклад через ШІ
            </button>
          ))}

        <div className={DIVIDER} />

        <div className="flex flex-col gap-2">
          <div className={SECTION_LABEL}>Імпорт</div>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".json,.lang,.zip,.jar" />
          <button className={IMPORT_BTN} onClick={handleLoadClick} disabled={running}>
            <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="M7 8l5-5 5 5" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Приєднати Lang файл
          </button>
          <button className={IMPORT_BTN} onClick={handlePasteLangClipboard} disabled={running}>
            <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Приєднати Lang з буфера
          </button>
          <div className={DIVIDER} />
          <button className={IMPORT_BTN} onClick={handlePasteOriginalClipboard} disabled={running}>
            <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 4v5h-5" />
            </svg>
            Приєднати та оновити оригінал (з буфера)
          </button>
          <p className="text-xs leading-snug text-gray-500">
            Вставте новий оригінал (en_us.json) в буфер. Затвердження зі змінених рядків знімається, видалені лишаються в довіднику.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className={SECTION_LABEL}>Під час імпорту</div>
          <label className={CHECKBOX_LABEL}>
            <input
              type="checkbox"
              checked={skipApproved}
              onChange={(e) => onSkipApprovedChange(e.target.checked)}
              className={CHECKBOX}
            />
            Пропускати вже затверджені переклади
          </label>
          <label className={CHECKBOX_LABEL}>
            <input
              type="checkbox"
              checked={skipIdentical}
              onChange={(e) => onSkipIdenticalChange(e.target.checked)}
              className={CHECKBOX}
            />
            Пропускати переклади, що збігаються з оригіналом
          </label>
          <label className={CHECKBOX_LABEL}>
            <input
              type="checkbox"
              checked={confirmImport}
              onChange={(e) => onConfirmImportChange(e.target.checked)}
              className={CHECKBOX}
            />
            Позначати імпортовані рядки як затверджені
          </label>
        </div>

        <div className={DIVIDER} />

        <div className="flex flex-col gap-2">
          <div className={SECTION_LABEL}>Експорт</div>
          <button className={`${EXPORT_BTN} bg-primary/15`} onClick={onExportJson}>
            Експортувати як JSON
          </button>
          <button className={EXPORT_BTN} onClick={onExportResourcePack}>
            Експортувати як ресурспак
          </button>
          <button className={EXPORT_BTN} onClick={onExportClipboard}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Копіювати JSON до буфера
          </button>
        </div>

        {!keyReady && (
          <button
            onClick={onOpenSettings}
            className="p-0 text-left text-xs text-gray-500 underline decoration-dotted"
          >
            Додайте ключ API ШІ, щоб перекладати автоматично
          </button>
        )}

        <div className="flex-1" />
        <div className="text-[11px] leading-normal text-gray-500">
          Порожні переклади не потрапляють до експорту.
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
