const CloseButton = ({ onClick, label = "Закрити" }) => (
  <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClick} aria-label={label} title={label}>
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  </button>
);

export default CloseButton;
