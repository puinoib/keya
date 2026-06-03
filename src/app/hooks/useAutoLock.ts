import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const
const THROTTLE_MS = 10_000
const CHECK_INTERVAL_MS = 15_000

export function useAutoLock() {
  const workspaceState = useStore((s) => s.workspaceState)
  const lock = useStore((s) => s.lock)

  const lastActivityRef = useRef(Date.now())
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (workspaceState !== 'unlocked') return

    lastActivityRef.current = Date.now()

    const onActivity = () => {
      if (throttleRef.current) return
      lastActivityRef.current = Date.now()
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null
      }, THROTTLE_MS)
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }

    const intervalId = setInterval(() => {
      const db = useStore.getState().db
      const timeoutMs = (db?.getSettings().auto_lock_minutes ?? 5) * 60 * 1000
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        lock()
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
      }
      clearInterval(intervalId)
      if (throttleRef.current) {
        clearTimeout(throttleRef.current)
        throttleRef.current = null
      }
    }
  }, [workspaceState, lock])
}
