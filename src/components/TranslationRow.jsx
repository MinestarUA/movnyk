import { useRef, useState, useEffect, useLayoutEffect } from "react";

// Bottom hairline drawn as a background gradient so it fades in from the row's
// inner padding edges, matching the design's inset divider.
const ROW_RULE =
  "linear-gradient(to right, transparent, color-mix(in srgb, var(--color-text) 8%, transparent) 48px, color-mix(in srgb, var(--color-text) 8%, transparent) calc(100% - 48px), transparent) no-repeat bottom / 100% 1px";

const GRID_COLUMNS = "26px minmax(180px,1fr) minmax(200px,1.3fr) minmax(200px,1.3fr) 132px";

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

const statusDotStyle = (status) => {
  const base = { width: "8px", height: "8px", borderRadius: "50%", display: "block" };
  if (status === "confirmed")
    return { ...base, background: "var(--status-confirmed)", boxShadow: "0 0 0 3px rgba(99,214,138,0.15)" };
  if (status === "pending") return { ...base, border: "1.5px solid var(--status-pending)" };
  return { ...base, border: "1.5px solid var(--color-neutral-700)" };
};

const lookupBtnStyle = {
  width: "32px",
  height: "32px",
  flexShrink: 0,
  borderRadius: "var(--radius-sm)",
  background: "rgba(255,95,162,0.1)",
  border: "1px solid rgba(255,95,162,0.3)",
  color: "#ff9dc6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const copyBtnStyle = {
  width: "32px",
  height: "32px",
  flexShrink: 0,
  borderRadius: "var(--radius-sm)",
  background: "transparent",
  border: "1px solid var(--color-divider)",
  color: "var(--color-neutral-500)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const confirmBtnStyle = (confirmed, disabled) => ({
  width: "32px",
  height: "32px",
  flexShrink: 0,
  borderRadius: "var(--radius-sm)",
  background: confirmed ? "rgba(99,214,138,0.16)" : "transparent",
  border: confirmed ? "1px solid rgba(99,214,138,0.5)" : "1px solid var(--color-divider)",
  color: confirmed ? "var(--status-confirmed)" : "var(--color-neutral-500)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.4 : 1,
});

// Labelled variants for the expanded row: full-width, icon + text, so the
// buttons fill the actions column instead of leaving it mostly empty.
const labelBtnBase = {
  height: "32px",
  width: "100%",
  borderRadius: "var(--radius-sm)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "0 8px",
  fontFamily: "var(--font-heading)",
  fontSize: "11.5px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const lookupLabelBtnStyle = {
  ...labelBtnBase,
  background: "rgba(255,95,162,0.1)",
  border: "1px solid rgba(255,95,162,0.3)",
  color: "#ff9dc6",
};

const copyLabelBtnStyle = {
  ...labelBtnBase,
  background: "transparent",
  border: "1px solid var(--color-divider)",
  color: "var(--color-neutral-400)",
};

// Green confirmation shown briefly after a successful copy.
const copiedLabelBtnStyle = {
  ...labelBtnBase,
  background: "rgba(99,214,138,0.16)",
  border: "1px solid rgba(99,214,138,0.5)",
  color: "var(--status-confirmed)",
};

const copiedIconBtnStyle = {
  ...copyBtnStyle,
  background: "rgba(99,214,138,0.16)",
  border: "1px solid rgba(99,214,138,0.5)",
  color: "var(--status-confirmed)",
};

const confirmLabelBtnStyle = (confirmed, disabled) => ({
  ...labelBtnBase,
  background: confirmed ? "rgba(99,214,138,0.16)" : "transparent",
  border: confirmed ? "1px solid rgba(99,214,138,0.5)" : "1px solid var(--color-divider)",
  color: confirmed ? "var(--status-confirmed)" : "var(--color-neutral-400)",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.4 : 1,
});

