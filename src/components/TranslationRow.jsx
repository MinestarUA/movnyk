import { useRef, useEffect } from "react";
import styles from "./TranslationRow.module.css";

const TranslationRow = ({ rowStyle, item, isSelected, onTranslate, onCopy, onDefinition }) => {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isSelected) {
      textareaRef.current?.focus();
    }
  }, [isSelected]);

  return (
    <div className={`${styles.translationRow} ${isSelected ? styles.selected : ""}`} style={rowStyle}>
      <div className={`${styles.translationField} ${styles.key}`}>
        <span className={styles.fieldLabel}>Ключ</span>
        <span className={styles.fieldValue}>{item.key}</span>
      </div>
      <div className={`${styles.translationField} ${styles.editable} ${styles.original}`}>
        <span className={styles.fieldLabel}>Оригінал</span>
        <textarea
        className={styles.fieldValue}
        value={item.original}
        editable={false}
        />
      </div>
      <div className={`${styles.translationField} ${styles.editable}`}>
        <span className={styles.fieldLabel}>Переклад</span>
        <textarea
          ref={textareaRef}
          value={item.translated}
          onChange={(e) => onTranslate(e.target.value)}
          placeholder="Перекласти..."
        />
      </div>
      <div className={styles.rowActions}>
        <button onClick={onDefinition} title="Скористатися Google для перекладу">
          Переклад
        </button>
        <button onClick={onCopy} title="Копіювати оригінальний текст">
          Копіювати
        </button>
      </div>
    </div>
  );
};

export default TranslationRow;
