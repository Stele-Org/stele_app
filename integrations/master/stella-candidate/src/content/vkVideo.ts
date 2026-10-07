import type { AnswerOption, VkGender, VkQuestion, VkTheme, WeightedOption } from '../types/prototype'

// Copy: supplied artifacts/DESIGN/UI/stela/new, October 3. Stable IDs/weights retain the existing data contract.
// Metadata and score weights: Google Sheets "Метаданные_VK_Видео_и_MAX"; photo skip is overridden by direct user instruction.
export const vkCopy = {
  // The photo step as changed by the user on 06.10.2026: new heading and button, no description line, no back button.
  // The non-breaking space keeps the brand name on one line.
  digitizeQuestion: 'Ты – главный герой VK\u00a0Видео',
  digitizeAccept: 'Начать',
  digitizeSkip: 'Пропустить',
  // user-approved: the wording with the typo correction requested earlier; the button name follows digitizeAccept.
  digitizeNoticePrefix: 'Отвечая «Начать», вы принимаете ',
  digitizeNoticeAction: 'условия использования персональных данных',
  // working-draft: short screen heading for the user's requested M/Ж choice.
  genderPrompt: 'Укажи пол',
  // User-approved full screen and spoken copy, October 4.
  discoveryActivationTitle: 'Технологии Discovery активированы.',
  discoveryActivationDescription: 'Технологии персонализации Discovery уже начали собирать подборку.',
  finalTitle: 'Готово.\nDiscovery разобрал твои ответы\nи собрал твой профиль интересов:\nтемы, героев, настроение и атмосферу.',
  // Changed by the user on 06.10.2026: «к экрану VK Видео» instead of «к левой панели», with the final full stop.
  finalDirection: 'Пройди к экрану\nVK Видео – там твоя подборка\nоживёт вокруг тебя.',
  // user-approved in the earlier direct request; the new document does not specify this control.
  thanks: 'спасибо',
  finalQrCaption: 'Узнай больше о Discovery',
  cameraPrompt: 'Смотри в камеру над экраном',
  // The check of the photo taken during the scan: the two choices named by the user, 06.10.2026.
  photoContinue: 'Продолжить',
  photoRetake: 'Повторить',
}

export const vkThemes: VkTheme[] = [
  'Кино',
  'Медиа и шоу',
  'Наука',
  'Культура и образование',
  'Игры и авто',
  'Спорт',
  'Новости и бизнес',
  'Музыка',
]

export const vkQuestions: [VkQuestion<WeightedOption>, VkQuestion<WeightedOption>, VkQuestion] = [
  {
    id: 'evening',
    // «Что включаем?» stands on the second line (user, 07.10.2026); the heading keeps line breaks (global.css).
    prompt: 'У вас внезапно освободился вечер.\nЧто включаем?',
    options: [
      { id: 'series', label: 'Новый сериал, который все обсуждают', metadata: ['обсуждения', 'сериал', 'премьера', 'популярное'], plusTwo: 'Кино', plusOne: 'Музыка' },
      { id: 'standup', label: 'Стендап или что-нибудь смешное', metadata: ['шоу', 'стендап', 'юмор', 'комедия'], plusTwo: 'Медиа и шоу', plusOne: 'Игры и авто' },
      { id: 'interview', label: 'Интервью с интересным человеком', metadata: ['подкаст', 'новости', 'интервью', 'люди'], plusTwo: 'Культура и образование', plusOne: 'Новости и бизнес' },
      { id: 'science', label: 'Документалку или научпоп', metadata: ['наука', 'знания', 'документальное кино', 'научпоп'], plusTwo: 'Наука', plusOne: 'Спорт' },
    ],
  },
  {
    id: 'ideal-content',
    // The non-breaking spaces move «контент на вечер?» to the second line together: «вечер?» does not hang alone (user, 07.10.2026).
    prompt: 'Каким должен быть идеальный контент\u00a0на\u00a0вечер?',
    options: [
      { id: 'drive', label: 'Драйвовый', metadata: ['драйв', 'азарт', 'игры', 'авто'], plusTwo: 'Игры и авто', plusOne: 'Кино' },
      { id: 'heroes', label: 'Захватывающий', metadata: ['переживания', 'чувства', 'герои', 'эмоции'], plusTwo: 'Спорт', plusOne: 'Культура и образование' },
      { id: 'learn', label: 'Познавательный', metadata: ['культура', 'обучение', 'культура', 'факты'], plusTwo: 'Новости и бизнес', plusOne: 'Наука' },
      { id: 'rest', label: 'Расслабляющий', metadata: ['музыка', 'медиа', 'отдых', 'лёгкий контент'], plusTwo: 'Музыка', plusOne: 'Медиа и шоу' },
    ],
  },
  {
    id: 'discovery',
    prompt: 'Рекомендации Discovery решили немного вас удивить. Что показывать?',
    options: [
      { id: 'familiar', label: 'Что-то похожее на то, что я уже люблю', metadata: ['рекомендации', 'для меня', 'персонализация', 'увлечения'] },
      { id: 'new', label: 'Новое, но по теме моих интересов', metadata: ['новинки', 'лайки', 'интересы', 'темы'] },
      { id: 'hero', label: 'Хочу стать героем VK Видео', metadata: ['образ', 'VK Видео', 'главный герой', 'роль'] },
      { id: 'popular', label: 'То, чем прямо сейчас увлечены все', metadata: ['тренды', 'яркое', 'все', 'топ-5'] },
    ],
  },
]

export const vkPhotoOptions: Array<AnswerOption<'accept' | 'skip'>> = [
  { id: 'accept', label: vkCopy.digitizeAccept, metadata: ['ракурс', 'освещение', 'композиция', 'обработка'] },
  { id: 'skip', label: vkCopy.digitizeSkip, metadata: [] },
]

export const vkGenderOptions: Array<AnswerOption<VkGender>> = [
  { id: 'male', label: 'М', metadata: [] },
  { id: 'female', label: 'Ж', metadata: [] },
]

export const discoveryRules: Record<string, string> = {
  familiar: 'По одному видео из Топ 2 тематик для пользователя',
  new: 'Дополнительное видео из тематики 3 или 4',
  hero: 'Формируется пул обложек с учетом выбранных тематик, на которых размещен образ пользователя',
  popular: 'Самое популярное видео за последние 7 дней из каталога согласованных видео',
}
