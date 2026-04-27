import { createClient } from '@supabase/supabase-js'
import { verifyRegistrationResponse } from '@simplewebauthn/server'

const RP_ID  = 'expense-tracker-v6.vercel.app'
const ORIGIN = 'https://expense-tracker-v6.vercel.app'

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  try {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).end()

  // DELETE — remove enrollment
  if (req.method === 'DELETE') {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })
    await admin.from('biometric_credentials').delete().eq('user_id', user.id)
    return res.json({ removed: true })
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { credential, deviceName, backupEmail, mainEmail } = req.body

  const { data: row } = await admin
    .from('registration_challenges')
    .select('challenge, expires_at')
    .eq('user_id', user.id)
    .single()

  if (!row) return res.status(400).json({ error: 'No challenge found — restart enrollment' })
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Challenge expired — restart enrollment' })

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: row.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    })
  } catch (e) {
    return res.status(400).json({ error: 'Verification failed: ' + e.message })
  }

  if (!verification.verified) return res.status(400).json({ error: 'Not verified' })

  const { credential: cred } = verification.registrationInfo
  const name = deviceName || 'My Device'

  // Remove any existing credential with the same device name for this user
  // — prevents stale credentials accumulating on re-enrolment
  await admin.from('biometric_credentials')
    .delete()
    .eq('user_id', user.id)
    .eq('device_name', name)

  await admin.from('biometric_credentials').insert({
    id:              cred.id,
    user_id:         user.id,
    public_key:      Buffer.from(cred.publicKey).toString('base64'),
    counter:         cred.counter,
    transports:      cred.transports || [],
    device_name:     name,
    main_email:      mainEmail  || user.email || null,
    backup_email:    backupEmail || null,
    failed_attempts: 0,
    otp_attempts:    0,
    locked_until:    null,
    last_used_at:    new Date().toISOString(),
  })

  await admin.from('registration_challenges').delete().eq('user_id', user.id)

  res.json({ verified: true })
  } catch (e) {
    console.error("[biometric-register]", e)
    if (!res.headersSent) res.status(500).json({ error: e.message || "Internal error" })
  }
}