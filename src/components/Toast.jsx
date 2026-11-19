import { createContext, useContext, useCallback, useRef, useState } from "react";

const ToastContext = createContext(() => {});

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

const TOAST_STYLE = {
  error: "border-error/45 bg-base-200/95 text-base-content",
  success: "border-success/45 bg-base-200/95 text-base-content",
  warning: "border-warning/45 bg-base-200/95 text-base-content",
  info: "border-accent/45 bg-base-200/95 text-base-content",
};

const ICON_COLOR = {
  error: "text-error",
  success: "text-success",
  warning: "text-warning",
  info: "text-accent",
};

const ToastIcon = ({ type }) => {
  const color = ICON_COLOR[type] ?? ICON_COLOR.info;
  if (type === "success") {
    return (
      <svg className={`h-4 w-4 shrink-0 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="9 12 11.5 14.5 16 9.5" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg className={`h-4 w-4 shrink-0 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  if (type === "warning") {
    return (
      <svg className={`h-4 w-4 shrink-0 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg className={`h-4 w-4 shrink-0 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, type = "info", duration = 4000, action = null) => {
      const id = (idRef.current += 1);
      setToasts((current) => [...current, { id, message, type, action }]);
      window.setTimeout(() => remove(id), duration);
      return id;
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast toast-end toast-bottom z-[2000] gap-2 whitespace-normal">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`flex max-w-sm cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur-md animate-slide-in-right ${TOAST_STYLE[toast.type] ?? TOAST_STYLE.info}`}
            onClick={() => remove(toast.id)}
          >
            <span className="mt-0.5">
              <ToastIcon type={toast.type} />
            </span>
            <span className="flex-1 text-[13px] leading-snug">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="btn btn-xs btn-ghost border border-base-content/20 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.action.onClick();
                  remove(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Закрити сповіщення"
              onClick={(e) => {
                e.stopPropagation();
                remove(toast.id);
              }}
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-base-content/45 transition-colors hover:bg-base-300 hover:text-base-content"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
