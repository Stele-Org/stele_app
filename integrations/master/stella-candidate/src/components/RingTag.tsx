import { useId, type ButtonHTMLAttributes, type Ref } from 'react'
import { useRingActions } from './ring-action-context'

export type TagTone = 'blue' | 'red' | 'violet' | 'cyan'
export const ringToneColors: Record<TagTone, string> = { blue: '#0077FF', red: '#FF2B42', violet: '#6E1AFF', cyan: '#00BFFF' }

interface RingTagProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: TagTone
  navigation?: boolean
  shadowStrength?: number
  ref?: Ref<HTMLButtonElement>
}

export function RingTag({ tone = 'blue', navigation = false, shadowStrength = 1, className = '', disabled, onClick, children, ref, ...props }: RingTagProps) {
  const { busy, enabled, active, run } = useRingActions()
  const id = useId()
  return (
    <button {...props} ref={ref} type="button" className={`ring-tag ring-tag--${tone} ${className}`}
      data-ring-action={id} data-active={active === id} disabled={disabled || !enabled || (busy && !navigation)}
      data-lc-influence="shadow" data-lc-color={ringToneColors[tone]} data-lc-color-mix="0.55"
      data-lc-strength={shadowStrength} data-lc-falloff="2.5" data-lc-padding="12"
      data-lc-pulse="click"
      onClick={event => {
        if (event.detail > 1) return
        run(() => onClick?.(event), navigation, id)
      }}>
      {children}
    </button>
  )
}
