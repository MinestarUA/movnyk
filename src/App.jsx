import { useState } from "react";
import JSZip from "jszip";
import LangSelectionScreen from "./components/LangSelectionScreen";
import EditorScreen from "./components/EditorScreen";
import WelcomeScreen from "./components/WelcomeScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import { useToast } from "./components/Toast";
import { deleteSession, findResumableSession, loadSessions, newSessionId } from "./lib/sessions";
import { applyNewOriginal, describeOriginalUpdate } from "./lib/originalUpdate";
import { createTranslationObject } from "./lib/exporting";

const CLIPBOARD_SESSION_NAME = "З буфера обміну";

const App = () => {
  const [screen, setScreen] = useState("welcome"); // welcome, lang-selection, editor
  const [langFiles, setLangFiles] = useState([]);
  const [sessions, setSessions] = useState(() => loadSessions());
  const [session, setSession] = useState(null); // { id, name } of the open editor
  const [initialTranslations, setInitialTranslations] = useState(null);
  const [initialRemovedRows, setInitialRemovedRows] = useState([]);
  const toast = useToast();

  // Reopening a file that already has a session keeps its progress: the saved
  // rows are re-bound to the freshly loaded original, which is a no-op when
  // the file has not changed.
  const openEditor = (content, name, { resumable = true } = {}) => {
    const existing = resumable ? findResumableSession(loadSessions(), name, content) : null;
    const { next, removed, stats } = applyNewOriginal(existing?.translations ?? [], content);
    const changedCount = stats.changed + stats.renamed + stats.added + stats.removed;
    if (existing && changedCount > 0) toast(describeOriginalUpdate(stats), "success");
    setSession({ id: existing?.id ?? newSessionId(), name });
    setInitialTranslations(next);
    setInitialRemovedRows(removed);
    setScreen("editor");
  };

  const handleResume = (saved) => {
    setSession({ id: saved.id, name: saved.name });
    setInitialTranslations(saved.translations);
    setInitialRemovedRows([]);
    setScreen("editor");
  };

  const handleDeleteSession = (id) => {
    deleteSession(id);
    setSessions(loadSessions());
  };

  const handleHome = () => {
    setSessions(loadSessions());
    setScreen("welcome");
  };

  const handleFileDrop = async (file) => {
    if (!file) return;

    if (file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target.result);
          openEditor(content, file.name);
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
                  foundFiles.push({
                    name: relativePath,
                    sessionName: `${file.name} · ${relativePath}`,
                    content: jsonContent,
                  });
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
          openEditor(foundFiles[0].content, foundFiles[0].sessionName);
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

  const handleLangSelect = (langFile) => {
    openEditor(langFile.content, langFile.sessionName);
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

  const handleExportClipboard = async (translations) => {
    const translationObject = createTranslationObject(translations);
    if (Object.keys(translationObject).length === 0) {
      toast("Немає перекладів для експорту.", "warning");
      return;
    }
    const jsonString = JSON.stringify(translationObject, null, 2);
    try {
      await navigator.clipboard.writeText(jsonString);
      toast("JSON скопійовано до буфера обміну.", "success");
    } catch (error) {
      console.error("Clipboard write failed:", error);
      toast("Не вдалося скопіювати до буфера обміну.", "error");
    }
  };

  const handlePasteClipboard = async () => {
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (error) {
      console.error("Clipboard read failed:", error);
      toast("Не вдалося прочитати буфер обміну. Дозвольте доступ до буфера обміну.", "error");
      return;
    }
    if (!text || !text.trim()) {
      toast("Буфер обміну порожній.", "warning");
      return;
    }
    try {
      const content = JSON.parse(text);
      if (typeof content !== "object" || content === null || Array.isArray(content)) {
        toast("Вміст буфера обміну не є коректним lang-файлом JSON.", "error");
        return;
      }
      openEditor(content, CLIPBOARD_SESSION_NAME, { resumable: false });
    } catch (error) {
      console.error("Error parsing clipboard JSON:", error);
      toast("Не вдалося обробити вміст буфера обміну. Переконайтеся, що це коректний JSON.", "error");
    }
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
        return initialTranslations ? (
          <EditorScreen
            initialTranslations={initialTranslations}
            initialRemovedRows={initialRemovedRows}
            session={session}
            onExportJson={handleExportJson}
            onExportResourcePack={handleExportResourcePack}
            onExportClipboard={handleExportClipboard}
            onHome={handleHome}
          />
        ) : null; // Or a loading spinner
      case "welcome":
      default:
        return (
          <WelcomeScreen
            onFileDrop={handleFileDrop}
            onPasteClipboard={handlePasteClipboard}
            sessions={sessions}
            onResume={handleResume}
            onDeleteSession={handleDeleteSession}
          />
        );
    }
  };

  return (
    <div className={"movnyk h-full w-full"}>
      <ErrorBoundary>{renderScreen()}</ErrorBoundary>
    </div>
  );
};

export default App;
