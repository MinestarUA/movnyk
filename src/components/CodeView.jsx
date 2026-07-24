import { useEffect, useRef, useState } from "react";
// The editor core, the handful of editor features this view actually uses, and
// the JSON language — nothing else. The "monaco-editor" root entry would pull
// in all 84 languages Monaco ships for a format that is always JSON.
//
// Paths look prefix-less because monaco's package exports map "./*" onto
// "./esm/vs/*.js"; the older "monaco-editor/esm/vs/..." specifiers no longer
// resolve.
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/features/codicon/register";
import "monaco-editor/features/find/register";
import "monaco-editor/features/folding/register";
import "monaco-editor/features/multicursor/register";
import "monaco-editor/features/bracketMatching/register";
import "monaco-editor/features/clipboard/register";
import "monaco-editor/features/contextmenu/register";
import "monaco-editor/features/cursorUndo/register";
import "monaco-editor/features/lineSelection/register";
import "monaco-editor/features/linesOperations/register";
import "monaco-editor/features/wordHighlighter/register";
import "monaco-editor/features/hover/register";
import "monaco-editor/features/format/register";
// These three are not used directly, but their controllers are pulled in by the
// features above and log "depends on UNKNOWN service" on every editor creation
// unless their own register modules provide the services.
import "monaco-editor/features/codelens/register";
import "monaco-editor/features/dropOrPasteInto/register";
import "monaco-editor/features/suggest/register";
import { jsonDefaults } from "monaco-editor/languages/features/json/register";
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/languages/features/json/json.worker?worker";
import { serializeOriginals, serializeTranslations } from "../lib/codeSync";

// Vite bundles the workers locally, so the editor keeps working offline — the
// whole app is a local translation tool and must not depend on a CDN.
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    return label === "json" ? new jsonWorker() : new editorWorker();
  },
};

const THEME = "movnyk-dark";

// Reading the app's own palette out of the stylesheet keeps the editor from
// looking like a foreign window pasted into the page.
const cssVar = (name, fallback) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

let themeDefined = false;
const ensureTheme = () => {
  if (themeDefined) return;
  monaco.editor.defineTheme(THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": cssVar("--color-bg", "#161826"),
      "editorGutter.background": cssVar("--color-bg", "#161826"),
      "editor.foreground": cssVar("--color-text", "#e9e9ed"),
      "editorLineNumber.foreground": cssVar("--color-neutral-500", "#8a8a99"),
      "editor.lineHighlightBackground": cssVar("--color-surface", "#232532"),
      "editorWidget.background": cssVar("--color-surface", "#232532"),
    },
  });
  themeDefined = true;
};

const BASE_OPTIONS = {
  language: "json",
  theme: THEME,
  wordWrap: "on",
  minimap: { enabled: false },
  // Monaco's own automaticLayout polls on a timer; a ResizeObserver on the
  // container costs nothing when the window is idle.
  automaticLayout: false,
  scrollBeyondLastLine: false,
  fontSize: 13,
  tabSize: 2,
  renderLineHighlight: "line",
};

const CodeView = ({ translations, onApply, onError }) => {
  const leftHostRef = useRef(null);
  const rightHostRef = useRef(null);
  const rightEditorRef = useRef(null);

  // Latest props without re-creating the editors on every parent render. Kept
  // in an effect rather than assigned during render — writing a ref while
  // rendering is exactly what the react-hooks rules forbid. Declared before the
  // mount effect so it has already run when that one reads translationsRef.
  const onApplyRef = useRef(onApply);
  const onErrorRef = useRef(onError);
  const translationsRef = useRef(translations);

  const [parseError, setParseError] = useState(null);
  // True while the pane's own edit is propagating, so the resulting state change
  // is not serialized straight back into the buffer under the user's cursor.
  const selfEditRef = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    onApplyRef.current = onApply;
    onErrorRef.current = onError;
    translationsRef.current = translations;
  });

  useEffect(() => {
    ensureTheme();

    // Validation is what puts a squiggle and a gutter marker on the offending
    // position when the buffer stops being valid JSON. Schema requests are off —
    // no network from this app.
    jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false,
    });

    const rows = translationsRef.current;
    const left = monaco.editor.create(leftHostRef.current, {
      ...BASE_OPTIONS,
      value: serializeOriginals(rows),
      readOnly: true,
      domReadOnly: true,
    });
    const right = monaco.editor.create(rightHostRef.current, {
      ...BASE_OPTIONS,
      value: serializeTranslations(rows),
    });
    rightEditorRef.current = right;

    const changeListener = right.onDidChangeModelContent(() => {
      clearTimeout(debounceRef.current);
      // Debounced because every keystroke would otherwise re-render thousands of
      // rows and re-run autosave.
      debounceRef.current = setTimeout(() => {
        const text = right.getValue();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (error) {
          setParseError(error.message);
          onErrorRef.current?.(error.message);
          return;
        }
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          const message = "Очікується об'єкт JSON виду { \"ключ\": \"переклад\" }.";
          setParseError(message);
          onErrorRef.current?.(message);
          return;
        }
        setParseError(null);
        selfEditRef.current = true;
        onApplyRef.current?.(parsed);
      }, 300);
    });

    // Both panes hold the same keys in the same order, so matching scroll
    // offsets keeps every line beside its own translation. The guard stops the
    // two editors bouncing the event back at each other.
    let syncing = false;
    const link = (from, to) =>
      from.onDidScrollChange((e) => {
        if (syncing) return;
        syncing = true;
        to.setScrollTop(e.scrollTop);
        syncing = false;
      });
    const scrollLinks = [link(left, right), link(right, left)];

    const observer = new ResizeObserver(() => {
      left.layout();
      right.layout();
    });
    observer.observe(leftHostRef.current);
    observer.observe(rightHostRef.current);

    return () => {
      scrollLinks.forEach((d) => d.dispose());
      changeListener.dispose();
      clearTimeout(debounceRef.current);
      observer.disconnect();
      left.getModel()?.dispose();
      right.getModel()?.dispose();
      left.dispose();
      right.dispose();
      rightEditorRef.current = null;
    };
  }, []);

  // A sidebar lang import (or any other outside write) has to show up in the
  // buffer. The pane's own edits must not: rewriting the model would reset the
  // cursor and selection mid-keystroke.
  useEffect(() => {
    if (selfEditRef.current) {
      selfEditRef.current = false;
      return;
    }
    const editor = rightEditorRef.current;
    if (!editor) return;
    const next = serializeTranslations(translations);
    if (next !== editor.getValue()) editor.setValue(next);
  }, [translations]);

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {parseError && (
        <div
          role="alert"
          style={{
            flexShrink: 0,
            margin: "0 var(--space-6) var(--space-2)",
            padding: "6px 10px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-error, #ff5f6d)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "12.5px",
          }}
        >
          Помилка JSON — зміни не застосовано: {parseError}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, borderRight: "1px solid var(--color-divider)" }}>
          <div ref={leftHostRef} style={{ width: "100%", height: "100%" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div ref={rightHostRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </div>
    </div>
  );
};

export default CodeView;
