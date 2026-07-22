import { useRef, useState } from "react";

const FEATURES = [
  {
    title: "Простий у використанні",
    text: "Просто завантажте файл і починайте переклад. Налаштування не потрібні.",
  },
  {
    title: "Ефективний робочий процес",
    text: "Швидко переходьте між перекладами та редагуйте їх за допомогою комбінацій клавіш.",
  },
  {
    title: "Гнучкий експорт",
    text: "Експортуйте свою роботу у вигляді простого файлу JSON або ресурспаку.",
  },
];

const WelcomeScreen = ({ onFileDrop, autosave, onResume }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileDrop(e.target.files[0]);
    }
    e.target.value = null;
  };

  return (
    <div className="flex justify-center items-center min-h-screen text-base-content text-center font-sans p-8">
      <div className="max-w-[800px] w-full">
        <h1 className="text-6xl font-black text-base-content mb-2 animate-slide-in-top">Мовник</h1>
        <p className="text-xl mb-10 text-base-content/60 animate-slide-in-top [animation-delay:0.2s]">
          Інструмент для перекладу модифікацій Minecraft.
        </p>
        <button
          type="button"
          onClick={openFilePicker}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Завантажити файл .jar або .json"
          className={`w-full block border-[3px] border-dashed rounded-[15px] px-8 py-16 cursor-pointer transition-all duration-300 ease-in-out animate-scale-in-center [animation-delay:0.4s] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isDragging
              ? "border-primary bg-base-300 scale-[1.02]"
              : "border-neutral bg-base-200 hover:bg-base-300 hover:border-primary hover:scale-[1.02]"
          }`}
        >
          <svg
            className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragging ? "text-primary" : "text-base-content/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9m0 0L8.25 12.75M12 9l3.75 3.75" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15.75V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-2.25" />
          </svg>
          <p className="m-0 text-xl font-medium text-base-content/70">
            {isDragging ? "Відпустіть файл тут" : "Перетягніть сюди файл .jar або .json"}
          </p>
          <p className="m-0 mt-2 text-sm text-base-content/40">або натисніть, щоб обрати файл</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jar,.json"
          className="hidden"
          onChange={handleFileChange}
        />
        {autosave && (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-[10px] border-2 border-primary/40 bg-base-200 p-4 text-left animate-fade-in">
            <div>
              <p className="m-0 font-semibold">Є незавершена сесія</p>
              <p className="m-0 mt-1 text-sm text-base-content/60">
                Підтверджено {autosave.translations.filter((t) => t.confirmed).length} /{" "}
                {autosave.translations.length} · збережено{" "}
                {new Date(autosave.savedAt).toLocaleString("uk-UA")}
              </p>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={onResume}>
              Продовжити
            </button>
          </div>
        )}
        <div className="flex justify-around mt-12 gap-6 flex-wrap">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className="flex-1 min-w-[200px] p-6 bg-base-200 rounded-[10px] transition-all duration-300 ease-in-out hover:-translate-y-2 hover:shadow-[0_12px_24px_rgba(0,0,0,0.25)] animate-slide-in-bottom"
              style={{ animationDelay: `${0.6 + index * 0.1}s` }}
            >
              <h3 className="text-2xl text-base-content mt-0 mb-4">{feature.title}</h3>
              <p className="text-base text-base-content/60 mb-0 leading-[1.5]">{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
