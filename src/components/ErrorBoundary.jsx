import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  // eslint-disable-next-line no-unused-vars -- error is unused but required by React's lifecycle method signature
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // An opt-in local fallback lets a single failing region degrade on its own
      // instead of taking the whole screen down with it.
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-base-100 p-6 text-base-content">
          <div className="w-full max-w-md rounded-box border border-error/30 bg-base-200 p-7 text-center shadow-2xl">
            <h2 className="mb-2 text-xl font-bold">Щось пішло не так</h2>
            <p className="mb-5 text-sm text-base-content/70">
              Виникла несподівана помилка. Спробуйте перезавантажити сторінку — збережені сесії залишаться в браузері.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => window.location.reload()}
            >
              Перезавантажити сторінку
            </button>
            {this.state.error && (
              <details className="mt-5 rounded-lg border border-base-content/10 bg-base-100 p-3 text-left text-xs text-base-content/70">
                <summary className="cursor-pointer font-semibold text-base-content/85">Деталі помилки</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
