// Vercel serverless function — Node.js runtime
// Triggered weekly by Vercel cron (vercel.json): Sundays 02:00 UTC
// Cleans up stale push_subscriptions and orphaned retry_queue entries

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  // Vercel cron jobs send: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers['authorization'] ?? ''
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const results = {}

  // 1. Delete push_subscriptions not updated in 90+ days
  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { count: subsRemoved, error: subsErr } = await supabase
    .from('push_subscriptions')
    .delete({ count: 'exact' })
    .lt('updated_at', cutoff90)

  if (subsErr) {
    console.error('push_subscriptions cleanup failed:', subsErr.message)
    results.push_subscriptions = { error: subsErr.message }
  } else {
    results.push_subscriptions = { removed: subsRemoved ?? 0 }
  }

  // 2. Delete orphaned retry_queue entries (retries exhausted — max 5 attempts)
  // Guarded: if the table doesn't exist yet, log and skip rather than crash
  const { count: queueRemoved, error: queueErr } = await supabase
    .from('retry_queue')
    .delete({ count: 'exact' })
    .gte('retries', 5)

  if (queueErr) {
    // Table may not exist yet — treat as non-fatal
    const isNoTable = queueErr.message?.includes('does not exist') ||
                      queueErr.code === '42P01'
    if (isNoTable) {
      results.retry_queue = { skipped: 'table does not exist' }
    } else {
      console.error('retry_queue cleanup failed:', queueErr.message)
      results.retry_queue = { error: queueErr.message }
    }
  } else {
    results.retry_queue = { removed: queueRemoved ?? 0 }
  }

  const totalCleaned =
    (results.push_subscriptions?.removed ?? 0) +
    (results.retry_queue?.removed ?? 0)

  return res.status(200).json({
    success: true,
    cleanedCount: totalCleaned,
    details: results,
    ranAt: new Date().toISOString(),
  })
}
