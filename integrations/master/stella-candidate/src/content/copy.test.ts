import { describe, expect, it } from 'vitest'
import { onboardingCopy, onboardingIntroductions } from './onboarding'
import { vkCopy, vkQuestions } from './vkVideo'
import { maxTransitionPrompt } from './max'

describe('approved VK copy and preserved MAX copy', () => {
  it('separates the spoken greeting from the on-screen steps', () => {
    expect(onboardingCopy.spokenGreeting).toBe('Добро пожаловать в экосистему VK. Здесь лента подстраивается под тебя.')
    expect(onboardingIntroductions.max.steps).toHaveLength(3)
    expect(onboardingIntroductions['vk-video'].steps.map(step => step.replace(/\s+/g, ' '))).toEqual([
      'Расскажи, какой контент ты любишь',
      'Получи персональную подборку от технологии Discovery',
    ])
    expect(vkCopy.digitizeDescription.replace(/\s+/g, ' ')).toBe('На его основе превратим тебя в главного героя твоей персональной подборки')
  })

  it('uses the new three-question VK script and conditional photo step', () => {
    expect(vkCopy.digitizeQuestion).toBe('Сделаем фото?')
    expect(`${vkCopy.digitizeNoticePrefix}${vkCopy.digitizeNoticeAction}.`).toBe('Отвечая «Да, давайте», вы принимаете условия использования персональных данных.')
    expect(vkQuestions.map(({ options }) => options.length)).toEqual([4, 4, 4])
    expect(vkQuestions[0].prompt).toBe('У вас внезапно освободился вечер. Что включаем?')
    expect(vkQuestions[1].options.map(option => option.label)).toEqual(['Драйвовый', 'Захватывающий', 'Познавательный', 'Расслабляющий'])
    expect(vkQuestions[2].prompt).toBe('Рекомендации Discovery решили немного вас удивить. Что показывать?')
    expect(vkQuestions[2].options[2].id).toBe('hero')
    expect(vkQuestions[2].options[3].label).toBe('То, чем прямо сейчас увлечены все')
  })

  it('keeps the start invitation and sends each branch to its panel', () => {
    expect(onboardingCopy.voice).toBe('Со мной можно говорить своими словами. Скажи, например, «поехали»')
    expect(maxTransitionPrompt).toBe('Пройди к правой панели,\nчтобы начать')
    expect(vkCopy.finalDirection.replace(/\s+/g, ' ')).toBe('Пройди к левой панели VK Видео – там твоя подборка оживёт вокруг тебя')
  })

  it('uses the new Discovery activation screen copy', () => {
    expect(vkCopy.discoveryActivationTitle).toBe('Технологии Discovery активированы.')
    expect(vkCopy.discoveryActivationDescription).toBe('Технологии персонализации Discovery уже начали собирать подборку.')
  })
})
