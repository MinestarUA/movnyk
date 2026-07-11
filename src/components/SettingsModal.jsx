import { useState } from "react";
import { GEMINI_MODELS, DEFAULT_MODEL } from "../lib/settings";

// The parent mounts this fresh (with a key) each time it opens, so initializing
// form state straight from props is all the syncing that's needed.
const SettingsModal = ({ settings, onSave, onClose }) => {
  const [apiKey, setApiKey] = useState(settings.apiKey ?? "");
  const [model, setModel] = useState(settings.model ?? DEFAULT_MODEL);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    onSave({ apiKey: apiKey.trim(), model });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Налаштування"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border-2 border-neutral bg-base-200 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black">Налаштування</h2>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold" htmlFor="gemini-api-key">
            Ключ Gemini API
          </label>
          <div className="flex gap-2">
            <input
              id="gemini-api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Вставте ключ Gemini API…"
              className="input input-bordered flex-1 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? "Приховати ключ" : "Показати ключ"}
            >
              {showKey ? "Сховати" : "Показати"}
            </button>
          </div>
          <p className="text-xs text-base-content/50">
            Отримати ключ можна безкоштовно в{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="link link-primary"
            >
              Google AI Studio
            </a>
            . Ключ зберігається лише у вашому браузері й нікуди не надсилається, крім Google.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <label className="text-sm font-semibold" htmlFor="gemini-model">
            Модель
          </label>
          <select
            id="gemini-model"
            className="select select-bordered"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {GEMINI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
