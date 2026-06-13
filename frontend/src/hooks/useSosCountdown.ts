import { useState, useRef, useCallback, useEffect } from 'react'

const COUNTDOWN_SECONDS = 5

export function useSosCountdown(onElapsed: () => void) {
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS)
  const [active, setActive] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onElapsedRef = useRef(onElapsed)
  onElapsedRef.current = onElapsed

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    clearTimer()
    setRemaining(COUNTDOWN_SECONDS)
    setActive(true)
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer()
          setActive(false)
          onElapsedRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearTimer])

  const cancel = useCallback(() => {
    clearTimer()
    setActive(false)
    setRemaining(COUNTDOWN_SECONDS)
  }, [clearTimer])

  useEffect(() => {
    return clearTimer
  }, [clearTimer])

  return { remaining, active, start, cancel }
}