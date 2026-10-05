import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { VkProgressScreen } from './VkProgressScreen'

describe('empty metadata fallback', () => {
  it('shows an informational message without creating tags or answer targets', () => {
    const html = renderToStaticMarkup(<VkProgressScreen title="Пропустить" />)
    expect(html).not.toContain('progress-tag')
    expect(html).not.toContain('data-lc-influence="light"')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('metadata-bubble.png')
  })
})
