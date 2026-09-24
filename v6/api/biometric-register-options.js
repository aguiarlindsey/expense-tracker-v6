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
  if (req.method === 'GET') return res.status(200).json({ ok: 'warm' })
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
      // 'discouraged', not 'preferred' — a discoverable/resident key is what
      // makes iOS treat this as a system passkey and show the "choose how to
      // manage passkeys" iCloud-Keychain-or-Brave picker. The app never needs
      // discoverable lookup anyway: biometric-auth-options.js always passes an
      // explicit allowCredentials list, so a plain device-bound credential
      // (straight to Face ID/Touch ID/passcode, no picker) is the right fit.
      residentKey: 'discouraged',
    },
    supportedAlgorithmIDs: [-7, -257],
  })

  // Delete-then-insert, not upsert(user_id) — upsert without an explicit
  // onConflict target falls back to the table's primary key, and this table's
  // PK is not known to be user_id from this codebase's tracked migrations.
  // Every retry (cold-start fails, cancelled prompts, etc.) was silently
  // inserting a new row instead of replacing the old one, so the completion
  // step's .single() lookup below started failing once 2+ rows existed for a
  // user — "No challenge found" — which sends them back to retry, adding yet
  // another row. Explicit delete-then-insert guarantees exactly one row
  // regardless of schema, and self-heals any rows already piled up.
  await admin.from('registration_challenges').delete().eq('user_id', user.id)
  await admin.from('registration_challenges').insert({
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