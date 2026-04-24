import { useEffect } from 'react'
import { supabase } from '../utils/supabase'

// Sends a lightweight HEAD query to Supabase at most once every 3 days.
// Supabase free-tier pauses projects after 7 days of REST API inactivity —
// Realtime WebSocket connections don't count. This resets that timer cheaply.
export function useSupabaseHeartbeat(userId) {
  useEffect(() => {
    if (!userId) return
    const KEY = 'et_v6_ka_ts'
    const THREE_DAYS = 3 * 24 * 3600 * 1000
    const last = parseInt(localStorage.getItem(KEY) || '0', 10)
    if (Date.now() - last < THREE_DAYS) return
    supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then(() => { try { localStorage.setItem(KEY, String(Date.now())) } catch {} })
  }, [userId])
}
