import { createClient } from '@supabase/supabase-js'
import { generateAuthenticationOptions } from '@simplewebauthn/server'

const RP_ID = 'expense-tracker-v6.vercel.app'

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const { data: cred } = await admin
    .from('biometric_credentials')
    .select('id, transports, locked_until, failed_attempts')
    .eq('user_id', userId)
    .single()

  if (!cred) return res.status(404).json({ error: 'No biometric credential enrolled for this account' })

  if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
    return res.status(423).json({
      error: 'locked',
      lockedUntil: cred.locked_until,
      message: `Too many failed attempts. Try again after ${new Date(cred.locked_until).toLocaleTimeString()}.`,
    })
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials: [{ id: cred.id, type: 'public-key', transports: cred.transports || [] }],
  })

  await admin.from('biometric_credentials')
    .update({ current_challenge: options.challenge })
    .eq('user_id', userId)

  res.json(options)
}
