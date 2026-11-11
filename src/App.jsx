import { useEffect, useState } from "react";
import JSZip from "jszip";
import LangSelectionScreen from "./components/LangSelectionScreen";
import EditorScreen from "./components/EditorScreen";
import ExportPackModal from "./components/ExportPackModal";
import WelcomeScreen from "./components/WelcomeScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import { useToast } from "./components/Toast";
import { deleteSession, loadSessions, newSessionId } from "./lib/sessions";
import { describeOriginalUpdate } from "./lib/originalUpdate";
import { openSessionRows } from "./lib/openSession";
import { createTranslationObject } from "./lib/exporting";
import { readJar } from "./lib/jar";
import { loadBookSources, pruneBookSources, saveBookSources } from "./lib/bookSources";
import {
  bookSourcesWarning,
  buildResourcePackFiles,
  defaultPack,
  packFileBase,
  packTitle,
} from "./lib/resourcePack";

const CLIPBOARD_SESSION_NAME = "З буфера обміну";

const App = () => {
  const [screen, setScreen] = useState("welcome"); // welcome, lang-selection, editor
  const [langFiles, setLangFiles] = useState([]);
  const [sessions, setSessions] = useState(() => loadSessions());
  const [session, setSession] = useState(null); // { id, name, pack, books } of the open editor
  const [jar, setJar] = useState(null); // { mcVersion, books, bookFiles, bookJson, guideUnits } of a jar waiting for a lang file choice
  const [bookSources, setBookSources] = useState(null); // raw book files of the open session; null when unavailable
  const [packExport, setPackExport] = useState(null); // { translations, sources, summary } while the export dialog is open
  const [initialTranslations, setInitialTranslations] = useState(null);
  const [initialRemovedRows, setInitialRemovedRows] = useState([]);
  const toast = useToast();

  useEffect(() => {
    pruneBookSources(loadSessions().map(({ id }) => id));
  }, []);

  const openEditor = (
    content,
    name,
    { resumable = true, mcVersion = null, books = [], bookFiles = null, bookJson = {}, guideUnits = {} } = {}
  ) => {
    const {
      existing,
      next,
      removed,
      stats,
      books: sessionBooks,
    } = openSessionRows({
      savedSessions: loadSessions(),
      name,
      content,
      resumable,
      books,
      bookJson,
      guideUnits,
    });
    const changedCount = stats.changed + stats.renamed + stats.added + stats.removed;
    if (existing && changedCount > 0) toast(describeOriginalUpdate(stats), "success");
    // A version inferred from the jar wins over the remembered one.
    const pack = {
      ...defaultPack(name, Object.keys(content)),
      ...existing?.pack,
      ...(mcVersion && { mcVersion }),
    };
    const id = existing?.id ?? newSessionId();
    setSession({ id, name, pack, books: sessionBooks.map(({ root, name }) => ({ root, name })) });
    setBookSources(sessionBooks.length > 0 ? bookFiles : null);
    if (sessionBooks.length > 0) {
      saveBookSources(id, bookFiles).then((saved) => {
        if (!saved) {
          toast(
            "Не вдалося зберегти файли книги в браузері. Для експорту книги після перезавантаження знову перетягніть .jar.",
            "warning"
          );
        }
      });
      const summary = sessionBooks.map((book) => `«${book.name}» (рядків: ${book.rowCount})`).join(", ");
      toast(`Додано книги: ${summary}.`, "success");
    }
    setInitialTranslations(next);
    setInitialRemovedRows(removed);
    setScreen("editor");
  };

  const handleResume = (saved) => {
    const keys = saved.translations.map((row) => row.key);
    setSession({
      id: saved.id,
      name: saved.name,
      pack: saved.pack ?? defaultPack(saved.name, keys),
      books: saved.books ?? [],
    });
    setBookSources(null);
    setInitialTranslations(saved.translations);
    setInitialRemovedRows([]);
    setScreen("editor");
  };

  const handleDeleteSession = (id) => {
    deleteSession(id);
    const remaining = loadSessions();
    setSessions(remaining);
    pruneBookSources(remaining.map((remainingSession) => remainingSession.id));
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
        const {
          langFiles: foundFiles,
          mcVersion,
          books,
          unsupportedBooks,
          bookFiles,
          bookJson,
          guideUnits,
          skippedGuidePages,
        } = await readJar(file);
        for (const id of unsupportedBooks) {
          toast(
            `Книга «${id}» зберігається в data/ (Minecraft до 1.20), тому ресурспак не може її перекласти.`,
            "info"
          );
        }

        if (skippedGuidePages > 0) {
          toast(`Не вдалося розібрати сторінок посібника: ${skippedGuidePages} — їх пропущено.`, "warning");
        }

        if (foundFiles.length === 0 && books.length === 0) {
          toast("У цьому файлі .jar не знайдено мовних файлів.", "warning");
        } else if (foundFiles.length <= 1) {
          // A jar may carry only a guidebook, with no lang file of its own.
          const [langFile] = foundFiles;
          openEditor(langFile?.content ?? {}, langFile?.sessionName ?? file.name, {
            mcVersion,
            books,
            bookFiles,
            bookJson,
            guideUnits,
          });
        } else {
          setLangFiles(foundFiles);
          setJar({ mcVersion, books, bookFiles, bookJson, guideUnits });
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
    openEditor(langFile.content, langFile.sessionName, jar);
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

  const buildPackFiles = ({ translations, sources }, pack) =>
    buildResourcePackFiles({
      translations,
      pack,
      description: `Переклад: ${packTitle(session.name)} (Movnyk)`,
      bookSources: sources,
    });

  const handleExportResourcePack = async (translations) => {
    const sources = bookSources ?? (session.books.length > 0 ? await loadBookSources(session.id) : null);
    const { files, ...summary } = buildPackFiles({ translations, sources }, session.pack);
    if (Object.keys(files).every((path) => path === "pack.mcmeta")) {
      toast(bookSourcesWarning(summary) ?? "Немає перекладів для експорту.", "warning");
      return;
    }
    setPackExport({ translations, sources, summary });
  };

  const handleConfirmResourcePack = async (pack) => {
    const { files } = buildPackFiles(packExport, pack);
    const zip = new JSZip();
    for (const [path, content] of Object.entries(files)) zip.file(path, content);
    let blob;
    try {
      blob = await zip.generateAsync({ type: "blob" });
    } catch (error) {
      console.error("Resource pack generation failed:", error);
      toast("Не вдалося створити ресурспак.", "error");
      return;
    }
    setSession({ ...session, pack });
    setPackExport(null);
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
            modalOpen={packExport !== null}
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
      {packExport && (
        <ExportPackModal
          pack={session.pack}
          summary={packExport.summary}
          onConfirm={handleConfirmResourcePack}
          onClose={() => setPackExport(null)}
        />
      )}
    </div>
  );
};

export default App;
