import type { AnswerOption, Product, ThemeScore, VkGender, VkTheme } from '../../types/prototype'

export const eventName = 'vk-stela:event'
export const channelName = 'vk-stela'

interface EventBase {
  version: 1
  sessionId: string
  sequence: number
  occurredAt: string
}

type EventData =
  | { type: 'session-start'; product: Product }
  | { type: 'answer'; product: Product; questionId: string; answerId: string; answerLabel: string; metadata: string[]; themeDelta?: Partial<Record<VkTheme, number>> }
  | { type: 'answer-cleared'; product: Product; questionId: string }
  | { type: 'vk-recommendation'; product: 'vk-video'; scores: ThemeScore[]; rankedThemes: VkTheme[]; selectedThemes: VkTheme[]; discoveryAnswerId: string; discoveryRule: string; photoMode: 'included' | 'skipped' | 'not-requested'; gender?: VkGender }

export type StelaEvent = EventBase & EventData

export interface EventSink {
  send(event: StelaEvent): void
}

export function createBrowserEventSink(): EventSink {
  const channel = typeof window === 'undefined' || typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName)
  return {
    send(event) {
      window.dispatchEvent(new CustomEvent<StelaEvent>(eventName, { detail: event }))
      channel?.postMessage(event)
    },
  }
}

export function createEventPublisher(sessionId: string, sink: EventSink) {
  let sequence = 0
  const send = (data: EventData) => {
    const event = {
      ...data,
      version: 1,
      sessionId,
      sequence: ++sequence,
      occurredAt: new Date().toISOString(),
    } as StelaEvent
    sink.send(event)
    return event
  }

  return {
    start(product: Product) {
      return send({ type: 'session-start', product })
    },
    answer(product: Product, questionId: string, option: AnswerOption, themeDelta?: Partial<Record<VkTheme, number>>) {
      return send({
        type: 'answer', product, questionId,
        answerId: option.id,
        answerLabel: option.label,
        metadata: [...option.metadata],
        ...(themeDelta ? { themeDelta } : {}),
      })
    },
    clear(product: Product, questionId: string) {
      return send({ type: 'answer-cleared', product, questionId })
    },
    recommendation(scores: ThemeScore[], rankedThemes: VkTheme[], discoveryAnswerId: string, discoveryRule: string, photoMode: 'included' | 'skipped' | 'not-requested', gender?: VkGender) {
      return send({
        type: 'vk-recommendation', product: 'vk-video', scores,
        rankedThemes, selectedThemes: rankedThemes.slice(0, 3),
        discoveryAnswerId, discoveryRule, photoMode,
        ...(gender ? { gender } : {}),
      })
    },
  }
}
