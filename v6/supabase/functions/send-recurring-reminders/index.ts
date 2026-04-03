// Supabase Edge Function — send-recurring-reminders
// Runs on a daily cron schedule (07:00 IST = 01:30 UTC)
// Sends push notifications for recurring expenses due within 3 days

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY         = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY        = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT            = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

Deno.serve(async (_req) => {
  const today = new Date()
  const threeDaysLater = new Date(today)
  threeDaysLater.setDate(today.getDate() + 3)
  const threeDaysStr = threeDaysLater.toISOString().split('T')[0]

  // 1. Find all recurring expenses due within 3 days (service role bypasses RLS)
  const { data: dueExpenses, error: expErr } = await supabase
    .from('expenses')
    .select('user_id, description, next_due_date, amount_inr, recurring_period')
    .eq('is_recurring', true)
    .not('next_due_date', 'is', null)
    .lte('next_due_date', threeDaysStr)

  if (expErr) {
    return new Response(JSON.stringify({ error: expErr.message }), { status: 500 })
  }

  if (!dueExpenses || dueExpenses.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No due expenses' }), { status: 200 })
  }

  // 2. Group by user_id
  const byUser: Record<string, typeof dueExpenses> = {}
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

  if (subErr) {
    return new Response(JSON.stringify({ error: subErr.message }), { status: 500 })
  }

  // 4. Send a notification per subscription
  let sent = 0
  const staleEndpoints: { user_id: string; endpoint: string }[] = []

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
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      // 410 Gone or 404 = subscription no longer valid, remove it
      if (status === 410 || status === 404) {
        staleEndpoints.push({ user_id: sub.user_id, endpoint: sub.endpoint })
      }
      console.error(`Push failed for ${sub.endpoint}:`, err)
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

  return new Response(
    JSON.stringify({ sent, staleRemoved: staleEndpoints.length, checkedUsers: userIds.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
