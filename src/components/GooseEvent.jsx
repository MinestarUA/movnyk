// A goose dashes across the screen with a stolen row; clicking it (or the banner
// button) gets the row back. The row also returns by itself, see useGooseEvent.
export default function GooseEvent({ stolenKey, onReturn }) {
  return (
    <>
      <button
        type="button"
        className="goose-run"
        onClick={onReturn}
        aria-label="Піймати гусака"
        title="Піймай мене!"
      >
        <span className="goose-honk">ГА-ГА!</span>
        <span className="goose-body">🪿</span>
      </button>
      <div className="goose-banner" role="status">
        <span>
          🪿 Гусак поцупив рядок <code className="mono">{stolenKey}</code>
        </span>
        <button type="button" className="goose-banner-button" onClick={onReturn}>
          Відібрати
        </button>
      </div>
    </>
  );
}
