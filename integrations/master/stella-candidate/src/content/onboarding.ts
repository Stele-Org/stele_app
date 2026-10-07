import type { Product } from '../types/prototype'

// user-approved: Google Docs, «ТЕКСТ основной», refreshed 2026-09-29.
// Spoken greeting is distinct from the on-screen introduction.
export const onboardingCopy = {
  homeQuestion: 'С чего начнём?',
  spokenGreeting: 'Добро пожаловать в экосистему VK. Здесь лента подстраивается под тебя.',
  voice: 'Со мной можно говорить своими словами. Скажи, например, «поехали»',
  touch: 'или просто нажми',
  start: 'НАЧАТЬ',
}

export const onboardingIntroductions: Record<Product, {
  title: string
  steps: string[]
}> = {
  max: {
    title: 'Исследуй свои\nвозможности с MAX!',
    steps: [
      'Ответь на пару вопросов',
      'Получи персональную\nмиссию',
      'Узнай больше о\u00a0пользе MAX\u00a0для\u00a0тебя',
    ],
  },
  'vk-video': {
    title: 'Исследуй мир\nвместе с VK Видео',
    steps: [
      'Расскажи, какой контент\nты любишь',
      'Получи персональную\nподборку от технологии\nDiscovery',
    ],
  },
}
