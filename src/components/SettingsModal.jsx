import { useCallback, useRef, useState } from "react";
import CloseButton from "./CloseButton";
import ConfirmDialog from "./ConfirmDialog";
import useModalDialog from "./useModalDialog";
import { GEMINI_MODELS, DEFAULT_MODEL, AI_PROVIDERS, DEFAULT_SEARCH_PROMPTS } from "../lib/settings";
import { testGeminiConnection, fetchAvailableGeminiModels } from "../lib/gemini";
import { testDeeplConnection, CORS_EXTENSION_URL } from "../lib/deepl";
import { SYNTAX_EXTENSIONS } from "../lib/syntaxExtensions";

const TABS = [
  { id: "ai", label: "ШІ та переклад" },
  { id: "editor", label: "Редактор" },
  { id: "syntax", label: "Синтаксис" },
];

const SettingsModal = ({ settings, detectedSyntaxIds = [], onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState("ai");
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

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
  const [wordAutocompleteEnabled, setWordAutocompleteEnabled] = useState(
    settings.wordAutocompleteEnabled !== false
  );
  const [rewardsEnabled, setRewardsEnabled] = useState(settings.rewardsEnabled !== false);
  const [syntaxExtensions, setSyntaxExtensions] = useState(settings.syntaxExtensions ?? {});
  const [syntaxAutoDetect, setSyntaxAutoDetect] = useState(settings.syntaxAutoDetect !== false);
  const [searchPrompts, setSearchPrompts] = useState(
    settings.searchPrompts ?? DEFAULT_SEARCH_PROMPTS
  );
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

  const draft = {
    aiProvider,
    apiKey: apiKey.trim(),
    model,
    deeplApiKey: deeplApiKey.trim(),
    syncIdenticalTranslations,
    qaChecksEnabled,
    unconfirmOnEdit,
    focusSearchOnFind,
    wordAutocompleteEnabled,
    rewardsEnabled,
    syntaxExtensions,
    syntaxAutoDetect,
    searchPrompts,
  };
  // Compared in a canonical form: an extension ticked and unticked again
  // leaves `false` behind, and stored prompts may list keys in another order.
  const draftJson = JSON.stringify({
    ...draft,
    syntaxExtensions: Object.keys(syntaxExtensions).filter((id) => syntaxExtensions[id]).sort(),
    searchPrompts: Object.entries(searchPrompts).sort(([a], [b]) => a.localeCompare(b)),
  });
  const [initialDraftJson] = useState(draftJson);
  const isDirty = draftJson !== initialDraftJson;

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  // Esc, the backdrop and the close icon are easy to hit by accident, unlike
  // the explicit "Скасувати" button, so they ask before dropping edits.
  const requestClose = useCallback(() => {
    if (!isDirty) {
      onClose();
    } else {
      setConfirmDiscardOpen(true);
    }
  }, [isDirty, onClose]);

  const dialogRef = useRef(null);
  useModalDialog(dialogRef, requestClose, !confirmDiscardOpen);

  const isDeeplFree = deeplApiKey.trim().endsWith(":fx");
  const visibleExtensions = SYNTAX_EXTENSIONS.filter((extension) => !extension.hidden);
  const detectedCount = visibleExtensions.filter((e) => detectedSyntaxIds.includes(e.id)).length;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Налаштування"
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="my-auto flex w-full max-w-xl flex-col rounded-box border border-base-content/15 bg-base-200 p-6 sm:p-7 shadow-2xl focus:outline-none animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Налаштування</h2>
          <CloseButton onClick={requestClose} />
        </div>

        {/* Section Tabs */}
        <div
          role="tablist"
          aria-label="Розділи налаштувань"
          className="mb-5 grid grid-cols-3 gap-1 rounded-xl border border-base-content/10 bg-base-100/70 p-1"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink ${
                  isActive
                    ? "bg-base-300 text-base-content shadow-sm"
                    : "text-base-content/60 hover:text-base-content"
                }`}
              >
                {tab.label}
                {tab.id === "syntax" && detectedCount > 0 && (
                  <span className="badge badge-xs badge-accent font-mono">{detectedCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 1: AI & Translation */}
        {activeTab === "ai" && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold">
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

            {aiProvider === "gemini" && (
              <div className="space-y-4 rounded-xl border border-base-content/10 bg-base-300/45 p-4">
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
                      className="link text-accent-pink"
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
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost gap-1 text-xs"
                        onClick={handleFetchModels}
                        disabled={!apiKey.trim() || loadingModels}
                        title="Отримати актуальний список моделей з вашого акаунта Google AI"
                      >
                        {loadingModels ? (
                          <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 16h5v5" />
                          </svg>
                        )}
                        {loadingModels ? "Завантаження…" : "Оновити з Google"}
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
                      placeholder="Наприклад: gemini-2.5-flash"
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

            {aiProvider === "deepl" && (
              <div className="space-y-4 rounded-xl border border-base-content/10 bg-base-300/45 p-4">
                <div className="flex flex-col gap-2">
                  <label className="flex items-center justify-between text-sm font-semibold" htmlFor="deepl-api-key">
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
                      className="link text-accent-pink"
                    >
                      DeepL API Portal
                    </a>
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border border-base-content/10 bg-base-200/90 p-3.5 text-xs text-base-content/80">
                  <div className="flex items-center gap-2 font-semibold text-base-content">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
                      <path d="M12 22v-5" />
                      <path d="M9 8V2" />
                      <path d="M15 8V2" />
                      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
                    </svg>
                    <span>Робота з DeepL у браузері (без проксі)</span>
                  </div>
                  <p className="leading-relaxed">
                    Оскільки DeepL API блокує прямі запити з браузерів (CORS), рекомендуємо встановити безкоштовне розширення{" "}
                    <a
                      href={CORS_EXTENSION_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link inline-flex items-center gap-1 font-bold text-accent-pink"
                    >
                      CORS Unblock ↗
                    </a>{" "}
                    та активувати його лише для цього сайту. Тоді всі запити йтимуть напряму до DeepL без сторонніх серверів.
                  </p>
                </div>
              </div>
            )}

            {/* Test Connection Button */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-sm btn-outline gap-2"
                onClick={handleTestConnection}
                disabled={testing || (aiProvider === "gemini" ? !apiKey.trim() : !deeplApiKey.trim())}
              >
                {testing && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
                {testing ? "Перевірка…" : "Перевірити з'єднання"}
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

            {/* Google AI search prompts */}
            <div className="space-y-3 border-t border-base-content/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Промпт для пошуку в Google AI</span>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={() => setSearchPrompts(DEFAULT_SEARCH_PROMPTS)}
                >
                  Скинути
                </button>
              </div>
              <p className="text-xs text-base-content/60">
                Використовуйте <code className="rounded bg-base-300 px-1 py-0.5 text-[11px]">{"{original}"}</code> для вихідного тексту та{" "}
                <code className="rounded bg-base-300 px-1 py-0.5 text-[11px]">{"{translation}"}</code> для перекладу.
              </p>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-content/80">Якщо переклад є</span>
                <textarea
                  className="textarea textarea-bordered textarea-sm text-xs"
                  rows={2}
                  value={searchPrompts.correct}
                  onChange={(e) => setSearchPrompts({ ...searchPrompts, correct: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-base-content/80">Якщо перекладу немає</span>
                <textarea
                  className="textarea textarea-bordered textarea-sm text-xs"
                  rows={2}
                  value={searchPrompts.translate}
                  onChange={(e) => setSearchPrompts({ ...searchPrompts, translate: e.target.value })}
                />
              </label>
            </div>
          </div>
        )}

        {/* Tab 2: Editor Settings */}
        {activeTab === "editor" && (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-base-content/10 bg-base-300/35 p-4 space-y-3.5">
              <div>
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
                <p className="mt-1 pl-7 text-xs text-base-content/60">
                  Зміни в перекладі автоматично застосовуються до всіх інших рядків із тотожним вихідним текстом.
                </p>
              </div>

              <div>
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
                <p className="mt-1 pl-7 text-xs text-base-content/60">
                  Попереджати про пропущені знаки в кінці, великі літери, невідповідні пробіли або відсутні змінні Minecraft.
                </p>
              </div>

              <div>
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
              </div>

              <div>
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

              <div>
                <label className="label cursor-pointer justify-start gap-3 py-0">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={wordAutocompleteEnabled}
                    onChange={(e) => setWordAutocompleteEnabled(e.target.checked)}
                  />
                  <span className="label-text text-sm font-medium">Автопідказки слів у перекладах</span>
                </label>
                <p className="mt-1 pl-7 text-xs text-base-content/60">
                  Підказувати слова з інших заповнених перекладів проєкту.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-base-content/10 bg-base-300/35 p-4">
              <label className="label cursor-pointer justify-start gap-3 py-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={rewardsEnabled}
                  onChange={(e) => setRewardsEnabled(e.target.checked)}
                />
                <span className="label-text text-sm font-medium">
                  Режим нагород (30 рівнів із новими прикрасами інтерфейсу)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Tab 3: Syntax Extensions */}
        {activeTab === "syntax" && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-base-content/65">
              Підсвічування та перевірка розмітки окремих модів. Вимкнені, доки ви їх не ввімкнете або не спрацює автовизначення.
            </p>

            <div className="rounded-xl border border-base-content/10 bg-base-300/35 p-4 space-y-3.5">
              <label className="label cursor-pointer justify-start gap-3 py-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={syntaxAutoDetect}
                  onChange={(e) => setSyntaxAutoDetect(e.target.checked)}
                />
                <span className="label-text text-sm font-medium">
                  Автоматично вмикати розширення, знайдені у файлі
                </span>
              </label>

              <div className="h-px bg-base-content/10" />

              {visibleExtensions.map((extension) => {
                const enabled = syntaxExtensions[extension.id] === true;
                const autoEnabled = !enabled && syntaxAutoDetect && detectedSyntaxIds.includes(extension.id);
                return (
                  <div key={extension.id}>
                    <label className="label cursor-pointer justify-start gap-3 py-0">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={enabled}
                        onChange={(e) =>
                          setSyntaxExtensions({ ...syntaxExtensions, [extension.id]: e.target.checked })
                        }
                      />
                      <span className="label-text text-sm font-medium">{extension.label}</span>
                      {autoEnabled && (
                        <span className="badge badge-sm badge-accent badge-outline">Виявлено у файлі</span>
                      )}
                    </label>
                    <p className="mt-1 pl-7 text-xs text-base-content/60">{extension.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-7 flex items-center justify-end gap-2.5 border-t border-base-content/10 pt-4">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn btn-sm btn-primary gap-2" onClick={handleSave}>
            {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}
            Зберегти
          </button>
        </div>
      </div>

      {confirmDiscardOpen && (
        <ConfirmDialog
          title="Незбережені зміни"
          message="Закрити налаштування без збереження внесених змін?"
          confirmLabel="Закрити без збереження"
          cancelLabel="Повернутися"
          tone="error"
          onConfirm={() => {
            setConfirmDiscardOpen(false);
            onClose();
          }}
          onCancel={() => setConfirmDiscardOpen(false)}
        />
      )}
    </div>
  );
};

export default SettingsModal;
