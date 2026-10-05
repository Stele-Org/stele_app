import { expect, it } from 'vitest'
import { questionFromSnapshot, revealFromSnapshot, resultPath } from './presentation'
import type { Snapshot } from './slice-client.mjs'
it('uses server question IDs/copy and accepted metadata, with no local scoring', () => {
  const s = { session: { state: { protocol: 'stella-vk-v1', screen: 'question', questionIndex: 0 },
    view: { questionId: 'frozen-q', title: 'Server prompt', options: [{ id: 'server-option', label: 'Server label' }] } } } as Snapshot
  expect(questionFromSnapshot(s)?.options).toEqual([{ id: 'server-option', label: 'Server label' }])
  s.session!.state = { ...s.session!.state!, screen: 'answer-reveal', answers: [{ questionId: 'frozen-q', answerId: 'science', label: 'Accepted label', metadata: ['one','two','three','four','five'] }] }
  const r = revealFromSnapshot(s)!
  expect(r.label).toBe('Accepted label');expect(r.answerCard?.index).toBe(3)
  expect(r.batches).toEqual([['one','two','three','four'],['five']])
  s.session!.state.protocol = 'stella-max-v1';expect(revealFromSnapshot(s)).toBeNull()
})

it('uses the current answer at arbitrary question index and pinned result identity', () => {
  const s = {session:{state:{protocol:'stella-vk-v1', screen:'answer-reveal', questionIndex:2,
    answers:[{label:'old',metadata:['old']},{label:'old2',metadata:['old2']},{label:'current',answerId:'new',metadata:['server tag']}],
    contentPlan:{status:'accepted',packageId:'a/b',resultPath:'/vkshare/result/a%2Fb'}},view:{title:'Server photo',options:[{id:'skip',label:'Exact server skip'}]}}} as Snapshot
  expect(revealFromSnapshot(s)?.label).toBe('current')
  expect(revealFromSnapshot(s)?.batches).toEqual([['server tag']])
  expect(resultPath(s)).toBe('/vkshare/result/a%2Fb')
  s.session!.state!.contentPlan!.resultPath='https://other/result';expect(resultPath(s)).toBeNull()
  s.session!.state!.screen='photochoice';expect(questionFromSnapshot(s)?.options[0].label).toBe('Exact server skip')
})
