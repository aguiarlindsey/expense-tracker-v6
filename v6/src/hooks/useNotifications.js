import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function useNotifications(userId) {
  const [permission, setPermission] = useState(
    () => typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  // Check if this browser already has a subscription stored in Supabase
  useEffect(() => {
    if (!userId || permission !== 'granted') return
    supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setSubscribed(!!data))
  }, [userId, permission])

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      setError('Push notifications are not configured yet.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const json = sub.toJSON()
      const { error: dbErr } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id:    userId,
            endpoint:   json.endpoint,
            p256dh:     json.keys.p256dh,
            auth:       json.keys.auth,
            user_agent: navigator.userAgent,
          },
          { onConflict: 'user_id,endpoint' }
        )
      if (dbErr) throw new Error(dbErr.message)
      setSubscribed(true)
      setPermission('granted')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint)
      }
      setSubscribed(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const requestAndSubscribe = useCallback(async () => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      setError('Notifications are not supported in this browser.')
      return
    }
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') await subscribe()
  }, [subscribe])

  return { permission, subscribed, loading, error, requestAndSubscribe, unsubscribe }
}
