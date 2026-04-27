import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end()

    const { userId, code } = req.body
    if (!userId || !code) return res.status(400).json({ error: 'Missing fields' })

    // Get stored OTP challenge
    const { data: cred } = await admin
      .from('biometric_credentials')
      .select('current_challenge')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!cred?.current_challenge) return res.status(400).json({ error: 'No OTP found. Please request a new code.' })

    let challenge
    try { challenge = JSON.parse(cred.current_challenge) } catch {
      return res.status(400).json({ error: 'Invalid OTP data. Please request a new code.' })
    }

    // Check expiry
    if (!challenge.expires_at || new Date(challenge.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Code has expired. Please request a new one.' })
    }

    // Check code matches
    if (String(code).trim().toUpperCase() !== String(challenge.otp).trim().toUpperCase()) {
      return res.status(401).json({ error: 'Incorrect code. Please try again.' })
    }

    // Clear challenge in background — don't await, respond immediately
    admin.from('biometric_credentials')
      .update({ current_challenge: null })
      .eq('user_id', userId)

    res.json({ verified: true, token_hash: challenge.token_hash })
  } catch (e) {
    console.error('[backup-otp-verify]', e)
    if (!res.headersSent) res.status(500).json({ error: e.message || 'Internal error' })
  }
}
