import { useEffect, useState } from 'react'

interface Props {
  value: number | null | undefined
  decimals?: number
  prefix?: string
  suffix?: string
}

export function AnimatedMetric({ value, decimals = 0, prefix = '', suffix = '' }: Props) {
  const [display, setDisplay] = useState(value ?? 0)

  useEffect(() => {
    if (value == null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 720)
      const eased = 1 - (1 - progress) ** 3
      setDisplay(value * eased)
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [value])

  if (value == null) return <>—</>
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>
}
