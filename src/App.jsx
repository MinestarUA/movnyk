import { useState } from "react";
import JSZip from "jszip";
import LangSelectionScreen from "./components/LangSelectionScreen";
import EditorScreen from "./components/EditorScreen";
import WelcomeScreen from "./components/WelcomeScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import { useToast } from "./components/Toast";
import { loadAutosave } from "./lib/autosave";

const App = () => {
  const [screen, setScreen] = useState("welcome"); // welcome, lang-selection, editor
  const [langFiles, setLangFiles] = useState([]);
  const [template, setTemplate] = useState(null);
  const [autosave] = useState(() => loadAutosave());
  const [initialTranslations, setInitialTranslations] = useState(null);
  const toast = useToast();

  const openEditor = (content) => {
    setInitialTranslations(null);
    setTemplate(content);
    setScreen("editor");
  };

  const handleResume = () => {
    setTemplate(autosave.template);
    setInitialTranslations(autosave.translations);
    setScreen("editor");
  };

  const handleFileDrop = async (file) => {
    if (!file) return;

    if (file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target.result);
          openEditor(content);
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          toast("Не вдалося обробити файл JSON. Переконайтеся, що це коректний lang-файл.", "error");
        }
      };
      reader.onerror = () => toast("Не вдалося прочитати файл.", "error");
      reader.readAsText(file);
    } else if (file.name.endsWith(".jar")) {
      try {
        const zip = await JSZip.loadAsync(file);
        const foundFiles = [];
        const langFilePromises = [];

        zip.forEach((relativePath, zipEntry) => {
          if (relativePath.match(/assets\/.*\/lang\/.*\.json$/) && !zipEntry.dir) {
            langFilePromises.push(
              zipEntry.async("string").then((content) => {
                try {
                  const jsonContent = JSON.parse(content);
                  foundFiles.push({ name: relativePath, content: jsonContent });
                } catch {
                  console.warn(`Could not parse ${relativePath}, skipping.`);
                }
              })
            );
          }
        });

        await Promise.all(langFilePromises);

        if (foundFiles.length === 0) {
          toast("У цьому файлі .jar не знайдено мовних файлів.", "warning");
        } else if (foundFiles.length === 1) {
          openEditor(foundFiles[0].content);
        } else {
          setLangFiles(foundFiles);
          setScreen("lang-selection");
        }
      } catch (error) {
        console.error("Error reading .jar file:", error);
        toast("Не вдалося прочитати файл .jar. Можливо, він пошкоджений.", "error");
      }
    } else {
      toast("Непідтримуваний тип файлу. Перетягніть файл .jar або .json.", "warning");
    }
  };

  const handleLangSelect = (selectedContent) => {
    openEditor(selectedContent);
  };

  const createTranslationObject = (translations) => {
    return translations.reduce((acc, item) => {
      if (item.translated) {
        // Only include non-empty translations
        acc[item.key] = item.translated;
      }
      return acc;
    }, {});
  };

  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = (translations) => {
    const translationObject = createTranslationObject(translations);
    if (Object.keys(translationObject).length === 0) {
      toast("Немає перекладів для експорту.", "warning");
      return;
    }
    const jsonString = JSON.stringify(translationObject, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    triggerDownload(blob, "en_us.json");
    toast("Файл JSON завантажено.", "success");
  };

  const handleExportResourcePack = async (translations) => {
    const translationObject = createTranslationObject(translations);
    if (Object.keys(translationObject).length === 0) {
      toast("Немає перекладів для експорту.", "warning");
      return;
    }

    const zip = new JSZip();

    const packMeta = {
      pack: {
        pack_format: 9, // For modern Minecraft versions, adjust as needed
        description: "Movnyk Translations",
      },
    };
    zip.file("pack.mcmeta", JSON.stringify(packMeta, null, 2));

    const langContent = JSON.stringify(translationObject, null, 2);
    // Assuming a generic namespace, this could be improved
    zip.file("assets/minecraft/lang/en_us.json", langContent);

    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, "Movnyk_Resource_Pack.zip");
    toast("Ресурспак завантажено.", "success");
  };

  const renderScreen = () => {
    switch (screen) {
      case "lang-selection":
        return <LangSelectionScreen langFiles={langFiles} onLangSelect={handleLangSelect} />;
      case "editor":
        return template ? (
          <EditorScreen
            template={template}
            initialTranslations={initialTranslations}
            onExportJson={handleExportJson}
            onExportResourcePack={handleExportResourcePack}
          />
        ) : null; // Or a loading spinner
      case "welcome":
      default:
        return <WelcomeScreen onFileDrop={handleFileDrop} autosave={autosave} onResume={handleResume} />;
    }
  };

  return (
    <div className={"movnyk h-full w-full"}>
      <ErrorBoundary>{renderScreen()}</ErrorBoundary>
    </div>
  );
};

export default App;
