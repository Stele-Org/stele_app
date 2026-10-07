import type { VkTheme } from '../types/prototype'

// Genres of the covers with the visitor's image: the video theme each genre stands for and the points the first
// two answers give them. Supplied by the user on 07.10.2026 («Тематика для видео - Тематика для обложек»,
// «Какие баллы даёт каждый ответ»). The names and recipe ids are those of the ten cover recipes in
// artifacts/stella-polza-kit/prompts/recipes.json; the user's «SCI FI» and «MUSICAL» are its SCI-FI and MUSICLE.
export type VkGenre = 'BOEVIK' | 'DETECTIVE' | 'DRAMA' | 'HISTORY' | 'COMEDY' | 'MUSICLE' | 'SCI-FI' | 'ADVENTURE' | 'HORROR' | 'FANTASY'

export const vkGenres: Array<{ id: VkGenre; recipeId: string; title: string; theme: VkTheme }> = [
  { id: 'BOEVIK', recipeId: '01_BOEVIK', title: 'Боевик', theme: 'Игры и авто' },
  { id: 'DETECTIVE', recipeId: '02_DETECTIVE', title: 'Детектив', theme: 'Новости и бизнес' },
  { id: 'DRAMA', recipeId: '03_DRAMA', title: 'Драма', theme: 'Спорт' },
  { id: 'HISTORY', recipeId: '04_HISTORY', title: 'Исторический фильм', theme: 'Культура и образование' },
  { id: 'COMEDY', recipeId: '05_COMEDY', title: 'Комедия', theme: 'Медиа и шоу' },
  { id: 'MUSICLE', recipeId: '06_MUSICLE', title: 'Мюзикл', theme: 'Музыка' },
  { id: 'SCI-FI', recipeId: '07_SCI-FI', title: 'Сай-фай', theme: 'Наука' },
  { id: 'ADVENTURE', recipeId: '08_ADVENTURE', title: 'Приключения', theme: 'Кино' },
  { id: 'HORROR', recipeId: '09_HORROR', title: 'Хоррор', theme: 'Спорт' },
  { id: 'FANTASY', recipeId: '10_FANTASY', title: 'Фэнтези', theme: 'Кино' },
]

/** Points of an answer to the first or the second question, by the id of the answer: +2 to some genres, +1 to others. */
export const vkGenrePoints: Record<string, { plusTwo: VkGenre[]; plusOne: VkGenre[] }> = {
  // Вопрос 1. У вас внезапно освободился вечер. Что включаем?
  series: { plusTwo: ['FANTASY'], plusOne: ['HORROR'] },
  standup: { plusTwo: ['COMEDY'], plusOne: ['BOEVIK', 'MUSICLE'] },
  interview: { plusTwo: ['HISTORY'], plusOne: ['DRAMA'] },
  science: { plusTwo: ['SCI-FI'], plusOne: ['ADVENTURE', 'DETECTIVE'] },
  // Вопрос 2. Каким должен быть идеальный контент на вечер?
  drive: { plusTwo: ['BOEVIK', 'ADVENTURE'], plusOne: [] },
  heroes: { plusTwo: ['DRAMA', 'HORROR'], plusOne: [] },
  learn: { plusTwo: ['DETECTIVE'], plusOne: ['HISTORY', 'SCI-FI'] },
  rest: { plusTwo: ['MUSICLE'], plusOne: ['FANTASY', 'COMEDY'] },
}
