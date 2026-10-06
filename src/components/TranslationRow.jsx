import { useRef, useState, useEffect, useLayoutEffect, useMemo } from "react";
import { tokenizeString } from "../lib/tokens";
import { checkTranslationQA } from "../lib/qa";
import { splitMatches } from "../lib/searching";

const ROW_RULE =
  "linear-gradient(to right, transparent, color-mix(in srgb, var(--color-text) 8%, transparent) 48px, color-mix(in srgb, var(--color-text) 8%, transparent) calc(100% - 48px), transparent) no-repeat bottom / 100% 1px";

export const GRID_COLUMNS = "26px minmax(240px,1.3fr) minmax(240px,1.4fr) 140px";

const wsMarkStyle = {
  background: "color-mix(in srgb, var(--color-accent) 22%, transparent)",
  borderRadius: "2px",
  color: "var(--color-accent-700)",
  fontSize: "10px",
  lineHeight: "inherit",
};

const renderWhitespaceRun = (run, keyPrefix) =>
  [...run].map((ch, i) => {
    const key = `${keyPrefix}-${i}`;
    if (ch === "\n") {
      return (
        <span key={key}>
          <span style={wsMarkStyle}>↵</span>
          {"\n"}
        </span>
      );
    }
    return (
      <span key={key} style={wsMarkStyle}>
        ·
      </span>
    );
  });

// Renders text with search query highlighting
const HighlightedText = ({ text, queryRe }) => {
  const chunks = useMemo(() => splitMatches(text, queryRe), [text, queryRe]);
  return (
    <>
      {chunks.map((chunk, i) =>
        chunk.isMatch ? (
          <mark
            key={i}
            className="bg-yellow-400/35 text-yellow-200 px-0.5 rounded font-semibold"
          >
            {chunk.text}
          </mark>
        ) : (
          chunk.text
        )
      )}
    </>
  );
};

// Renders interactive tokens (formatting codes, escapes, placeholders) as clickable chips
const InteractiveOriginal = ({ text, onInsertToken, queryRe }) => {
  const tokenParts = useMemo(() => tokenizeString(text), [text]);

  return (
    <span>
      {tokenParts.map((part, idx) => {
        if (part.type === "text") {
          const lead = (part.value.match(/^\s+/) || [""])[0];
          const trail = (part.value.match(/\s+$/) || [""])[0];
          if (lead.length + trail.length >= part.value.length) {
            return (
              <span key={idx}>
                {renderWhitespaceRun(part.value, `ws-${idx}`)}
              </span>
            );
          }
          const core = part.value.slice(lead.length, part.value.length - trail.length);
          return (
            <span key={idx}>
              {lead && renderWhitespaceRun(lead, `ws-l-${idx}`)}
              <HighlightedText text={core} queryRe={queryRe} />
              {trail && renderWhitespaceRun(trail, `ws-t-${idx}`)}
            </span>
          );
        }

        // Color/formatting codes
        let badgeStyle = "bg-primary/20 text-primary border-primary/30";
        if (part.type === "mc-code") {
          badgeStyle = "bg-secondary/25 text-secondary border-secondary/40";
        } else if (part.type === "escape") {
          badgeStyle = "bg-accent/20 text-accent border-accent/40";
        }

        return (
          <button
            key={idx}
            type="button"
            title={`Натисніть, щоб вставити «${part.value}» у переклад`}
            onClick={(e) => {
              e.stopPropagation();
              onInsertToken?.(part.value);
            }}
            className={`inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-xs font-mono font-bold border transition-transform hover:scale-105 active:scale-95 cursor-pointer ${badgeStyle}`}
          >
            {part.value}
          </button>
        );
      })}
    </span>
  );
};

const SearchIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="6.5" />
    <line x1="19" y1="19" x2="14.5" y2="14.5" />
  </svg>
);

const CheckIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CopyIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const SparklesIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
);

const statusDotStyle = (status) => {
  const base = { width: "8px", height: "8px", borderRadius: "50%", display: "block" };
  if (status === "confirmed")
    return { ...base, background: "var(--status-confirmed)", boxShadow: "0 0 0 3px rgba(99,214,138,0.15)" };
  if (status === "pending") return { ...base, border: "1.5px solid var(--status-pending)" };
  return { ...base, border: "1.5px solid var(--color-neutral-700)" };
};

