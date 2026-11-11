import { useState } from "react";
import JSZip from "jszip";
import LangSelectionScreen from "./components/LangSelectionScreen";
import EditorScreen from "./components/EditorScreen";
import ExportPackModal from "./components/ExportPackModal";
import WelcomeScreen from "./components/WelcomeScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import { useToast } from "./components/Toast";
import { deleteSession, findResumableSession, loadSessions, newSessionId } from "./lib/sessions";
import { applyNewOriginal, describeOriginalUpdate } from "./lib/originalUpdate";
import { createTranslationObject } from "./lib/exporting";
import { readJar } from "./lib/jar";
import { buildResourcePackFiles, defaultPack, packFileBase, packTitle } from "./lib/resourcePack";

const CLIPBOARD_SESSION_NAME = "З буфера обміну";

const App = () => {
  const [screen, setScreen] = useState("welcome"); // welcome, lang-selection, editor
  const [langFiles, setLangFiles] = useState([]);
  const [sessions, setSessions] = useState(() => loadSessions());
  const [session, setSession] = useState(null); // { id, name, pack } of the open editor
  const [jarMcVersion, setJarMcVersion] = useState(null);
  const [packExportTranslations, setPackExportTranslations] = useState(null); // set while the export dialog is open
  const [initialTranslations, setInitialTranslations] = useState(null);
  const [initialRemovedRows, setInitialRemovedRows] = useState([]);
  const toast = useToast();

  // Reopening a file that already has a session keeps its progress: the saved
  // rows are re-bound to the freshly loaded original, which is a no-op when
  // the file has not changed.
  const openEditor = (content, name, { resumable = true, mcVersion = null } = {}) => {
    const existing = resumable ? findResumableSession(loadSessions(), name, content) : null;
    const { next, removed, stats } = applyNewOriginal(existing?.translations ?? [], content);
    const changedCount = stats.changed + stats.renamed + stats.added + stats.removed;
    if (existing && changedCount > 0) toast(describeOriginalUpdate(stats), "success");
    // A version inferred from the jar wins over the remembered one.
    const pack = {
      ...defaultPack(name, Object.keys(content)),
      ...existing?.pack,
      ...(mcVersion && { mcVersion }),
    };
    setSession({ id: existing?.id ?? newSessionId(), name, pack });
    setInitialTranslations(next);
    setInitialRemovedRows(removed);
    setScreen("editor");
  };

  const handleResume = (saved) => {
    const keys = saved.translations.map((row) => row.key);
    setSession({ id: saved.id, name: saved.name, pack: saved.pack ?? defaultPack(saved.name, keys) });
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
        const { langFiles: foundFiles, mcVersion } = await readJar(file);

        if (foundFiles.length === 0) {
          toast("У цьому файлі .jar не знайдено мовних файлів.", "warning");
        } else if (foundFiles.length === 1) {
          openEditor(foundFiles[0].content, foundFiles[0].sessionName, { mcVersion });
        } else {
          setLangFiles(foundFiles);
          setJarMcVersion(mcVersion);
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
    openEditor(langFile.content, langFile.sessionName, { mcVersion: jarMcVersion });
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
    triggerDownload(blob, `${session.pack.language}.json`);
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

  const handleExportResourcePack = (translations) => {
    if (Object.keys(createTranslationObject(translations)).length === 0) {
      toast("Немає перекладів для експорту.", "warning");
      return;
    }
    setPackExportTranslations(translations);
  };

  const handleConfirmResourcePack = async (pack) => {
    const { files } = buildResourcePackFiles({
      translations: packExportTranslations,
      pack,
      description: `Переклад: ${packTitle(session.name)} (Movnyk)`,
    });
    const zip = new JSZip();
    for (const [path, content] of Object.entries(files)) zip.file(path, content);
    const blob = await zip.generateAsync({ type: "blob" });
    setSession({ ...session, pack });
    setPackExportTranslations(null);
    triggerDownload(blob, `${packFileBase(session.name)}-${pack.language}.zip`);
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
      {packExportTranslations && (
        <ExportPackModal
          pack={session.pack}
          onConfirm={handleConfirmResourcePack}
          onClose={() => setPackExportTranslations(null)}
        />
      )}
    </div>
  );
};

export default App;
