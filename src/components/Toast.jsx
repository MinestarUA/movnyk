import { createContext, useContext, useCallback, useRef, useState } from "react";

const ToastContext = createContext(() => {});

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

const ALERT_CLASS = {
  error: "alert-error",
  success: "alert-success",
  warning: "alert-warning",
  info: "alert-info",
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
      <div className="toast toast-end toast-bottom z-[2000] whitespace-normal">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`alert ${ALERT_CLASS[toast.type] ?? ALERT_CLASS.info} max-w-sm shadow-lg animate-slide-in-right cursor-pointer`}
            onClick={() => remove(toast.id)}
          >
            <span className="text-sm">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="btn btn-xs btn-ghost border-current"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.action.onClick();
                  remove(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
