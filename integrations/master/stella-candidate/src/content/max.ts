import type { AnswerOption, MaxAudience, MaxGoal, MaxMission } from '../types/prototype'

// user-approved: Google Docs, «ТЕКСТ основной», 2026-09-27.
export const maxPrompts = {
  audience: 'Какие возможности ты хочешь освоить?',
  goal: 'Какой цели хочешь достичь?',
}

// client-verbatim: Google Sheets, MAX!B2:J6, checked 2026-10-01.
export const maxAudienceOptions: Array<AnswerOption<MaxAudience>> = [
  {
    id: 'business', label: 'Для бизнеса',
    metadata: ['бизнес', 'MAX для бизнеса', 'бизнес-аккаунт', 'клиенты', 'продажи', 'поддержка клиентов', 'автоматизация', 'продвижение'],
  },
  {
    id: 'personal', label: 'Для личного пользования',
    metadata: ['комфорт', 'повседневность', 'семья', 'друзья', 'задачи', 'близкие', 'жизнь', 'безопасность'],
  },
]

export const maxGoalOptions: Array<AnswerOption<MaxGoal>> = [
  {
    id: 'access',
    label: 'Упростить идентификацию',
    metadata: ['Цифровой ID', 'идентификация', 'удобство', 'документы', 'доступ', 'льготы', 'данные', 'надежность'],
  },
  {
    id: 'connection', label: 'Быть на связи 24/7',
    metadata: ['чаты', 'видеозвонки', 'аудиозвонки', 'голосовые', 'скорость', 'связь', 'файлы', 'стабильность'],
  },
  {
    id: 'visibility', label: 'Повысить узнаваемость',
    metadata: ['узнаваемость', 'аудитория', 'канал', 'контент', 'публикации', 'цели', 'инструменты', 'статистика'],
  },
]

export const maxMissionLabels: Record<MaxMission, string> = {
  'digital-id': 'Все возможности\nс Цифровым ID',
  communication: 'Общение\nна максимум',
  blogger: 'Стать блогером',
  'business-promotion': 'Продвижение бизнеса',
}

export const maxMissionDescriptions: Record<MaxMission, string> = {
  'digital-id': 'Узнай, как Цифровой ID в MAX\nупрощает жизнь',
  communication: 'Попробуй все возможности общения в MAX',
  blogger: 'Развивай канал в MAX и\u00a0смотри, как растёт аудитория',
  'business-promotion': 'Попробуй инструменты MAX для бизнеса',
}

// user-approved: direct copy and line-break correction, 2026-09-28.
export const maxTransitionPrompt = 'Пройди к правой панели,\nчтобы начать'
// user-approved: final button copy, 2026-10-02.
export const maxThanks = 'спасибо'
