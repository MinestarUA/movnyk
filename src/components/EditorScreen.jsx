import { useState, useEffect, useRef } from "react";
import { List } from "react-window";
import TranslationRow from "./TranslationRow";
import Sidebar from "./Sidebar";

const EditorScreen = ({ template, onExportJson, onExportResourcePack }) => {
  const [translations, setTranslations] = useState(() =>
    Object.entries(template).map(([key, value]) => ({
      key,
      original: value,
      translated: "",
    }))
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);

  // Effect to scroll to the selected item
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(selectedIndex, "smart");
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : 0));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prevIndex) => (prevIndex < translations.length - 1 ? prevIndex + 1 : prevIndex));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [translations.length]);

  const handleTranslationChange = (index, newValue) => {
    const newTranslations = [...translations];
    newTranslations[index].translated = newValue;
    setTranslations(newTranslations);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleDefinition = (text) => {
    let input = "Переклади цей текст:\n" + text;

    window.open(`https://www.google.com/search?q=${encodeURIComponent(input)}&udm=50`, "_blank");
  };

  const handleLoadLangFile = (loadedTranslations) => {
    const newTranslations = translations.map((t) => {
      if (loadedTranslations[t.key]) {
        return { ...t, translated: loadedTranslations[t.key] };
      }
      return t;
    });
    setTranslations(newTranslations);
  };

  return (
    <div className="relative flex text-base-content overflow-hidden animate-fade-in">
      <div className="absolute top-0 left-[30px] bg-black/70 text-white py-[10px] px-[15px] rounded-lg text-sm z-[1000] pointer-events-none animate-slide-in-left">
        <p>Для навігації використовуйте клавіші зі стрілками ↑ і ↓</p>
      </div>
      <main className="flex-grow py-12 px-8 overflow-y-auto flex flex-col gap-4 items-center">
        <List
          itemRef={listRef}
          rowComponent={Row}
          rowCount={translations.length}
          rowHeight={130}
          style={{
            width: "100%",
            maxHeight: "90vh",
          }}
          rowProps={{
            translations,
            selectedIndex,
            handleTranslationChange,
            handleCopy,
            handleDefinition,
          }}
        />
      </main>
      <Sidebar
        onExportJson={() => onExportJson(translations)}
        onExportResourcePack={() => onExportResourcePack(translations)}
        onLoadLang={handleLoadLangFile}
      />
    </div>
  );
};

const Row = ({
  index,
  style,
  translations,
  selectedIndex,
  handleTranslationChange,
  handleCopy,
  handleDefinition,
}) => {
  const item = translations[index];

  console.log(style);

  return (
    <TranslationRow
      rowStyle={style}
      item={item}
      isSelected={index === selectedIndex}
      onTranslate={(newValue) => handleTranslationChange(index, newValue)}
      onCopy={() => handleCopy(item.original)}
      onDefinition={() => handleDefinition(item.original)}
    />
  );
};

export default EditorScreen;
