// Rewards mode: 30 levels spread evenly over translation progress. Perks are cumulative
// and purely decorative; each level also has its own level-up screen.

export const LEVEL_COUNT = 30;

// Level n is reached once n/30 of the translatable rows are confirmed, so level 30 means 100%.
export const levelForProgress = (confirmed, total) => {
  if (!total) return 0;
  const ratio = Math.min(confirmed / total, 1);
  return Math.min(LEVEL_COUNT, Math.floor(ratio * LEVEL_COUNT + 1e-9));
};

// Whole percent still to translate; never shows 0% until the work is truly finished.
export const percentLeft = (confirmed, total) => {
  if (!total || confirmed >= total) return 0;
  return Math.max(1, Math.round(((total - confirmed) / total) * 100));
};

// Bursts the level-up screen cycles through; combined with colours, emoji and text
// every level still looks unique.
export const BURSTS = ["confetti", "stars", "emoji", "hearts", "fireworks", "bubbles", "rings", "pixels", "snow", "rays"];

const reward = (emoji, title, message, perk, colors) => ({ emoji, title, message, perk, colors });

// Index 0 is level 1.
const REWARDS = [
  reward("🦆", "Качка-початківець", "Перший крок зроблено! До вас приєдналась качка.", "Качка гуляє внизу екрана", ["#ffd84d", "#ff9a3c"]),
  reward("✨", "Іскра", "Курсор тепер залишає за собою іскри.", "Іскри за курсором", ["#ff5fa2", "#b25ef0"]),
  reward("💧", "Хвилі", "Кожен клік тепер розходиться колами.", "Кола від кліків", ["#4fd1ff", "#5b7cff"]),
  reward("🌟", "Зорепад", "На тлі з'явилися ледь помітні зорі.", "Мерехтливі зорі на тлі", ["#8e7dff", "#2a1f6b"]),
  reward("🎨", "Свій колір", "Виділення тексту й смуга прокрутки отримали акцент.", "Акцентні виділення та скрол", ["#ff7ab6", "#ffb36b"]),
  reward("💡", "Яскравий фокус", "Поле перекладу світиться, коли ви в ньому пишете.", "Сяйво активного поля", ["#ffe066", "#ff9f1c"]),
  reward("🪲", "Світлячки", "Тихими вечорами зі світляками веселіше.", "Світлячки", ["#c6f35c", "#2fbf71"]),
  reward("🌌", "Полярне сяйво", "Тло ледь помітно переливається.", "Північне сяйво на тлі", ["#38f9d7", "#7b5cff"]),
  reward("🦋", "Метелик", "Новий друг ліниво літає за вашим курсором.", "Метелик за курсором", ["#7ee8fa", "#eec0c6"]),
  reward("⛏️", "Шахтар", "Курсор перетворився на кайло.", "Кайло замість курсора", ["#b0b7c3", "#6b7280"]),
  reward("🌈", "Лінія прогресу", "Угорі екрана тече тонка кольорова лінія.", "Анімована лінія вгорі", ["#ff5f6d", "#ffc371"]),
  reward("🌸", "Пелюстки", "Над редактором кружляють пелюстки.", "Пелюстки, що падають", ["#ffb3d1", "#ff6fa5"]),
  reward("🎉", "Феєрверк кліків", "Дрібне конфеті розлітається від кожного кліку.", "Конфеті від кліків", ["#f857a6", "#ff5858"]),
  reward("🔆", "Золота назва", "Назва «Мовник» засяяла градієнтом.", "Градієнтна назва", ["#f6d365", "#fda085"]),
  reward("🐷", "Свинка", "Невдовзі до качки приєдналась свинка.", "Свинка гуляє внизу", ["#ffc2d1", "#ff8fab"]),
  reward("🎆", "Веселка", "Лінія угорі стала веселковою.", "Веселкова лінія вгорі", ["#00c6ff", "#ff5fa2"]),
  reward("🫧", "Бульбашки", "Бульбашки пливуть угору, як у воді.", "Бульбашки", ["#74ebd5", "#9face6"]),
  reward("⭕", "Орбіта", "За курсором тягнеться тонке кільце.", "Кільце за курсором", ["#a18cd1", "#fbc2eb"]),
  reward("🌙", "Місяць", "У кутку зійшов місяць.", "Місяць у кутку", ["#c9d6ff", "#4b5d99"]),
  reward("🌠", "Падаюча зоря", "Іноді небом пролітає зірка.", "Падаючі зорі", ["#fceabb", "#f8b500"]),
  reward("👑", "Королівська качка", "Качка отримала корону.", "Корона на качці", ["#ffd700", "#ff8c00"]),
  reward("🟪", "Піксельні кути", "Кути екрана обрамили піксельні тіні.", "Піксельні віньєтки", ["#7f5af0", "#2cb67d"]),
  reward("🐥", "Каченя", "За качкою тупцяє каченя.", "Каченя слідом за качкою", ["#fff176", "#ffb74d"]),
  reward("🌗", "Зміна доби", "Тло повільно змінює відтінок, як доба.", "Плавна зміна відтінку", ["#fbd786", "#6a3093"]),
  reward("🎇", "Салют", "Час від часу в кутку лунає салют.", "Салюти в кутку", ["#ff9a9e", "#fad0c4"]),
  reward("❄️", "Дрібний пил", "Над сторінкою літає піксельний пил.", "Дрібний пил", ["#e0eafc", "#8ec5fc"]),
  reward("🏆", "Золоте сяйво", "Назва тепер блищить золотом.", "Золоте мерехтіння назви", ["#fddb92", "#d1fdff"]),
  reward("🔮", "Паралакс", "Тло ледь помітно рухається за курсором.", "Паралакс-точки", ["#c471f5", "#fa71cd"]),
  reward("☀️", "Сонячне проміння", "У кутку обертаються промені.", "Обертові промені", ["#ffe259", "#ffa751"]),
  reward("🎊", "Легенда Мовника", "Ви переклали все! Усі нагороди розблоковано.", "Золота аврора та все разом", ["#f9d423", "#ff4e50"]),
];

export const getReward = (level) => {
  const index = Math.min(Math.max(level, 1), LEVEL_COUNT) - 1;
  return { level: index + 1, burst: BURSTS[index % BURSTS.length], ...REWARDS[index] };
};
