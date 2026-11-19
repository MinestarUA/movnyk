import { useEffect, useRef, useState } from "react";
import { isTranslatable } from "../lib/translations";
import ConfirmDialog from "./ConfirmDialog";

const SUPPORTED_FORMATS = [".jar", ".json", "Patchouli", "GuideME"];

const WelcomeScreen = ({ onFileDrop, onPasteClipboard, sessions, onResume, onDeleteSession }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { session, index }
  const hasSessions = sessions.length > 0;
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);

  const pickerButtonRef = useRef(null);
  const continueButtonRefs = useRef([]);
  const focusAfterDeleteRef = useRef(null);

  // The deleted row's button is gone, so keyboard focus would drop to the page
  // top: move it to the session that took its place, or to the file picker.
  useEffect(() => {
    const deletedIndex = focusAfterDeleteRef.current;
    if (deletedIndex === null) return;
    focusAfterDeleteRef.current = null;
    const target = continueButtonRefs.current[Math.min(deletedIndex, sessions.length - 1)];
    (target ?? pickerButtonRef.current)?.focus();
  }, [sessions]);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    focusAfterDeleteRef.current = pendingDelete.index;
    onDeleteSession(pendingDelete.session.id);
    setPendingDelete(null);
  };

  const handleWindowDragEnter = (e) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleWindowDragOver = (e) => {
    e.preventDefault();
  };

  const handleWindowDragLeave = (e) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleWindowDrop = (e) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileDrop(e.target.files[0]);
    }
    e.target.value = null;
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6 sm:p-8 font-sans text-base-content text-center"
      onDragEnter={handleWindowDragEnter}
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
    >
      {/* Subtle ambient glow behind the brand header */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[110px]"
        style={{ background: "radial-gradient(circle, var(--accent-pink), var(--accent-purple) 60%, transparent)" }}
      />

      {/* Full-window drop overlay */}
      {isDragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent-pink bg-base-100/85 backdrop-blur-sm animate-fade-in"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-accent-pink">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9m0 0L8.25 12.75M12 9l3.75 3.75" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15.75V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-2.25" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-base-content">Відпустіть файл .jar або .json</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-[780px]">
        <header className="mb-9 animate-slide-in-top">
          <h1 className="mb-2 text-5xl sm:text-6xl font-black tracking-tight text-base-content">
            Мовник
          </h1>
          <p className="text-base sm:text-lg text-base-content/65">
            Інструмент для перекладу модифікацій Minecraft
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {SUPPORTED_FORMATS.map((fmt) => (
              <span
                key={fmt}
                className="rounded-full border border-base-content/10 bg-base-200/80 px-2.5 py-0.5 font-mono text-[11px] text-base-content/60"
              >
                {fmt}
              </span>
            ))}
          </div>
        </header>

        {hasSessions && (
          <section className="mb-7 text-left animate-fade-in">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="m-0 text-xs font-semibold uppercase tracking-widest text-base-content/50">
                Нещодавні сесії
              </h2>
              <span className="text-xs tabular-nums text-base-content/40">{sessions.length}</span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {sessions.map((session, index) => {
                const translatableTotal = session.translations.filter(isTranslatable).length;
                const confirmedTotal = session.translations.filter((t) => t.confirmed && isTranslatable(t)).length;
                const pct = translatableTotal ? Math.floor((confirmedTotal / translatableTotal) * 100) : 0;

                return (
                  <li
                    key={session.id}
                    className="group flex items-center justify-between gap-4 rounded-box border border-base-content/12 bg-base-200/90 p-4 transition-all duration-150 hover:border-primary/40 hover:bg-base-200"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="m-0 truncate font-semibold text-base-content">{session.name}</p>
                        {pct === 100 && translatableTotal > 0 && (
                          <span className="badge badge-xs badge-success font-semibold">Готово</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 w-28 sm:w-36 shrink-0 overflow-hidden rounded-full bg-base-300">
                          <div
                            className="h-full rounded-full transition-[width] duration-300"
                            style={{
                              width: `${pct}%`,
                              background:
                                pct === 100 ? "var(--status-confirmed)" : "var(--accent-gradient)",
                            }}
                          />
                        </div>
                        <p className="m-0 truncate text-xs tabular-nums text-base-content/60">
                          {confirmedTotal} / {translatableTotal} ({pct}%) ·{" "}
                          {new Date(session.savedAt).toLocaleString("uk-UA", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        ref={(button) => {
                          continueButtonRefs.current[index] = button;
                        }}
                        type="button"
                        className="btn btn-primary btn-sm"
                        aria-label={`Продовжити сесію «${session.name}»`}
                        onClick={() => onResume(session)}
                      >
                        Продовжити
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:bg-error/15 hover:text-error"
                        aria-label={`Видалити сесію «${session.name}»`}
                        title="Видалити сесію"
                        onClick={() => setPendingDelete({ session, index })}
                      >
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
                          <path d="M3 6h18" />
                          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <button
          ref={pickerButtonRef}
          type="button"
          onClick={openFilePicker}
          aria-label="Завантажити файл .jar або .json"
          className={`group block w-full cursor-pointer rounded-box border-2 border-dashed ${
            hasSessions ? "py-9" : "py-16"
          } px-8 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink ${
            isDragging
              ? "border-accent-pink bg-base-300/90 scale-[1.01]"
              : "border-base-content/15 bg-base-200/80 hover:border-primary/60 hover:bg-base-200"
          }`}
        >
          <div
            className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
              isDragging
                ? "bg-primary/20 text-accent-pink"
                : "bg-base-300/80 text-base-content/50 group-hover:bg-primary/15 group-hover:text-accent-pink"
            }`}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.7}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9m0 0L8.25 12.75M12 9l3.75 3.75" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15.75V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-2.25" />
            </svg>
          </div>
          <p className="m-0 text-lg font-semibold text-base-content/90">
            {isDragging ? "Відпустіть файл тут" : "Перетягніть сюди файл .jar або .json"}
          </p>
          <p className="m-0 mt-1.5 text-sm text-base-content/55">
            або натисніть, щоб обрати файл з комп’ютера
          </p>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jar,.json"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="mt-4 flex items-center justify-center gap-2.5 animate-fade-in">
          <span className="text-xs text-base-content/50">або</span>
          <button
            type="button"
            onClick={onPasteClipboard}
            className="btn btn-ghost btn-sm gap-2 text-base-content/75 hover:bg-base-200 hover:text-accent-pink"
          >
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
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Вставити JSON з буфера обміну
          </button>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Видалити сесію?"
          message={`Сесію «${pendingDelete.session.name}» та весь її збережений прогрес буде видалено безповоротно.`}
          confirmLabel="Видалити"
          tone="error"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

export default WelcomeScreen;
