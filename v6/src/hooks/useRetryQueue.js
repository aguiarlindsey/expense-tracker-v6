import { useState, useEffect, useCallback } from 'react'

const KEY = 'et_v6_retry_queue'

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

// Kahn's algorithm — returns items in dependency order
export function topoSort(items) {
  if (!items.length) return items
  const map = {}
  items.forEach(i => { map[i.id] = i })

  const inDegree = {}
  const adj = {}
  items.forEach(i => { inDegree[i.id] = 0; adj[i.id] = [] })

  items.forEach(i => {
    (i.dependsOn || []).forEach(dep => {
      if (map[dep]) {
        adj[dep].push(i.id)
        inDegree[i.id]++
      }
    })
  })

  const ready = items.filter(i => inDegree[i.id] === 0).map(i => i.id)
  const result = []

  while (ready.length) {
    const id = ready.shift()
    result.push(map[id])
    adj[id].forEach(nextId => {
      inDegree[nextId]--
      if (inDegree[nextId] === 0) ready.push(nextId)
    })
  }

  // Cycle fallback — append anything not yet sorted
  items.forEach(i => { if (!result.find(r => r.id === i.id)) result.push(i) })

  return result
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

  const enqueue = useCallback((op, payload, dependsOn = []) => {
    setQueue(prev => [...prev, {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      op,
      payload,
      dependsOn,
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
