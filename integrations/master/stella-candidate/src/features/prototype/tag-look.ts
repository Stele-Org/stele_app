export type TagLook = 'gradient' | 'solid'

/** Both looks are accepted; the gradient frame is the default, `?tagLook=solid` switches to the fill. */
export function readTagLook(search: string): TagLook {
  return new URLSearchParams(search).get('tagLook') === 'solid' ? 'solid' : 'gradient'
}
