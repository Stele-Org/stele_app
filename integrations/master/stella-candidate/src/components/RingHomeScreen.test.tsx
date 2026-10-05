// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { RingHomeScreen } from './RingHomeScreen'
import { onboardingCopy } from '../content/onboarding'
import vkHomeLogo from '../assets/ux-reference/home-vk-video.svg'
import maxHomeLogo from '../assets/ux-reference/home-max.svg'

it('offers the two products with the supplied horizontal logos and keeps the heading', () => {
  const html = renderToStaticMarkup(<RingHomeScreen onSelect={() => {}} />)
  const host = new DOMParser().parseFromString(html, 'text/html')
  expect(host.querySelector('#home-title')?.textContent).toBe(onboardingCopy.homeQuestion)
  const [video, max] = [...host.querySelectorAll('.home-choices > button.product-tag')]
  expect(host.querySelectorAll('.home-choices > button')).toHaveLength(2)
  expect(video.classList.contains('product-tag--vk-video')).toBe(true)
  expect(video.getAttribute('aria-label')).toBe('VK Видео')
  expect(video.querySelector('img')?.getAttribute('src')).toBe(vkHomeLogo)
  expect(max.classList.contains('product-tag--max')).toBe(true)
  expect(max.getAttribute('aria-label')).toBe('MAX')
  expect(max.querySelector('img')?.getAttribute('src')).toBe(maxHomeLogo)
  expect(html).not.toContain('vk-new-home')
  // Both choices keep the LumiCells shadow and click pulse of the previous buttons.
  expect(html.match(/data-lc-pulse="click"/g)).toHaveLength(2)
  expect(html.match(/data-lc-influence="shadow"/g)).toHaveLength(3)
})