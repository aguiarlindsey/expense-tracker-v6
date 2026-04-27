import { createClient } from '@supabase/supabase-js'
import { generateRegistrationOptions } from '@simplewebauthn/server'

const RP_ID   = process.env.WEBAUTHN_RP_ID  || 'expense-tracker-v6.vercel.app'
const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'LA Expense Tracker'

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  try {
  if (req.method !== 'POST') return res.status(405).end()

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email,
    userDisplayName: user.email,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'preferred',
    },
    supportedAlgorithmIDs: [-7, -257],
  })

  await admin.from('registration_challenges').upsert({
    user_id:    user.id,
    challenge:  options.challenge,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  res.json(options)
  } catch (e) {
    console.error("[biometric-register-options]", e)
    if (!res.headersSent) res.status(500).json({ error: e.message || "Internal error" })
  }
}