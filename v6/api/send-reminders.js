// Vercel serverless function — Node.js runtime
// Triggered daily by Vercel cron (vercel.json)
// Sends push notifications for recurring expenses due within 3 days

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  // Only allow GET (cron) or POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const today = new Date()
  const threeDaysLater = new Date(today)
  threeDaysLater.setDate(today.getDate() + 3)
  const threeDaysStr = threeDaysLater.toISOString().split('T')[0]

  // 1. Find recurring expenses due within 3 days
  const { data: dueExpenses, error: expErr } = await supabase
    .from('expenses')
    .select('user_id, description, next_due_date, amount_inr, recurring_period')
    .eq('is_recurring', true)
    .not('next_due_date', 'is', null)
    .lte('next_due_date', threeDaysStr)

  if (expErr) return res.status(500).json({ error: expErr.message })
  if (!dueExpenses || dueExpenses.length === 0) {
    return res.status(200).json({ sent: 0, message: 'No due expenses' })
  }

  // 2. Group by user_id
  const byUser = {}
  for (const exp of dueExpenses) {
    if (!byUser[exp.user_id]) byUser[exp.user_id] = []
    byUser[exp.user_id].push(exp)
  }

  // 3. Fetch push subscriptions for those users
  const userIds = Object.keys(byUser)
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (subErr) return res.status(500).json({ error: subErr.message })

  // 4. Send notifications
  let sent = 0
  const staleEndpoints = []

  for (const sub of (subs ?? [])) {
    const userExpenses = byUser[sub.user_id] ?? []
    if (!userExpenses.length) continue

    const first = userExpenses[0]
    const daysUntil = Math.round(
      (new Date(first.next_due_date + 'T12:00:00').getTime() - today.getTime()) / 86_400_000
    )
    const dueLabel =
      daysUntil < 0  ? `${Math.abs(daysUntil)}d overdue` :
      daysUntil === 0 ? 'due today' :
      `due in ${daysUntil}d`

    const amt = Math.round(first.amount_inr).toLocaleString('en-IN')
    const body = userExpenses.length === 1
      ? `${first.description} (₹${amt}) is ${dueLabel}.`
      : `${userExpenses.length} recurring expenses coming up — ${first.description} and ${userExpenses.length - 1} more.`

    const payload = JSON.stringify({
      title: 'Recurring Expense Reminder',
      body,
      url: '/?tab=recurring',
    })

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        staleEndpoints.push({ user_id: sub.user_id, endpoint: sub.endpoint })
      }
      console.error(`Push failed for ${sub.endpoint}:`, err.message)
    }
  }

  // 5. Clean up expired subscriptions
  for (const stale of staleEndpoints) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', stale.user_id)
      .eq('endpoint', stale.endpoint)
  }

  return res.status(200).json({ sent, staleRemoved: staleEndpoints.length, checkedUsers: userIds.length })
}
