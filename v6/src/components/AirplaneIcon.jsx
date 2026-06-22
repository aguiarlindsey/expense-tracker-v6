import { motion, useAnimation } from 'motion/react'
import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'
import { Airplane } from '@phosphor-icons/react'

const AirplaneIcon = forwardRef(function AirplaneIcon(
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
          normal:  { x: 0, y: 0, scale: 1,   transition: { duration: 0.5 } },
          animate: { x: 3, y: -3, scale: 0.8, transition: { duration: 0.5 } },
        }}
      >
        <Airplane size={size} weight="duotone" color={color} />
      </motion.div>
    </div>
  )
})

AirplaneIcon.displayName = 'AirplaneIcon'
export default AirplaneIcon
