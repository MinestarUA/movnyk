import { useRef, useState } from "react";
import CloseButton from "./CloseButton";
import useModalDialog from "./useModalDialog";
import {
  bookSourcesWarning,
  invalidGuidePagesWarning,
  RESOURCE_PACK_FORMATS,
  validatePack,
  versionRowFor,
} from "../lib/resourcePack";

const VERSION_OPTIONS = RESOURCE_PACK_FORMATS.map(([, last]) => versionRowFor(last)).reverse();

const ExportPackModal = ({ pack, summary, onConfirm, onClose }) => {
  const [mcVersion, setMcVersion] = useState(pack.mcVersion);
  const [namespace, setNamespace] = useState(pack.namespace);
  const [language, setLanguage] = useState(pack.language);

  const dialogRef = useRef(null);

  useModalDialog(dialogRef, onClose);

  const errors = validatePack({ namespace, language });
  const isValid = Object.keys(errors).length === 0;

  const sourcesWarning = bookSourcesWarning(summary);
  const guideWarning = invalidGuidePagesWarning(summary);

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-start justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Експорт ресурспаку"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="my-auto w-full max-w-md rounded-box border border-base-content/15 bg-base-200 p-6 sm:p-7 shadow-2xl focus:outline-none animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-accent-pink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </span>
            <h2 className="text-xl font-bold tracking-tight">Ресурспак</h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-base-content/70">
              Версія Minecraft
            </span>
            <select
              className="select select-bordered w-full"
              value={mcVersion}
              onChange={(e) => setMcVersion(e.target.value)}
              autoFocus
            >
              {VERSION_OPTIONS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-base-content/70">
              Простір імен (namespace)
            </span>
            <input
              className={`input input-bordered w-full font-mono text-sm ${errors.namespace ? "input-error" : ""}`}
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
            />
            {errors.namespace && <span className="mt-1 block text-xs text-error">{errors.namespace}</span>}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-base-content/70">
              Код мови
            </span>
            <input
              className={`input input-bordered w-full font-mono text-sm ${errors.language ? "input-error" : ""}`}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
            {errors.language && <span className="mt-1 block text-xs text-error">{errors.language}</span>}
          </label>
        </div>

        {summary.bookFileCount > 0 && (
          <div className="mt-4 rounded-lg border border-base-content/10 bg-base-100/60 px-3.5 py-2.5 text-xs text-base-content/80">
            Файлів книги: <span className="font-semibold tabular-nums">{summary.bookFileCount}</span>, з них перекладено частково:{" "}
            <span className="font-semibold tabular-nums">{summary.partialBookFileCount}</span>.
          </div>
        )}
        {sourcesWarning && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-xs leading-relaxed text-warning">
            {sourcesWarning}
          </div>
        )}
        {guideWarning && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-xs leading-relaxed text-warning">
            {guideWarning}
          </div>
        )}

        <div className="mt-7 flex justify-end gap-2.5 border-t border-base-content/10 pt-4">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary gap-1.5"
            disabled={!isValid}
            onClick={() => onConfirm({ mcVersion, namespace, language })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="M7 11l5 5 5-5" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Завантажити
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportPackModal;
