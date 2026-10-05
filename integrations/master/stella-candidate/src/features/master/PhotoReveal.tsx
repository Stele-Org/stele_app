import { useLayoutEffect, useRef } from 'react'
import { useAnimate } from 'motion/react'

/** Visible empty-metadata presentation; one Motion completion, no guessed tags. */
export function PhotoReveal({ title, hideCopy = false, playing, onComplete }: { title: string; hideCopy?: boolean; playing: boolean; onComplete: () => void }) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const controls = useRef<ReturnType<typeof animate> | null>(null)
  useLayoutEffect(() => {
    let cancelled = false
    const animation = animate(scope.current, { opacity: [0, 1, 1] }, { duration: .65, times: [0, .35, 1] })
    controls.current = animation
    void animation.then(() => { if (!cancelled) onComplete() })
    return () => { cancelled = true; animation.stop(); controls.current = null }
  }, [animate, scope, onComplete])
  useLayoutEffect(() => { if (playing) controls.current?.play(); else controls.current?.pause() }, [playing])
  return <section className="screen screen--result" aria-label="Подтверждённый выбор"><div ref={scope}>{!hideCopy && <h1>{title}</h1>}</div></section>
}
