import styles from "./WelcomeScreen.module.css";

const WelcomeScreen = ({ onFileDrop }) => {
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={styles.welcomeScreen}>
      <div className={styles.welcomeContent}>
        <h1>Мовник</h1>
        <p>Інструмент для перекладу модифікацій Minecraft.</p>
        <div className={styles.dropZone} onDragOver={handleDragOver} onDrop={handleDrop}>
          <p>Перетягніть сюди файл .jar або .json</p>
        </div>
        <div className={styles.features}>
          <div className={styles.feature}>
            <h3>Простий у використанні</h3>
            <p>Просто завантажте файл і починайте переклад. Налаштування не потрібні.</p>
          </div>
          <div className={styles.feature}>
            <h3>Ефективний робочий процес</h3>
            <p>Швидко переходьте між перекладами та редагуйте їх за допомогою комбінацій клавіш.</p>
          </div>
          <div className={styles.feature}>
            <h3>Гнучкий експорт</h3>
            <p>Експортуйте свою роботу у вигляді простого файлу JSON або ресурспаку.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
