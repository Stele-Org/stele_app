export type Product = 'max' | 'vk-video'

export type MaxAudience = 'personal' | 'business'

export type MaxGoal = 'access' | 'connection' | 'visibility'

export type MaxMission =
  | 'digital-id'
  | 'communication'
  | 'blogger'
  | 'business-promotion'

export type VkTheme =
  | 'Кино'
  | 'Медиа и шоу'
  | 'Наука'
  | 'Культура и образование'
  | 'Игры и авто'
  | 'Спорт'
  | 'Новости и бизнес'
  | 'Музыка'

export type VkGender = 'male' | 'female'

export interface AnswerOption<T extends string = string> {
  id: T
  label: string
  metadata: string[]
}

export interface WeightedOption extends AnswerOption {
  plusTwo: VkTheme
  plusOne: VkTheme
}

export interface VkQuestion<T extends AnswerOption = AnswerOption> {
  id: string
  prompt: string
  options: T[]
}

export interface ThemeScore {
  theme: VkTheme
  score: number
}
