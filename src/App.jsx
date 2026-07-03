import { useState } from "react";
import JSZip from "jszip";
import LangSelectionScreen from "./components/LangSelectionScreen";
import EditorScreen from "./components/EditorScreen";
import WelcomeScreen from "./components/WelcomeScreen";
import ErrorBoundary from "./components/ErrorBoundary";

const App = () => {
  const [screen, setScreen] = useState("welcome"); // welcome, lang-selection, editor
  const [langFiles, setLangFiles] = useState([]);
  const [template, setTemplate] = useState(null);

  const openEditor = (content) => {
    setTemplate(content);
    setScreen("editor");
  };

  const handleFileDrop = async (file) => {
    if (file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target.result);
          openEditor(content);
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          alert("Failed to parse the JSON file. Please ensure it's a valid lang file.");
        }
      };
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
          alert("No language files found in this .jar file.");
        } else if (foundFiles.length === 1) {
          openEditor(foundFiles[0].content);
        } else {
          setLangFiles(foundFiles);
          setScreen("lang-selection");
        }
      } catch (error) {
        console.error("Error reading .jar file:", error);
        alert("Failed to read the .jar file. It might be corrupted or not a valid zip archive.");
      }
    } else {
      alert("Unsupported file type. Please drop a .jar or .json file.");
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
    const jsonString = JSON.stringify(translationObject, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    triggerDownload(blob, "en_us.json");
  };

  const handleExportResourcePack = async (translations) => {
    const translationObject = createTranslationObject(translations);
    if (Object.keys(translationObject).length === 0) {
      alert("No translations to export.");
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
  };

  const renderScreen = () => {
    switch (screen) {
      case "lang-selection":
        return <LangSelectionScreen langFiles={langFiles} onLangSelect={handleLangSelect} />;
      case "editor":
        return template ? (
          <EditorScreen
            template={template}
            onExportJson={handleExportJson}
            onExportResourcePack={handleExportResourcePack}
          />
        ) : null; // Or a loading spinner
      case "welcome":
      default:
        return <WelcomeScreen onFileDrop={handleFileDrop} />;
    }
  };

  return (
    <div className={"movnyk h-full w-full"}>
      <ErrorBoundary>{renderScreen()}</ErrorBoundary>
    </div>
  );
};

export default App;
