import styles from "./LangSelectionScreen.module.css";

const LangSelectionScreen = ({ langFiles, onLangSelect }) => {
  return (
    <div className={styles.langSelectionScreen}>
      <div className={styles.langSelectionContent}>
        <h2>Виберіть мову</h2>
        <p>Виберіть мовний файл, який буде використовуватися як основа для вашого перекладу.</p>
        <div className={styles.langList}>
          {langFiles.map((langFile) => (
            <button key={langFile.name} className={styles.langOption} onClick={() => onLangSelect(langFile.content)}>
              {langFile.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LangSelectionScreen;
