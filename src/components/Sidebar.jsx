import { useRef } from "react";
import { useToast } from "./Toast";

const Sidebar = ({ translatedCount, total, onExportJson, onExportResourcePack, onLoadLang }) => {
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
          const applied = onLoadLang(content);
          if (applied > 0) {
            toast(`Застосовано перекладів: ${applied}.`, "success");
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

  return (
    <aside className="w-[300px] flex-shrink-0 bg-base-200 border-l-2 border-neutral h-screen p-8 flex flex-col shadow-[-5px_0_15px_rgba(0,0,0,0.1)] animate-slide-in-right overflow-y-auto">
      <div className="h-full flex flex-col">
        <h2 className="text-center border-b-2 border-b-neutral text-3xl mb-6 pb-6">Дії</h2>

        <div className="mb-6 rounded-lg bg-base-300 p-4 text-center">
          <div className="text-3xl font-black text-primary tabular-nums">
            {translatedCount}
            <span className="text-base-content/40 text-xl font-semibold"> / {total}</span>
          </div>
          <div className="text-xs uppercase tracking-wide text-base-content/50 mt-1">
            перекладено
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".json,.lang"
          />
          <button className="btn btn-neutral" onClick={handleLoadClick}>
            Приєднати Lang файл
          </button>
          <div className="divider my-1 text-xs text-base-content/40">Експорт</div>
          <button className="btn btn-primary" onClick={onExportJson}>
            Експортувати як JSON
          </button>
          <button className="btn btn-outline btn-primary" onClick={onExportResourcePack}>
            Експортувати як ресурспак
          </button>
        </div>

        <p className="mt-auto pt-6 text-xs text-base-content/40 text-center">
          Порожні переклади не потрапляють до експорту.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
