import type { VkTheme } from '../types/prototype'

// Genres of the covers with the visitor's image: the video theme each genre stands for and the points the first
// two answers give them. Supplied by the user on 07.10.2026 («Тематика для видео - Тематика для обложек»,
// «Какие баллы даёт каждый ответ»). The names and recipe ids are those of the ten cover recipes in
// artifacts/stella-polza-kit/prompts/recipes.json; the user's «SCI FI» and «MUSICAL» are its SCI-FI and MUSICLE.
// The titles are the user's of 08.10.2026: the mood of the cover, not the name of the film genre. FANTASY and ADVENTURE
// share one; HORROR was not in that list and keeps its former title.
export type VkGenre = 'BOEVIK' | 'DETECTIVE' | 'DRAMA' | 'HISTORY' | 'COMEDY' | 'MUSICLE' | 'SCI-FI' | 'ADVENTURE' | 'HORROR' | 'FANTASY'

export const vkGenres: Array<{ id: VkGenre; recipeId: string; title: string; theme: VkTheme }> = [
  { id: 'BOEVIK', recipeId: '01_BOEVIK', title: 'Драйвовый', theme: 'Игры и авто' },
  { id: 'DETECTIVE', recipeId: '02_DETECTIVE', title: 'Детективный', theme: 'Новости и бизнес' },
  { id: 'DRAMA', recipeId: '03_DRAMA', title: 'Драматический', theme: 'Спорт' },
  { id: 'HISTORY', recipeId: '04_HISTORY', title: 'Исторический', theme: 'Культура и образование' },
  { id: 'COMEDY', recipeId: '05_COMEDY', title: 'Весёлый', theme: 'Медиа и шоу' },
  { id: 'MUSICLE', recipeId: '06_MUSICLE', title: 'Музыкальный', theme: 'Музыка' },
  { id: 'SCI-FI', recipeId: '07_SCI-FI', title: 'Фантастический', theme: 'Наука' },
  { id: 'ADVENTURE', recipeId: '08_ADVENTURE', title: 'В поисках приключений', theme: 'Кино' },
  { id: 'HORROR', recipeId: '09_HORROR', title: 'Хоррор', theme: 'Спорт' },
  { id: 'FANTASY', recipeId: '10_FANTASY', title: 'В поисках приключений', theme: 'Кино' },
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
