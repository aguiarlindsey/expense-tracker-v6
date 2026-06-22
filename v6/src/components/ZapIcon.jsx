import { motion, useAnimation } from 'motion/react'
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'
import { Lightning } from '@phosphor-icons/react'

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
      <motion.div
        animate={controls}
        style={{ display: 'flex' }}
        variants={{
          normal: {
            opacity: 1, y: 0, scale: 1,
            transition: { duration: 0.35 },
          },
          animate: {
            opacity: [0, 1,    1   ],
            y:       [-5, 0,   0   ],
            scale:   [0.6, 1.2, 1  ],
            transition: { duration: 0.5, times: [0, 0.6, 1] },
          },
        }}
      >
        <Lightning size={size} weight="duotone" color={color} />
      </motion.div>
    </div>
  )
})

ZapIcon.displayName = 'ZapIcon'
export default ZapIcon
