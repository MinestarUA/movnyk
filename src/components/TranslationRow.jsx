import { useRef, useEffect } from "react";

const TranslationRow = ({ rowStyle, item, isSelected, onTranslate, onCopy, onDefinition }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isSelected) {
      textareaRef.current?.focus();
    }
  }, [isSelected]);

  return (
    <div
      className={`flex items-stretch w-[300px] h-[130px] bg-base-300 border-2 rounded-xl overflow-hidden transition-all duration-300 ease-out ${
        isSelected ? "border-primary" : "border-neutral"
      }`}
      style={rowStyle}
    >
      <div className="px-6 py-2 flex flex-col justify-center flex-[1.5] bg-base-200 font-mono text-base-content/60 border-r-2 border-neutral">
        <span className="text-xs font-bold text-base-content/50 mb-2 uppercase">Ключ</span>
        <span className="text-base break-all">{item.key}</span>
      </div>
      <div className="px-6 py-2 flex flex-col justify-center flex-[2] border-r-2 border-neutral">
        <span className="text-xs font-bold text-base-content/50 mb-2 uppercase">Оригінал</span>
        <textarea
          className="textarea textarea-bordered h-full leading-[1.2] text-base text-base-content break-all"
          value={item.original}
          editable={false}
        />
      </div>
      <div className="px-6 py-2 flex flex-col justify-center flex-[2]">
        <span className="text-xs font-bold text-base-content/50 mb-2 uppercase">Переклад</span>
        <textarea
          ref={textareaRef}
          className="textarea textarea-bordered h-full leading-[1.2] text-base text-base-content break-all"
          value={item.translated}
          onChange={(e) => onTranslate(e.target.value)}
          placeholder="Перекласти..."
        />
      </div>
      <div className="flex flex-col justify-center gap-2 p-4 bg-base-200 border-l-2 border-neutral">
        <button className="btn btn-neutral" onClick={onDefinition} title="Скористатися Google для перекладу">
          Переклад
        </button>
        <button className="btn btn-neutral" onClick={onCopy} title="Копіювати оригінальний текст">
          Копіювати
        </button>
      </div>
    </div>
  );
};

export default TranslationRow;
