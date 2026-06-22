import { motion, useAnimation } from 'motion/react'
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'

/*
 * Phosphor Lightning path data (256×256 viewBox, duotone weight).
 * Rendered here as stroke paths so Framer Motion pathLength animation works.
 * strokeWidth 20 at 256×256 ≈ strokeWidth 1.3 at 17px — matches other item icons.
 */
const SECONDARY_D = 'M96,240l16-80L48,136,160,16,144,96l64,24Z'
const PRIMARY_D   = 'M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5-9.06L62,132.71l84.62-90.66L136.16,94.43a8,8,0,0,0,5,9.06l52.8,19.8Z'

const VARIANTS = {
  normal: {
    opacity: 1,
    pathLength: 1,
    transition: { duration: 0.6, opacity: { duration: 0.1 } },
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
    transition: { duration: 0.6, opacity: { duration: 0.1 } },
  },
}

const ZapIcon = forwardRef(function ZapIcon(
  { onMouseEnter, onMouseLeave, color, size = 17, style, ...props },
  ref
) {
  const controls = useAnimation()
  const isControlledRef = useRef(false)

  useImperativeHandle(ref, () => {
    isControlledRef.current = true
    return {
      startAnimation: () => controls.start('animate'),
      stopAnimation:  () => controls.start('normal'),
    }
  })

  const handleMouseEnter = useCallback((e) => {
    if (isControlledRef.current) onMouseEnter?.(e)
    else controls.start('animate')
  }, [controls, onMouseEnter])

  const handleMouseLeave = useCallback((e) => {
    if (isControlledRef.current) onMouseLeave?.(e)
    else controls.start('normal')
  }, [controls, onMouseLeave])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}
      {...props}
    >
      <svg
        fill="none"
        height={size}
        width={size}
        viewBox="0 0 256 256"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* duotone secondary — lighter ghost shape */}
        <motion.path
          animate={controls}
          d={SECONDARY_D}
          stroke={color}
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.3"
          variants={VARIANTS}
        />
        {/* primary outline */}
        <motion.path
          animate={controls}
          d={PRIMARY_D}
          stroke={color}
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={VARIANTS}
        />
      </svg>
    </div>
  )
})

ZapIcon.displayName = 'ZapIcon'
export default ZapIcon
