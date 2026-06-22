import { useEffect, useRef, memo } from 'react'

const GlowingEffect = memo(function GlowingEffect({
  spread = 40,
  proximity = 64,
  inactiveZone = 0.01,
  borderWidth = 1.5,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0

    const update = (e) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const { left, top, width, height } = el.getBoundingClientRect()
        const cx = left + width / 2
        const cy = top + height / 2
        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const dist = Math.hypot(dx, dy)

        if (dist < 0.5 * Math.min(width, height) * inactiveZone) {
          el.style.setProperty('--active', '0')
          return
        }

        const isNear =
          e.clientX > left - proximity &&
          e.clientX < left + width + proximity &&
          e.clientY > top - proximity &&
          e.clientY < top + height + proximity

        el.style.setProperty('--active', isNear ? '1' : '0')
        if (!isNear) return

        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90
        el.style.setProperty('--start', String(angle))
      })
    }

    document.addEventListener('pointermove', update, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointermove', update)
    }
  }, [proximity, inactiveZone])

  return (
    <div
      ref={ref}
      className="glowing-effect"
      style={{
        '--spread': spread,
        '--border-w': `${borderWidth}px`,
      }}
    />
  )
})

export default GlowingEffect
