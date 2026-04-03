import { useState, useEffect, useCallback } from 'react'

const KEY = 'et_v6_retry_queue'

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function useRetryQueue() {
  const [queue, _setQueue] = useState(loadQueue)
  const [online, setOnline] = useState(() => navigator.onLine)

  // Sync to localStorage on every change
  const setQueue = useCallback((updater) => {
    _setQueue(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  useEffect(() => {
    const up = () => setOnline(true)
    const dn = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', dn)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', dn)
    }
  }, [])

  const enqueue = useCallback((op, payload) => {
    setQueue(prev => [...prev, {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      op,
      payload,
      ts: Date.now(),
      attempts: 0,
    }])
  }, [setQueue])

  const remove = useCallback((id) => {
    setQueue(prev => prev.filter(i => i.id !== id))
  }, [setQueue])

  const bumpAttempts = useCallback((id) => {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, attempts: i.attempts + 1 } : i))
  }, [setQueue])

  const dropExhausted = useCallback((max = 5) => {
    setQueue(prev => prev.filter(i => i.attempts < max))
  }, [setQueue])

  return { queue, online, enqueue, remove, bumpAttempts, dropExhausted }
}
