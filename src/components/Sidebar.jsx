import { useRef } from "react";
import { useToast } from "./Toast";
import { hasApiKey } from "../lib/settings";

const Sidebar = ({
  open = true,
  confirmedCount,
  total,
  onExportJson,
  onExportResourcePack,
  onLoadLang,
  skipIdentical,
  onSkipIdenticalChange,
  confirmImport,
  onConfirmImportChange,
  settings,
  onOpenSettings,
  onAutoTranslate,
  onCancelAutoTranslate,
  aiState,
}) => {
  const fileInputRef = useRef(null);
  const toast = useToast();

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target.result);
          const { applied, skipped } = onLoadLang(content);
          if (applied > 0) {
            toast(
              `Застосовано перекладів: ${applied}.` +
                (skipped > 0 ? ` Пропущено (збіг з оригіналом): ${skipped}.` : ""),
              "success"
            );
          } else if (skipped > 0) {
            toast("Усі збіги пропущено — переклади дублюють оригінал.", "warning");
          } else {
            toast("Жоден ключ із цього файлу не збігся з поточним проєктом.", "warning");
          }
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          toast("Не вдалося обробити файл. Переконайтеся, що це коректний JSON.", "error");
        }
      };
      reader.onerror = () => toast("Не вдалося прочитати файл.", "error");
      reader.readAsText(file);
    }
    // Reset file input to allow loading the same file again
    e.target.value = null;
  };

  const keyReady = hasApiKey(settings);
  const running = aiState?.running;
  const aiProgress = running && aiState.total ? Math.round((aiState.done / aiState.total) * 100) : 0;

  const dividerStyle = {
    height: "1px",
    background:
      "linear-gradient(to right, transparent, var(--color-divider) 20%, var(--color-divider) 80%, transparent)",
  };
  const sectionLabelStyle = {
    fontSize: "10.5px",
    letterSpacing: "0.08em",
    color: "var(--color-neutral-600)",
    textTransform: "uppercase",
  };
  const outlineBtnStyle = {
    height: "32px",
    borderRadius: "var(--radius-md)",
    background: "transparent",
    border: "1px solid var(--color-divider)",
    color: "var(--color-text)",
    fontFamily: "var(--font-heading)",
    fontWeight: 500,
    fontSize: "12.5px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  };
  const exportBtnStyle = (filled) => ({
    height: "32px",
    borderRadius: "var(--radius-md)",
    background: filled ? "rgba(255,95,162,0.14)" : "transparent",
    border: "1px solid rgba(255,95,162,0.4)",
    color: "#ff9dc6",
    fontFamily: "var(--font-heading)",
    fontWeight: 600,
    fontSize: "12.5px",
    cursor: "pointer",
  });

  return (
    <aside
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: "260px",
        background: "color-mix(in srgb, var(--color-surface) 72%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderLeft: "1px solid var(--color-divider)",
        boxShadow: "-8px 0 24px rgba(0,0,0,0.35)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.2s ease",
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: "260px",
          padding: "var(--space-4) var(--space-4) var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          height: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 500, fontSize: "16px" }}>Дії</div>
          <button
            onClick={onOpenSettings}
            title="Налаштування"
            aria-label="Налаштування"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-md)",
              background: "transparent",
              border: "1px solid var(--color-divider)",
              color: "var(--color-neutral-400)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "var(--space-3) 0" }}>
          <div style={{ fontSize: "26px", fontWeight: 700, fontFamily: "var(--font-heading)", lineHeight: 1.1 }}>
            {confirmedCount}{" "}
            <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-neutral-500)" }}>/ {total}</span>
          </div>
          <div style={{ fontSize: "10.5px", letterSpacing: "0.08em", color: "var(--color-neutral-500)", textTransform: "uppercase" }}>
            Підтверджено
          </div>
        </div>

        {keyReady &&
          (running ? (
            <div style={{ borderRadius: "var(--radius-md)", border: "1px solid rgba(255,95,162,0.4)", background: "var(--color-bg)", padding: "var(--space-4)" }}>
              <div className="flex items-center gap-2" style={{ fontSize: "13px", fontWeight: 600 }}>
                <span className="loading loading-spinner loading-sm" style={{ color: "var(--accent-pink)" }} />
                Перекладаю з Gemini…
              </div>
              <div style={{ height: "5px", borderRadius: "3px", background: "var(--color-neutral-800)", overflow: "hidden", marginTop: "10px" }}>
                <div style={{ height: "100%", width: `${aiProgress}%`, background: "linear-gradient(90deg,#ff5fa2,#c860e8)", borderRadius: "3px", transition: "width 0.2s ease" }} />
              </div>
              <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--color-neutral-500)", fontVariantNumeric: "tabular-nums" }}>
                {aiState.done} / {aiState.total} ({aiProgress}%)
              </div>
              <button
                onClick={onCancelAutoTranslate}
                style={{ width: "100%", height: "32px", marginTop: "10px", borderRadius: "var(--radius-md)", background: "transparent", border: "1px solid var(--color-error, #ff5f6d)", color: "var(--color-error, #ff5f6d)", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: "12.5px", cursor: "pointer" }}
              >
                Скасувати
              </button>
            </div>
          ) : (
            <button
              onClick={onAutoTranslate}
              style={{
                height: "36px",
                borderRadius: "var(--radius-md)",
                background: "var(--accent-gradient)",
                border: "none",
                color: "#fff",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
              Автопереклад з Gemini
            </button>
          ))}

        <div style={dividerStyle} />

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={sectionLabelStyle}>Файли</div>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".json,.lang" />
          <button style={{ ...outlineBtnStyle, opacity: running ? 0.5 : 1, cursor: running ? "not-allowed" : "pointer" }} onClick={handleLoadClick} disabled={running}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="M7 8l5-5 5 5" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Приєднати Lang файл
          </button>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", color: "var(--color-neutral-400)", cursor: "pointer", lineHeight: 1.4 }}>
            <input
              type="checkbox"
              checked={skipIdentical}
              onChange={(e) => onSkipIdenticalChange(e.target.checked)}
              style={{ accentColor: "var(--color-accent)", width: "13px", height: "13px", marginTop: "2px", flexShrink: 0 }}
            />
            Пропускати переклади, що збігаються з оригіналом
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12px", color: "var(--color-neutral-400)", cursor: "pointer", lineHeight: 1.4 }}>
            <input
              type="checkbox"
              checked={confirmImport}
              onChange={(e) => onConfirmImportChange(e.target.checked)}
              style={{ accentColor: "var(--color-accent)", width: "13px", height: "13px", marginTop: "2px", flexShrink: 0 }}
            />
            Позначати імпортовані рядки як підтверджені
          </label>
        </div>

        <div style={dividerStyle} />

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={sectionLabelStyle}>Експорт</div>
          <button style={exportBtnStyle(true)} onClick={onExportJson}>
            Експортувати як JSON
          </button>
          <button style={exportBtnStyle(false)} onClick={onExportResourcePack}>
            Експортувати як ресурспак
          </button>
        </div>

        {!keyReady && (
          <button
            onClick={onOpenSettings}
            style={{ fontSize: "12px", color: "var(--color-neutral-500)", textDecoration: "underline dotted", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
          >
            Додайте ключ Gemini API, щоб перекладати автоматично
          </button>
        )}

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: "10.5px", color: "var(--color-neutral-600)", lineHeight: 1.5 }}>
          Порожні переклади не потрапляють до експорту.
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
