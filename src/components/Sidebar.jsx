import { useRef } from "react";
import styles from "./Sidebar.module.css";

const Sidebar = ({ onExportJson, onExportResourcePack, onLoadLang }) => {
  const fileInputRef = useRef(null);

  const handleLoadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target.result);
          onLoadLang(content);
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          // Here you could add a user-facing error message.
        }
      };
      reader.readAsText(file);
    }
    // Reset file input to allow loading the same file again
    e.target.value = null;
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        <h2>Дії</h2>
        <div className={styles.sidebarActions}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept=".json,.lang"
          />
          <button onClick={handleLoadClick}>Приєднати Lang файл</button>
          <button onClick={onExportJson}>Експортувати як JSON</button>
          <button onClick={onExportResourcePack}>Експортувати як ресурспак</button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
