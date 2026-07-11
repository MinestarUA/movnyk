const shortName = (path) => path.split("/").pop() || path;

const LangSelectionScreen = ({ langFiles, onLangSelect }) => {
  return (
    <div className="flex justify-center items-center min-h-screen bg-base-100 text-base-content p-8 font-sans animate-fade-in-scale">
      <div className="max-w-[600px] w-full text-center bg-base-200 p-12 rounded-[15px] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
        <h2 className="text-[2.5rem] font-bold text-base-content mt-0 mb-4">Виберіть мову</h2>
        <p className="text-[1.1rem] text-base-content/60 mb-8">
          Знайдено мовних файлів: {langFiles.length}. Виберіть той, який буде основою для
          перекладу.
        </p>
        <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {langFiles.map((langFile) => (
            <button
              key={langFile.name}
              className="group flex items-center gap-3 bg-neutral text-base-content rounded-lg py-3 px-5 text-left cursor-pointer transition-all duration-200 border-2 border-transparent hover:brightness-125 hover:border-primary focus:outline-none focus-visible:border-primary"
              onClick={() => onLangSelect(langFile.content)}
            >
              <span className="flex-shrink-0 text-primary text-lg">📄</span>
              <span className="flex flex-col min-w-0">
                <span className="font-semibold truncate">{shortName(langFile.name)}</span>
                <span className="text-xs text-base-content/50 truncate">{langFile.name}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LangSelectionScreen;
