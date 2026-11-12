import { useEffect, useRef, useState } from "react";
import { isTranslatable } from "../lib/translations";

const WelcomeScreen = ({ onFileDrop, onPasteClipboard, sessions, onResume, onDeleteSession }) => {
  const [isDragging, setIsDragging] = useState(false);
  const hasSessions = sessions.length > 0;
  const fileInputRef = useRef(null);

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

  const handleDeleteSession = (session, index) => {
    if (window.confirm(`Видалити сесію «${session.name}»? Цю дію не можна скасувати.`)) {
      focusAfterDeleteRef.current = index;
      onDeleteSession(session.id);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
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
    <div className="flex justify-center items-center min-h-screen text-base-content text-center font-sans p-8">
      <div className="max-w-[800px] w-full">
        <h1 className="text-6xl font-black text-base-content mb-2 animate-slide-in-top">Мовник</h1>
        <p className="text-xl mb-10 text-base-content/60 animate-slide-in-top [animation-delay:0.2s]">
          Інструмент для перекладу модифікацій Minecraft.
        </p>
        {hasSessions && (
          <section className="mb-8 text-left animate-fade-in">
            <h2 className="m-0 mb-3 text-lg font-semibold">Нещодавні сесії</h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {sessions.map((session, index) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-4 rounded-box border border-base-content/15 bg-base-200 p-4"
                >
                  <div className="min-w-0">
                    <p className="m-0 truncate font-semibold">{session.name}</p>
                    <p className="m-0 mt-1 text-sm text-base-content/60">
                      Затверджено{" "}
                      {session.translations.filter((t) => t.confirmed && isTranslatable(t)).length} /{" "}
                      {session.translations.filter(isTranslatable).length} · збережено{" "}
                      {new Date(session.savedAt).toLocaleString("uk-UA")}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
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
                      className="btn btn-ghost btn-sm btn-square text-base-content/60 hover:text-error"
                      aria-label={`Видалити сесію «${session.name}»`}
                      onClick={() => handleDeleteSession(session, index)}
                    >
                      <svg
                        className="w-4 h-4"
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
              ))}
            </ul>
          </section>
        )}
        <button
          ref={pickerButtonRef}
          type="button"
          onClick={openFilePicker}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Завантажити файл .jar або .json"
          className={`w-full block border-2 border-dashed rounded-box ${hasSessions ? "py-8" : "py-16"} px-8 cursor-pointer transition-all duration-300 ease-in-out animate-scale-in-center [animation-delay:0.4s] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isDragging
              ? "border-primary bg-base-300 scale-[1.02]"
              : "border-neutral bg-base-200 hover:bg-base-300 hover:border-primary hover:scale-[1.02]"
          }`}
        >
          <svg
            className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragging ? "text-primary" : "text-base-content/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9m0 0L8.25 12.75M12 9l3.75 3.75" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15.75V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-2.25" />
          </svg>
          <p className="m-0 text-xl font-medium text-base-content/70">
            {isDragging ? "Відпустіть файл тут" : "Перетягніть сюди файл .jar або .json"}
          </p>
          <p className="m-0 mt-2 text-sm text-base-content/60">або натисніть, щоб обрати файл</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jar,.json"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="mt-4 flex items-center justify-center gap-3 animate-fade-in [animation-delay:0.5s]">
          <span className="text-sm text-base-content/60">або</span>
          <button
            type="button"
            onClick={onPasteClipboard}
            className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-accent-pink"
          >
            <svg
              className="w-4 h-4"
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
    </div>
  );
};

export default WelcomeScreen;
