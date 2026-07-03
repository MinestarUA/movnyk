const WelcomeScreen = ({ onFileDrop }) => {
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen text-base-content text-center font-sans p-8">
      <div className="max-w-[800px] w-full">
        <h1 className="text-6xl font-black text-base-content mb-2 animate-slide-in-top">Мовник</h1>
        <p className="text-xl mb-10 text-base-content/60 animate-slide-in-top [animation-delay:0.2s]">
          Інструмент для перекладу модифікацій Minecraft.
        </p>
        <div
          className="border-[3px] border-dashed border-neutral rounded-[15px] px-8 py-16 cursor-pointer transition-all duration-300 ease-in-out bg-base-200 hover:bg-base-300 hover:border-primary hover:scale-[1.02] animate-scale-in-center [animation-delay:0.4s]"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <p className="m-0 text-xl font-medium text-base-content/60">Перетягніть сюди файл .jar або .json</p>
        </div>
        <div className="flex justify-around mt-12 gap-6 flex-wrap">
          <div className="flex-1 min-w-[200px] p-6 bg-base-200 rounded-[10px] transition-all duration-300 ease-in-out hover:-translate-y-2 hover:shadow-[0_12px_24px_rgba(0,0,0,0.25)] animate-slide-in-bottom [animation-delay:0.6s]">
            <h3 className="text-2xl text-base-content mt-0 mb-4">Простий у використанні</h3>
            <p className="text-base text-base-content/60 mb-0 leading-[1.5]">
              Просто завантажте файл і починайте переклад. Налаштування не потрібні.
            </p>
          </div>
          <div className="flex-1 min-w-[200px] p-6 bg-base-200 rounded-[10px] transition-all duration-300 ease-in-out hover:-translate-y-2 hover:shadow-[0_12px_24px_rgba(0,0,0,0.25)] animate-slide-in-bottom [animation-delay:0.7s]">
            <h3 className="text-2xl text-base-content mt-0 mb-4">Ефективний робочий процес</h3>
            <p className="text-base text-base-content/60 mb-0 leading-[1.5]">
              Швидко переходьте між перекладами та редагуйте їх за допомогою комбінацій клавіш.
            </p>
          </div>
          <div className="flex-1 min-w-[200px] p-6 bg-base-200 rounded-[10px] transition-all duration-300 ease-in-out hover:-translate-y-2 hover:shadow-[0_12px_24px_rgba(0,0,0,0.25)] animate-slide-in-bottom [animation-delay:0.8s]">
            <h3 className="text-2xl text-base-content mt-0 mb-4">Гнучкий експорт</h3>
            <p className="text-base text-base-content/60 mb-0 leading-[1.5]">
              Експортуйте свою роботу у вигляді простого файлу JSON або ресурспаку.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
