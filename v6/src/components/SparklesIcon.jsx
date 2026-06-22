import { motion, useAnimation } from 'motion/react'
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'

const SparklesIcon = forwardRef(function SparklesIcon(
  { onMouseEnter, onMouseLeave, color, size = 17, style, ...props },
  ref
) {
  const sparkleControls = useAnimation()
  const starControls    = useAnimation()
  const isControlledRef = useRef(false)

  useImperativeHandle(ref, () => {
    isControlledRef.current = true
    return {
      startAnimation: () => {
        sparkleControls.start('hover')
        starControls.start('blink')
      },
      stopAnimation: () => {
        sparkleControls.start('initial')
        starControls.start('initial')
      },
    }
  })

  const handleMouseEnter = useCallback((e) => {
    if (isControlledRef.current) { onMouseEnter?.(e); return }
    sparkleControls.start('hover')
    starControls.start('blink')
  }, [onMouseEnter, sparkleControls, starControls])

  const handleMouseLeave = useCallback((e) => {
    if (isControlledRef.current) { onMouseLeave?.(e); return }
    sparkleControls.start('initial')
    starControls.start('initial')
  }, [sparkleControls, starControls, onMouseLeave])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color, ...style }}
      {...props}
    >
      <svg
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* main 4-pointed star — fills in and floats up on hover */}
        <motion.path
          animate={sparkleControls}
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          fill="currentColor"
          variants={{
            initial: { fillOpacity: 0, y: 0 },
            hover: {
              fillOpacity: 1,
              y: [0, -1.5, 0],
              transition: { duration: 0.8, ease: 'easeOut' },
            },
          }}
          initial="initial"
        />
        {/* small cross marks — blink after the fill settles */}
        {['M20 3v4', 'M22 5h-4', 'M4 17v2', 'M5 18H3'].map((d) => (
          <motion.path
            key={d}
            animate={starControls}
            d={d}
            variants={{
              initial: { opacity: 1 },
              blink: {
                opacity: [1, 0, 1, 0, 1],
                transition: { duration: 1.2, delay: 0.5, ease: 'linear' },
              },
            }}
            initial="initial"
          />
        ))}
      </svg>
    </div>
  )
})

SparklesIcon.displayName = 'SparklesIcon'
export default SparklesIcon
