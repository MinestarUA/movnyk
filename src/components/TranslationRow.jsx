import { useRef, useEffect } from "react";

const TranslationRow = ({
  rowStyle,
  item,
  isSelected,
  focusRequestRef,
  onSelect,
  onTranslate,
  onCopy,
  onDefinition,
}) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    // Focus only when the selection was driven by keyboard navigation, so
    // filtering/searching never yanks the caret out of another field.
    if (isSelected && focusRequestRef?.current) {
      textareaRef.current?.focus();
      focusRequestRef.current = false;
    }
  }, [isSelected, focusRequestRef]);

  const isTranslated = Boolean(item.translated.trim());

  return (
    <div style={rowStyle} className="px-1">
      <div
        onClick={onSelect}
        className={`flex items-stretch h-[134px] bg-base-300 border-2 rounded-xl overflow-hidden transition-colors duration-200 ${
          isSelected
            ? "border-primary ring-1 ring-primary"
            : isTranslated
              ? "border-success/40"
              : "border-neutral"
        }`}
      >
        <div className="px-5 py-2 flex flex-col justify-center flex-[1.5] bg-base-200 font-mono text-base-content/60 border-r-2 border-neutral">
          <span className="text-xs font-bold text-base-content/50 mb-2 uppercase flex items-center gap-1">
            Ключ
            {isTranslated && (
              <span className="text-success" title="Перекладено" aria-label="Перекладено">
                ✓
              </span>
            )}
          </span>
          <span className="text-sm break-all">{item.key}</span>
        </div>
        <div className="px-5 py-2 flex flex-col justify-center flex-[2] border-r-2 border-neutral">
          <span className="text-xs font-bold text-base-content/50 mb-2 uppercase">Оригінал</span>
          <textarea
            className="textarea textarea-bordered h-full leading-[1.2] text-base text-base-content/80 break-all resize-none bg-base-200/50"
            value={item.original}
            readOnly
            aria-label="Оригінальний текст"
          />
        </div>
        <div className="px-5 py-2 flex flex-col justify-center flex-[2]">
          <span className="text-xs font-bold text-base-content/50 mb-2 uppercase">Переклад</span>
          <textarea
            ref={textareaRef}
            data-role="translation"
            className="textarea textarea-bordered h-full leading-[1.2] text-base text-base-content break-all resize-none"
            value={item.translated}
            onChange={(e) => onTranslate(e.target.value)}
            onFocus={onSelect}
            placeholder="Перекласти…"
            aria-label={`Переклад для ${item.key}`}
          />
        </div>
        <div className="flex flex-col justify-center gap-2 p-3 bg-base-200 border-l-2 border-neutral">
          <button
            className="btn btn-neutral btn-sm"
            onClick={onDefinition}
            title="Скористатися Google для перекладу"
          >
            Переклад
          </button>
          <button
            className="btn btn-neutral btn-sm"
            onClick={onCopy}
            title="Копіювати оригінальний текст"
          >
            Копіювати
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranslationRow;
