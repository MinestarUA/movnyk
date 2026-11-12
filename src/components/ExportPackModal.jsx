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
      className="fixed inset-0 z-[3000] flex items-start justify-center bg-black/60 p-4 animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Експорт ресурспаку"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-box border border-neutral bg-base-200 p-7 shadow-2xl my-auto focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Ресурспак</h2>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="text-sm font-semibold mb-1 block">Версія Minecraft</span>
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
            <span className="text-sm font-semibold mb-1 block">Простір імен (namespace)</span>
            <input
              className="input input-bordered w-full font-mono text-sm"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
            />
            {errors.namespace && <span className="mt-1 block text-xs text-error">{errors.namespace}</span>}
          </label>

          <label className="block">
            <span className="text-sm font-semibold mb-1 block">Код мови</span>
            <input
              className="input input-bordered w-full font-mono text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
            {errors.language && <span className="mt-1 block text-xs text-error">{errors.language}</span>}
          </label>
        </div>

        {summary.bookFileCount > 0 && (
          <p className="mt-4 text-sm">
            Файлів книги: {summary.bookFileCount}, з них перекладено частково: {summary.partialBookFileCount}.
          </p>
        )}
        {sourcesWarning && <p className="mt-4 text-sm text-warning">{sourcesWarning}</p>}
        {guideWarning && <p className="mt-4 text-sm text-warning">{guideWarning}</p>}

        <div className="mt-8 flex justify-end gap-3">
          <button className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button
            className="btn btn-primary"
            disabled={!isValid}
            onClick={() => onConfirm({ mcVersion, namespace, language })}
          >
            Завантажити
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportPackModal;
