const LangSelectionScreen = ({ langFiles, onLangSelect }) => {
  return (
    <div className="flex justify-center items-center min-h-screen bg-base-100 text-base-content p-8 font-sans animate-fade-in-scale">
      <div className="max-w-[600px] w-full text-center bg-base-200 p-12 rounded-[15px] shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
        <h2 className="text-[2.5rem] font-bold text-base-content mt-0 mb-4">Виберіть мову</h2>
        <p className="text-[1.1rem] text-base-content/60 mb-10">
          Виберіть мовний файл, який буде використовуватися як основа для вашого перекладу.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {langFiles.map((langFile) => (
            <button
              key={langFile.name}
              className="bg-neutral text-base-content rounded-lg py-[0.8rem] px-6 text-base font-medium cursor-pointer transition-all duration-300 border-2 border-transparent hover:brightness-125 hover:-translate-y-[3px] hover:shadow-[0_6px_12px_rgba(0,0,0,0.2)] hover:border-accent active:-translate-y-[1px] active:shadow-[0_3px_6px_rgba(0,0,0,0.2)]"
              onClick={() => onLangSelect(langFile.content)}
            >
              {langFile.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LangSelectionScreen;