const TranslationRow = ({
  rowStyle,
  item,
  isSelected,
  focusRequestRef,
  onSelect,
  onTranslate,
  onConfirmToggle,
  onCopy,
  onDefinition,
}) => {
  const textareaRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(null);

  const handleCopyClick = () => {
    onCopy();
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    // Focus only when the selection was driven by keyboard navigation, so
    // filtering/searching never yanks the caret out of another field.
    if (isSelected && focusRequestRef?.current) {
      textareaRef.current?.focus();
      focusRequestRef.current = false;
    }
  }, [isSelected, focusRequestRef]);

  // Auto-grow the field to fit its content so long multiline translations
  // don't force scrolling inside a small box. Runs synchronously before paint
  // so the row is measured at its final height (no flicker).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!isSelected || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [isSelected, item.translated]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    return () => {
      // If the virtualized list unmounts this row while its textarea is
      // focused, request focus restoration on the next mount. (Layout cleanup
      // runs before the DOM node is removed, so activeElement is still valid.)
      if (el && document.activeElement === el) {
        focusRequestRef.current = true;
      }
    };
  }, [focusRequestRef]);

  const hasDraft = Boolean(item.translated.trim());
  const status = item.confirmed ? "confirmed" : hasDraft ? "pending" : "empty";
  const expanded = isSelected;
  const stop = (e) => e.stopPropagation();

  const outerStyle = {
    ...rowStyle,
    display: "grid",
    gridTemplateColumns: GRID_COLUMNS,
    gap: "var(--space-6)",
    padding: expanded ? "var(--space-4) var(--space-2)" : "0 var(--space-2)",
    alignItems: expanded ? "start" : "center",
    // No fixed height: the list measures each row (ResizeObserver) so an
    // expanded row grows with its content. minHeight keeps the default sizes —
    // a single line collapsed, the action-button stack when expanded.
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
      <div style={{ display: "flex", alignItems: expanded ? "flex-start" : "center", paddingTop: expanded ? "2px" : 0 }}>
        <span style={statusDotStyle(status)} />
      </div>

      <div
        className="mono"
        style={{
          fontSize: "12px",
          color: "var(--color-neutral-500)",
          lineHeight: 1.4,
          whiteSpace: expanded ? "normal" : "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          wordBreak: "break-all",
        }}
      >
        {item.key}
      </div>

      <div
        style={{
          fontSize: "13px",
          color: "var(--color-neutral-200)",
          lineHeight: 1.4,
          whiteSpace: expanded ? "normal" : "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.original}
      </div>

      {expanded ? (
        <textarea
          ref={textareaRef}
          data-role="translation"
          data-key={item.key}
          value={item.translated}
          onChange={(e) => onTranslate(e.target.value)}
          onFocus={onSelect}
          onClick={stop}
          placeholder="Перекласти…"
          aria-label={`Переклад для ${item.key}`}
          style={{
            width: "100%",
            // Floor at the action-stack height so a short translation still
            // fills the default row; the auto-grow effect raises it for longer
            // content, and the row measures taller to match.
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
      ) : (
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
          {item.translated || "Перекласти…"}
        </div>
      )}

      {expanded ? (
        // Expanded: labelled full-width buttons that fill the actions column.
        <div
          onClick={stop}
          style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "stretch" }}
        >
          <button
            type="button"
            style={lookupLabelBtnStyle}
            onClick={onDefinition}
            title={hasDraft ? "Перевірити якість перекладу через Google" : "Скористатися Google для перекладу"}
          >
            <SearchIcon size={14} />
            {hasDraft ? "Перевірити" : "Переклад"}
          </button>
          <button
            type="button"
            style={confirmLabelBtnStyle(item.confirmed, !hasDraft)}
            onClick={onConfirmToggle}
            disabled={!hasDraft}
            title={item.confirmed ? "Зняти підтвердження" : "Підтвердити переклад"}
          >
            <CheckIcon size={14} />
            {item.confirmed ? "Підтверджено" : "Підтвердити"}
          </button>
          <button
            type="button"
            style={copied ? copiedLabelBtnStyle : copyLabelBtnStyle}
            onClick={handleCopyClick}
            title="Копіювати оригінальний текст"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            {copied ? "Скопійовано" : "Копіювати"}
          </button>
        </div>
      ) : (
        // Collapsed: compact icon-only buttons.
        <div onClick={stop} style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
          <button
            type="button"
            style={lookupBtnStyle}
            onClick={onDefinition}
            title={hasDraft ? "Перевірити якість перекладу через Google" : "Скористатися Google для перекладу"}
          >
            <SearchIcon size={13} />
          </button>
          <button
            type="button"
            style={confirmBtnStyle(item.confirmed, !hasDraft)}
            onClick={onConfirmToggle}
            disabled={!hasDraft}
            title={item.confirmed ? "Зняти підтвердження" : "Підтвердити переклад"}
          >
            <CheckIcon size={13} />
          </button>
          <button
            type="button"
            style={copied ? copiedIconBtnStyle : copyBtnStyle}
            onClick={handleCopyClick}
            title={copied ? "Скопійовано" : "Копіювати оригінальний текст"}
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          </button>
        </div>
      )}
    </div>
  );
};

// Height of the vertical action-button stack: 3 × 32px buttons + 2 × 8px gaps.
const ACTION_STACK_HEIGHT = 112;

export const ROW_COLLAPSED = 50;
// Expanded row defaults to exactly the action-button stack height (112) plus
// the row's vertical padding (2 × var(--space-4) ≈ 22.4), so a short
// translation shows no space beyond what the actions need. Longer content
// grows the row past this floor.
export const ROW_EXPANDED = 135;

export default TranslationRow;
