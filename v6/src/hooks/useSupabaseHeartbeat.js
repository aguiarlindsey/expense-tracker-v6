import { useEffect } from 'react'
import { supabase } from '../utils/supabase'

// Keeps the Supabase free-tier project alive.
// Supabase pauses projects after 7 days of REST API inactivity —
// Realtime WebSocket connections don't count as activity.
// Throttled to once every 3 days via localStorage to avoid redundant calls.
export function useSupabaseHeartbeat(userId) {
  useEffect(() => {
    if (!userId) return

    const KEY = 'et_v6_ka_ts'
    const THREE_DAYS = 3 * 24 * 3600 * 1000
    const last = parseInt(localStorage.getItem(KEY) || '0', 10)
    if (Date.now() - last < THREE_DAYS) return

    const triggerHeartbeat = async () => {
      try {
        const { error } = await supabase
          .from('expenses')
          .select('id')
          .eq('user_id', userId)
          .limit(1)

        if (error) throw error

        try { localStorage.setItem(KEY, String(Date.now())) } catch {}
        console.log('Supabase heartbeat: active')
      } catch (err) {
        console.error('Supabase heartbeat failed:', err.message)
      }
    }

    triggerHeartbeat()
  }, [userId])
}
