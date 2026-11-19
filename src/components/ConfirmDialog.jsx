import { useRef } from "react";
import CloseButton from "./CloseButton";
import useModalDialog from "./useModalDialog";

const ConfirmDialog = ({
  title,
  message,
  confirmLabel = "Підтвердити",
  cancelLabel = "Скасувати",
  tone = "primary",
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef(null);
  useModalDialog(dialogRef, onCancel);

  const confirmBtnClass = tone === "error" ? "btn btn-sm btn-error" : "btn btn-sm btn-primary";

  return (
    <div
      className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-box border border-base-content/15 bg-base-200 p-6 shadow-2xl focus:outline-none animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 id="confirm-dialog-title" className="text-base font-bold text-base-content">
            {title}
          </h3>
          <CloseButton onClick={onCancel} />
        </div>
        <p id="confirm-dialog-message" className="text-sm leading-relaxed text-base-content/75">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmBtnClass} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
