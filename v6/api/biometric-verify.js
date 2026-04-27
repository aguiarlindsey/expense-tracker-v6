import { createClient } from '@supabase/supabase-js'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import nodemailer from 'nodemailer'

const RP_ID       = 'expense-tracker-v6.vercel.app'
const ORIGIN      = 'https://expense-tracker-v6.vercel.app'
const MAX_ATTEMPTS = 3
const LOCK_MINUTES = 15

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function sendAlertEmail(attempts) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
  await transporter.sendMail({
    from:    `"LA Expense Tracker" <${process.env.GMAIL_USER}>`,
    to:      process.env.GMAIL_USER,
    subject: '⚠️ Failed biometric sign-in — LA Expense Tracker',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#dc2626">⚠️ Security Alert</h2>
        <p>There have been <strong>${attempts} failed biometric sign-in attempt(s)</strong> on your LA Expense Tracker account.</p>
        <p>The account has been <strong>temporarily locked for ${LOCK_MINUTES} minutes</strong>.</p>
        <p>If this was you, please wait and try again. If not, someone may have access to your device.</p>
        <hr/>
        <p style="color:#6b7280;font-size:0.85rem">Time: ${new Date().toUTCString()}</p>
      </div>
    `,
  })
}

export default async function handler(req, res) {
  try {
  if (req.method !== 'POST') return res.status(405).end()

  const { userId, assertion } = req.body
  if (!userId || !assertion) return res.status(400).json({ error: 'Missing fields' })

  // Match the specific credential used (assertion.id = the credential that signed)
  const { data: cred } = await admin
    .from('biometric_credentials')
    .select('*')
    .eq('user_id', userId)
    .eq('id', assertion.id)
    .single()

  if (!cred) return res.status(404).json({ error: 'No credential found' })

  if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
    return res.status(423).json({ error: 'locked', lockedUntil: cred.locked_until })
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response:          assertion,
      expectedChallenge: cred.current_challenge,
      expectedOrigin:    ORIGIN,
      expectedRPID:      RP_ID,
      credential: {
        id:         cred.id,
        publicKey:  new Uint8Array(Buffer.from(cred.public_key, 'base64')),
        counter:    cred.counter,
        transports: cred.transports || [],
      },
    })
  } catch {
    const newAttempts  = (cred.failed_attempts || 0) + 1
    const shouldLock   = newAttempts >= MAX_ATTEMPTS
    await admin.from('biometric_credentials').update({
      failed_attempts: newAttempts,
      locked_until:    shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString() : null,
      current_challenge: null,
    }).eq('user_id', userId)

    if (shouldLock) { try { await sendAlertEmail(newAttempts) } catch {} }

    return res.status(401).json({
      error:        'Biometric verification failed',
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - newAttempts),
      locked:       shouldLock,
    })
  }

  if (!verification.verified) return res.status(401).json({ error: 'Not verified' })

  await admin.from('biometric_credentials').update({
    counter:           verification.authenticationInfo.newCounter,
    failed_attempts:   0,
    locked_until:      null,
    current_challenge: null,
    last_used_at:      new Date().toISOString(),
  }).eq('user_id', userId)

  // Get user email to generate a one-time token for the client
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId)
  if (userErr || !userData?.user) return res.status(500).json({ error: 'Could not retrieve user' })

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:  'magiclink',
    email: userData.user.email,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    return res.status(500).json({ error: 'Failed to create session token' })
  }

  res.json({
    verified:   true,
    token_hash: linkData.properties.hashed_token,
  })
  } catch (e) {
    console.error("[biometric-verify]", e)
    if (!res.headersSent) res.status(500).json({ error: e.message || "Internal error" })
  }
}