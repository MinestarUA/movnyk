import { useEffect, useState } from "react";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

// Esc closes the dialog, Tab stays inside it, and closing hands focus back to
// the button that opened it. The dialog element needs tabIndex={-1} so it can
// take focus when nothing inside asks for autoFocus.
const useModalDialog = (dialogRef, onRequestClose) => {
  // Read during the first render, before autoFocus moves focus into the dialog.
  const [opener] = useState(() => document.activeElement);
  useEffect(() => () => opener?.focus?.(), [opener]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.contains(document.activeElement)) dialog.focus();
  }, [dialogRef]);

  // Listens on the window so Esc and Tab also work when a click left focus on the page body.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onRequestClose();
      } else if (e.key === "Tab") {
        const focusable = dialogRef.current.querySelectorAll(FOCUSABLE);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const focusIsInside = dialogRef.current.contains(document.activeElement);
        if (!focusIsInside || (e.shiftKey && document.activeElement === first)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogRef, onRequestClose]);
};

export default useModalDialog;
