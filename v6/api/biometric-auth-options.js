import { createClient } from '@supabase/supabase-js'
import { generateAuthenticationOptions } from '@simplewebauthn/server'

const RP_ID = process.env.WEBAUTHN_RP_ID || 'expense-tracker-v6.vercel.app'

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: 'warm' })
    if (req.method !== 'POST') return res.status(405).end()

    const { userId, credentialId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })

    // Fetch ALL credentials for this user (multi-device support)
    const { data: creds, error: credsErr } = await admin
      .from('biometric_credentials')
      .select('id, transports, locked_until, failed_attempts')
      .eq('user_id', userId)

    if (credsErr || !creds || creds.length === 0) {
      return res.status(404).json({ error: 'No biometric credential enrolled for this account' })
    }

    // Check if ALL credentials are locked
    const now = new Date()
    const activeCreds = creds.filter(c => !c.locked_until || new Date(c.locked_until) <= now)
    if (activeCreds.length === 0) {
      const earliest = creds.reduce((a, b) => new Date(a.locked_until) < new Date(b.locked_until) ? a : b)
      return res.status(423).json({
        error: 'locked',
        lockedUntil: earliest.locked_until,
        message: `Too many failed attempts. Try again after ${new Date(earliest.locked_until).toLocaleTimeString()}.`,
      })
    }

    // If the client sends its enrolled credential ID, use only that one.
    // This makes each device independent: challenges are stored per-credential so
    // PC generating auth options can't overwrite the phone's pending challenge.
    const matchedCred = credentialId && activeCreds.find(c => c.id === credentialId)
    const deviceCreds = matchedCred ? [matchedCred] : activeCreds

    // Force transports: ['internal'] so the browser never offers cross-device Bluetooth auth.
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials: deviceCreds.map(c => ({
        id:         c.id,
        type:       'public-key',
        transports: ['internal'],
      })),
    })

    // Store challenge only on this device's credential row — not on every credential.
    // Storing on all rows caused the "biometric not recognised" bug: if PC generated
    // options after phone, phone's stored challenge was overwritten before phone verified.
    const challengeUpdate = admin.from('biometric_credentials')
      .update({ current_challenge: options.challenge })
    await (deviceCreds.length === 1
      ? challengeUpdate.eq('id', deviceCreds[0].id)
      : challengeUpdate.eq('user_id', userId))

    res.json(options)
  } catch (e) {
    console.error('[biometric-auth-options]', e)
    if (!res.headersSent) res.status(500).json({ error: e.message || 'Internal error' })
  }
}
