import { useRef } from "react";

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
    <aside className="w-[300px] flex-shrink-0 bg-base-200 border-2 border-neutral rounded-xl h-fit p-8 flex flex-col shadow-[-5px_0_15px_rgba(0,0,0,0.1)] animate-slide-in-right">
      <div className="h-full flex flex-col">
        <h2 className="text-center border-b-2 border-b-neutral text-3xl mb-6 pb-6">Дії</h2>
        <div className="flex flex-col gap-4">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            accept=".json,.lang"
          />
          <button className="btn btn-neutral" onClick={handleLoadClick}>
            Приєднати Lang файл
          </button>
          <button className="btn btn-neutral" onClick={onExportJson}>
            Експортувати як JSON
          </button>
          <button className="btn btn-neutral" onClick={onExportResourcePack}>
            Експортувати як ресурспак
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
