import { useState } from "react";
import { GEMINI_MODELS, DEFAULT_MODEL, AI_PROVIDERS } from "../lib/settings";
import { testGeminiConnection, fetchAvailableGeminiModels } from "../lib/gemini";
import { testDeeplConnection, CORS_EXTENSION_URL } from "../lib/deepl";

const SettingsModal = ({ settings, onSave, onClose }) => {
  const [aiProvider, setAiProvider] = useState(settings.aiProvider ?? "gemini");
  const [apiKey, setApiKey] = useState(settings.apiKey ?? "");
  const [model, setModel] = useState(settings.model ?? DEFAULT_MODEL);
  const [modelsList, setModelsList] = useState(GEMINI_MODELS);
  const [loadingModels, setLoadingModels] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(
    Boolean(settings.model && !GEMINI_MODELS.some((m) => m.id === settings.model))
  );
  const [deeplApiKey, setDeeplApiKey] = useState(settings.deeplApiKey ?? "");

  const [syncIdenticalTranslations, setSyncIdenticalTranslations] = useState(
    settings.syncIdenticalTranslations !== false
  );
  const [qaChecksEnabled, setQaChecksEnabled] = useState(settings.qaChecksEnabled !== false);
  const [unconfirmOnEdit, setUnconfirmOnEdit] = useState(settings.unconfirmOnEdit !== false);
  const [focusSearchOnFind, setFocusSearchOnFind] = useState(settings.focusSearchOnFind === true);
  const [showKey, setShowKey] = useState(false);

  // Testing connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: boolean, message: string }

  const handleFetchModels = async () => {
    if (!apiKey.trim()) return;
    setLoadingModels(true);
    try {
      const fetched = await fetchAvailableGeminiModels(apiKey);
      if (fetched.length > 0) {
        setModelsList(fetched);
        if (!fetched.some((m) => m.id === model)) {
          setModel(fetched[0].id);
        }
        setTestResult({
          ok: true,
          message: `Успішно завантажено ${fetched.length} доступних моделей з Google AI!`,
        });
      } else {
        setTestResult({
          ok: false,
          message: "Не вдалося отримати список моделей. Перевірте ключ API.",
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err.message || "Помилка завантаження моделей",
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (aiProvider === "deepl") {
        await testDeeplConnection({
          apiKey: deeplApiKey,
        });
        setTestResult({ ok: true, message: "Підключення до DeepL успішне!" });
      } else {
        await testGeminiConnection(apiKey, model);
        setTestResult({ ok: true, message: "Підключення до Gemini успішне!" });
      }
    } catch (err) {
      setTestResult({ ok: false, message: err.message || "Помилка підключення" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave({
      aiProvider,
      apiKey: apiKey.trim(),
      model,
      deeplApiKey: deeplApiKey.trim(),
      syncIdenticalTranslations,
      qaChecksEnabled,
      unconfirmOnEdit,
      focusSearchOnFind,
    });
    onClose();
  };

  const isDeeplFree = deeplApiKey.trim().endsWith(":fx");

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Налаштування"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border-2 border-neutral bg-base-200 p-7 shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black">Налаштування</h2>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>

        {/* AI Provider Switcher */}
        <div className="mb-6">
          <label className="text-sm font-semibold mb-2 block">
            Сервіс автоматичного перекладу (ШІ)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn btn-sm ${
                  aiProvider === p.id ? "btn-primary font-bold" : "btn-neutral"
                }`}
                onClick={() => {
                  setAiProvider(p.id);
                  setTestResult(null);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gemini Settings */}
        {aiProvider === "gemini" && (
          <div className="space-y-4 rounded-xl bg-base-300/50 p-4 border border-base-content/10 mb-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold" htmlFor="gemini-api-key">
                Ключ Google Gemini API
              </label>
              <div className="flex gap-2">
                <input
                  id="gemini-api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="AIzaSy…"
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
              <p className="text-xs text-base-content/60">
                Отримати ключ безкоштовно:{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold" htmlFor="gemini-model">
                  Модель Gemini
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`btn btn-xs btn-ghost text-xs ${loadingModels ? "loading" : ""}`}
                    onClick={handleFetchModels}
                    disabled={!apiKey.trim() || loadingModels}
                    title="Отримати актуальний список моделей з вашого акаунта Google AI"
                  >
                    {loadingModels ? "Завантаження…" : "🔄 Оновити з Google"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost text-xs opacity-75 hover:opacity-100"
                    onClick={() => setCustomModelMode((v) => !v)}
                  >
                    {customModelMode ? "Список" : "Власна назва"}
                  </button>
                </div>
              </div>

              {customModelMode ? (
                <input
                  id="gemini-model"
                  type="text"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="Наприклад: gemini-3.8-flash або gemini-2.5-flash"
                  className="input input-bordered font-mono text-sm"
                />
              ) : (
                <select
                  id="gemini-model"
                  className="select select-bordered"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setTestResult(null);
                  }}
                >
                  {modelsList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* DeepL Settings */}
        {aiProvider === "deepl" && (
          <div className="space-y-4 rounded-xl bg-base-300/50 p-4 border border-base-content/10 mb-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold flex items-center justify-between" htmlFor="deepl-api-key">
                <span>Ключ DeepL API</span>
                {deeplApiKey.trim() && (
                  <span className="badge badge-sm badge-info">
                    {isDeeplFree ? "DeepL API Free" : "DeepL API Pro"}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  id="deepl-api-key"
                  type={showKey ? "text" : "password"}
                  value={deeplApiKey}
                  onChange={(e) => {
                    setDeeplApiKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="Вставте ключ DeepL API…"
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
              <p className="text-xs text-base-content/60">
                Отримати ключ:{" "}
                <a
                  href="https://www.deepl.com/pro-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary"
                >
                  DeepL API Portal
                </a>
              </p>
            </div>

            <div className="rounded-lg bg-base-200/90 p-3.5 text-xs text-base-content/80 border border-base-content/10 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-base-content">
                <span>🔌</span>
                <span>Робота з DeepL у браузері (без проксі)</span>
              </div>
              <p className="leading-relaxed">
                Оскільки DeepL API блокує прямі запити з браузерів (CORS), рекомендуємо встановити безкоштовне розширення{" "}
                <a
                  href={CORS_EXTENSION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary font-bold inline-flex items-center gap-1"
                >
                  CORS Unblock ↗
                </a>{" "}
                та активувати його лише для цього сайту. Тоді всі запити йтимуть напряму до DeepL без сторонніх серверів.
              </p>
            </div>
          </div>
        )}

        {/* Test Connection Button */}
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`btn btn-sm btn-outline ${testing ? "loading" : ""}`}
              onClick={handleTestConnection}
              disabled={testing || (aiProvider === "gemini" ? !apiKey.trim() : !deeplApiKey.trim())}
            >
              {testing ? "Перевірка..." : "Перевірити з'єднання"}
            </button>
            {testResult && (
              <span
                className={`text-xs font-semibold ${
                  testResult.ok ? "text-success" : "text-error"
                }`}
              >
                {testResult.message}
              </span>
            )}
          </div>
        </div>

        {/* Localization & Editor Settings */}
        <div className="space-y-3 border-t border-neutral pt-4">
          <label className="label cursor-pointer justify-start gap-3 py-0">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={syncIdenticalTranslations}
              onChange={(e) => setSyncIdenticalTranslations(e.target.checked)}
            />
            <span className="label-text text-sm font-medium">
              Автоматично синхронізувати однакові рядки
            </span>
          </label>
          <p className="text-xs text-base-content/50 pl-7">
            Зміни в перекладі автоматично застосовуються до всіх інших рядків із тотожним вихідним текстом.
          </p>

          <label className="label cursor-pointer justify-start gap-3 py-0">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={qaChecksEnabled}
              onChange={(e) => setQaChecksEnabled(e.target.checked)}
            />
            <span className="label-text text-sm font-medium">
              Перевірка пунктуації, пробілів та змінних (QA)
            </span>
          </label>
          <p className="text-xs text-base-content/50 pl-7">
            Попереджати про пропущені знаки в кінці, великі літери, невідповідні пробіли або відсутні змінні Minecraft.
          </p>

          <label className="label cursor-pointer justify-start gap-3 py-0">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={unconfirmOnEdit}
              onChange={(e) => setUnconfirmOnEdit(e.target.checked)}
            />
            <span className="label-text text-sm font-medium">
              Знімати затвердження після ручного редагування рядка
            </span>
          </label>

          <label className="label cursor-pointer justify-start gap-3 py-0">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={focusSearchOnFind}
              onChange={(e) => setFocusSearchOnFind(e.target.checked)}
            />
            <span className="label-text text-sm font-medium">
              Переходити фокусом на пошук при використанні Ctrl+F
            </span>
          </label>
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