const TranslationRow = ({
  rowStyle,
  item,
  isSelected,
  focusRequestRef,
  cursorPositionRef,
  queryRe,
  qaEnabled = true,
  duplicateCount = 1,
  onSelect,
  onTranslate,
  onConfirmToggle,
  onCopy,
  onDefinition,
  onSuggest,
  isSuggesting = false,
}) => {
  const textareaRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const copiedTimer = useRef(null);

  const handleCopyClick = () => {
    onCopy();
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyKey = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(item.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  };

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    if (isSelected && focusRequestRef?.current) {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        focusRequestRef.current = false;
        if (
          cursorPositionRef?.current?.key === item.key &&
          cursorPositionRef.current.start != null
        ) {
          const { start, end } = cursorPositionRef.current;
          el.setSelectionRange(start, end);
        } else if (el.value) {
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }
    }
  }, [isSelected, item.key, focusRequestRef, cursorPositionRef]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!isSelected || !el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, ACTION_STACK_HEIGHT)}px`;
  }, [isSelected, item.translated]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    return () => {
      if (el && document.activeElement === el) {
        focusRequestRef.current = true;
        if (cursorPositionRef) {
          cursorPositionRef.current = {
            key: item.key,
            start: el.selectionStart,
            end: el.selectionEnd,
          };
        }
      }
    };
  }, [item.key, focusRequestRef, cursorPositionRef]);

  const handleInsertToken = (tokenValue) => {
    const el = textareaRef.current;
    if (!el) {
      onTranslate((item.translated || "") + tokenValue);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const val = el.value || "";
    const next = val.slice(0, start) + tokenValue + val.slice(end);
    onTranslate(next);
    setTimeout(() => {
      el.focus();
      const newPos = start + tokenValue.length;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const hasDraft = Boolean(item.translated.trim());
  const status = item.confirmed ? "confirmed" : hasDraft ? "pending" : "empty";
  const expanded = isSelected;
  const stop = (e) => e.stopPropagation();

  // Run QA checks
  const qaIssues = useMemo(() => {
    if (!qaEnabled || !hasDraft) return [];
    return checkTranslationQA(item.original, item.translated);
  }, [qaEnabled, hasDraft, item.original, item.translated]);

  const outerStyle = {
    ...rowStyle,
    display: "grid",
    gridTemplateColumns: GRID_COLUMNS,
    gap: "var(--space-6)",
    padding: expanded ? "var(--space-4) var(--space-2)" : "0 var(--space-2)",
    alignItems: expanded ? "start" : "center",
    minHeight: expanded ? ROW_EXPANDED : ROW_COLLAPSED,
    background: expanded ? "var(--color-surface)" : ROW_RULE,
    borderRadius: expanded ? "var(--radius-md)" : "0",
    borderLeft: expanded ? "2px solid var(--accent-pink)" : "2px solid transparent",
    boxShadow: expanded ? "var(--shadow-sm)" : "none",
    cursor: "pointer",
    boxSizing: "border-box",
  };

  return (
    <div style={outerStyle} onClick={onSelect}>
      {/* 1. Status Dot */}
      <div style={{ display: "flex", alignItems: expanded ? "flex-start" : "center", paddingTop: expanded ? "4px" : 0 }}>
        <span style={statusDotStyle(status)} />
      </div>

      {/* 2. Source Column: Original String on top, Key underneath (Compact 2-row layout) */}
      <div className="flex flex-col justify-center min-w-0 pr-2">
        {/* Top: Original text */}
        <div
          style={{
            fontSize: "13px",
            color: "var(--color-neutral-200)",
            lineHeight: 1.4,
            whiteSpace: expanded ? "pre-wrap" : "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {expanded ? (
            <InteractiveOriginal
              text={item.original}
              onInsertToken={handleInsertToken}
              queryRe={queryRe}
            />
          ) : (
            <HighlightedText text={item.original} queryRe={queryRe} />
          )}
        </div>

        {/* Bottom: Key with optional duplicate badge */}
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0 text-[11px] text-base-content/40 font-mono">
          <span
            className="truncate select-text hover:text-base-content/70 transition-colors"
            title={item.key}
          >
            <HighlightedText text={item.key} queryRe={queryRe} />
          </span>
          {expanded && (
            <button
              type="button"
              onClick={handleCopyKey}
              className="text-[10px] opacity-60 hover:opacity-100 transition-opacity shrink-0 px-1 py-0.5 rounded bg-base-300"
              title="Скопіювати ключ"
            >
              {copiedKey ? "✓" : "📋"}
            </button>
          )}
          {duplicateCount > 1 && (
            <span
              className="badge badge-xs badge-info font-sans shrink-0"
              title={`Цей вихідний текст повторюється у ${duplicateCount} ключах. Зміни синхронізуються автоматично.`}
            >
              🔄 {duplicateCount}
            </span>
          )}
        </div>
      </div>

      {/* 3. Translation Column */}
      <div className="flex flex-col justify-center min-w-0">
        {expanded ? (
          <div>
            <textarea
              ref={textareaRef}
              data-role="translation"
              data-key={item.key}
              value={item.translated}
              lang="uk"
              spellCheck={true}
              onChange={(e) => {
                onTranslate(e.target.value);
                if (cursorPositionRef) {
                  cursorPositionRef.current = {
                    key: item.key,
                    start: e.target.selectionStart,
                    end: e.target.selectionEnd,
                  };
                }
              }}
              onSelect={(e) => {
                if (cursorPositionRef) {
                  cursorPositionRef.current = {
                    key: item.key,
                    start: e.target.selectionStart,
                    end: e.target.selectionEnd,
                  };
                }
              }}
              onKeyUp={(e) => {
                if (cursorPositionRef) {
                  cursorPositionRef.current = {
                    key: item.key,
                    start: e.target.selectionStart,
                    end: e.target.selectionEnd,
                  };
                }
              }}
              onMouseUp={(e) => {
                if (cursorPositionRef) {
                  cursorPositionRef.current = {
                    key: item.key,
                    start: e.target.selectionStart,
                    end: e.target.selectionEnd,
                  };
                }
              }}
              onFocus={(e) => {
                onSelect();
                if (cursorPositionRef) {
                  cursorPositionRef.current = {
                    key: item.key,
                    start: e.target.selectionStart,
                    end: e.target.selectionEnd,
                  };
                }
              }}
              onClick={stop}
              placeholder="Введіть український переклад…"
              aria-label={`Переклад для ${item.key}`}
              style={{
                width: "100%",
                minHeight: `${ACTION_STACK_HEIGHT}px`,
                background: "var(--color-bg)",
                border: "1px solid var(--color-divider)",
                borderRadius: "var(--radius-md)",
                padding: "8px 10px",
                color: "var(--color-text)",
                fontSize: "13px",
                fontFamily: "var(--font-body)",
                lineHeight: 1.4,
                resize: "none",
                overflow: "hidden",
                outline: "none",
              }}
              onFocusCapture={(e) => (e.target.style.borderColor = "var(--color-accent)")}
              onBlurCapture={(e) => (e.target.style.borderColor = "var(--color-divider)")}
            />

            {/* QA Warnings */}
            {qaIssues.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {qaIssues.map((issue, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30 font-medium"
                    title={issue.message}
                  >
                    ⚠️ {issue.message}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              style={{
                fontSize: "13px",
                color: hasDraft ? "var(--color-neutral-200)" : "var(--color-neutral-600)",
                fontStyle: hasDraft ? "normal" : "italic",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {hasDraft ? (
                <HighlightedText text={item.translated} queryRe={queryRe} />
              ) : (
                "Перекласти…"
              )}
            </div>
            {qaIssues.length > 0 && (
              <span
                className="text-warning text-xs shrink-0 cursor-help"
                title={qaIssues.map((i) => i.message).join("\n")}
              >
                ⚠️
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. Actions Column */}
      {expanded ? (
        <div
          onClick={stop}
          style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "stretch" }}
        >
          {/* AI Suggestion Button */}
          {onSuggest && (
            <button
              type="button"
              className={`btn btn-sm btn-outline btn-primary text-xs ${isSuggesting ? "loading" : ""}`}
              onClick={() => onSuggest(item)}
              disabled={isSuggesting}
              title="Запропонувати автоматичний переклад через ШІ"
            >
              <SparklesIcon size={14} />
              {isSuggesting ? "Переклад..." : "ШІ-переклад"}
            </button>
          )}

          <button
            type="button"
            className={`btn btn-sm text-xs ${
              item.confirmed ? "btn-success" : "btn-neutral"
            }`}
            onClick={onConfirmToggle}
            disabled={!hasDraft}
            title={item.confirmed ? "Зняти затвердження" : "Затвердити переклад"}
          >
            <CheckIcon size={14} />
            {item.confirmed ? "Затверджено" : "Затвердити"}
          </button>

          <button
            type="button"
            className="btn btn-sm btn-ghost text-xs"
            onClick={handleCopyClick}
            title="Копіювати оригінальний текст"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            {copied ? "Скопійовано" : "Копіювати"}
          </button>

          {onDefinition && (
            <button
              type="button"
              className="btn btn-sm btn-ghost text-xs opacity-70 hover:opacity-100"
              onClick={onDefinition}
              title="Пошук перекладу в Google"
            >
              <SearchIcon size={13} />
              Google
            </button>
          )}
        </div>
      ) : (
        <div onClick={stop} style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
          {onSuggest && (
            <button
              type="button"
              className="btn btn-xs btn-ghost text-primary"
              onClick={() => onSuggest(item)}
              disabled={isSuggesting}
              title="Запропонувати ШІ-переклад"
            >
              <SparklesIcon size={13} />
            </button>
          )}
          <button
            type="button"
            className={`btn btn-xs ${
              item.confirmed ? "btn-success" : "btn-ghost text-base-content/50"
            }`}
            onClick={onConfirmToggle}
            disabled={!hasDraft}
            title={item.confirmed ? "Зняти затвердження" : "Затвердити переклад"}
          >
            <CheckIcon size={13} />
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost text-base-content/50"
            onClick={handleCopyClick}
            title={copied ? "Скопійовано" : "Копіювати оригінал"}
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          </button>
        </div>
      )}
    </div>
  );
};

const ACTION_STACK_HEIGHT = 120;
export const ROW_COLLAPSED = 52;
export const ROW_EXPANDED = 150;

export default TranslationRow;
