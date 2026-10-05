import vk_series from '../assets/ux-reference/vk-new-series.svg'
import vk_standup from '../assets/ux-reference/vk-new-standup.svg'
import vk_interview from '../assets/ux-reference/vk-new-interview.svg'
import vk_science from '../assets/ux-reference/vk-new-science.svg'
import vk_drive from '../assets/ux-reference/vk-new-drive.svg'
import vk_heroes from '../assets/ux-reference/vk-new-heroes.svg'
import vk_learn from '../assets/ux-reference/vk-new-learn.svg'
import vk_rest from '../assets/ux-reference/vk-new-rest.svg'
import vk_familiar from '../assets/ux-reference/vk-new-familiar.svg'
import vk_new from '../assets/ux-reference/vk-new-new.svg'
import vk_hero from '../assets/ux-reference/vk-new-hero.svg'
import vk_popular from '../assets/ux-reference/vk-new-popular.svg'
import business from '../assets/ux-reference/business.svg'
import personal from '../assets/ux-reference/personal.svg'
import identity from '../assets/ux-reference/identity.svg'
import connection from '../assets/ux-reference/connection.svg'
import visibility from '../assets/ux-reference/visibility.svg'

// Exact illustrations from the supplied October 3 VK screens; stable IDs preserve event/scoring contracts.
export const referenceCards: Record<string, string> = {
  series: vk_series, standup: vk_standup, interview: vk_interview, science: vk_science,
  drive: vk_drive, heroes: vk_heroes, learn: vk_learn, rest: vk_rest,
  familiar: vk_familiar, new: vk_new, hero: vk_hero, popular: vk_popular,
  business, personal, access: identity, connection, visibility,
}

export const vkCardLines: Record<string, string> = {
  series: 'Новый сериал,\nкоторый все\nобсуждают',
  standup: 'Стендап\nили что-нибудь\nсмешное',
  interview: 'Интервью\nс интересным\nчеловеком',
  science: 'Документалку\nили научпоп',
  drive: 'Чтобы был азарт\nи драйв',
  heroes: 'Чтобы\nпереживать\nза героев',
  learn: 'Чтобы узнать\nчто-то новое',
  rest: 'Чтобы отключить\nголову и отдохнуть',
  familiar: 'Что-то похожее на то,\nчто я уже люблю',
  new: 'Новое,\nно по теме моих\nинтересов',
  hero: 'Хочу стать героем\nVK Видео',
  popular: 'То, чем\nпрямо сейчас\nувлечены все',
}
