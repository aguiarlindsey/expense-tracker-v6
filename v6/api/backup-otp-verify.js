import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const MAX_OTP_ATTEMPTS = 3
const LOCK_MINUTES     = 15

const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
})

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function sendOtpLockAlert() {
  try {
    await transporter.sendMail({
      from:    `"LA Expense Tracker" <${process.env.GMAIL_USER}>`,
      to:      process.env.GMAIL_USER,
      subject: '⚠️ Failed OTP sign-in attempts — LA Expense Tracker',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#dc2626">⚠️ Security Alert</h2>
          <p>There have been <strong>${MAX_OTP_ATTEMPTS} failed OTP sign-in attempts</strong> on your LA Expense Tracker account.</p>
          <p>The OTP fallback has been <strong>locked for ${LOCK_MINUTES} minutes</strong>.</p>
          <p>If this was not you, someone may have access to your device.</p>
          <hr/>
          <p style="color:#6b7280;font-size:0.85rem">Time: ${new Date().toUTCString()}</p>
        </div>
      `,
    })
  } catch {}
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end()

    const { userId, code } = req.body
    if (!userId || !code) return res.status(400).json({ error: 'Missing fields' })

    // Fetch ALL credentials — .limit(1) picks the wrong row when multiple devices are enrolled
    const { data: creds } = await admin
      .from('biometric_credentials')
      .select('id, current_challenge, otp_attempts, otp_locked_until')
      .eq('user_id', userId)

    if (!creds || creds.length === 0) return res.status(404).json({ error: 'No credential found' })

    // Find the credential that has an active OTP challenge (JSON with 'otp' field)
    // This is distinct from a WebAuthn challenge (plain base64 string)
    const cred = creds.find(c => {
      if (!c.current_challenge) return false
      try {
        const ch = JSON.parse(c.current_challenge)
        return typeof ch.otp === 'string' && typeof ch.expires_at === 'string'
      } catch { return false }
    })

    if (!cred) return res.status(400).json({ error: 'No OTP found. Please request a new code.' })

    // Check OTP lockout on the specific credential
    if (cred.otp_locked_until && new Date(cred.otp_locked_until) > new Date()) {
      return res.status(423).json({
        error: `Too many failed attempts. Try again after ${new Date(cred.otp_locked_until).toLocaleTimeString()}.`,
        locked: true,
      })
    }

    let challenge
    try { challenge = JSON.parse(cred.current_challenge) } catch {
      return res.status(400).json({ error: 'Invalid OTP data. Please request a new code.' })
    }

    // Check expiry
    if (!challenge.expires_at || new Date(challenge.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Code has expired. Please request a new one.' })
    }

    // Validate code
    if (String(code).trim().toUpperCase() !== String(challenge.otp).trim().toUpperCase()) {
      const newAttempts = (cred.otp_attempts || 0) + 1
      const shouldLock  = newAttempts >= MAX_OTP_ATTEMPTS

      // Update only this credential — never .eq('user_id') which touches all devices
      await admin.from('biometric_credentials').update({
        otp_attempts:     newAttempts,
        otp_locked_until: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString() : null,
      }).eq('id', cred.id)

      if (shouldLock) sendOtpLockAlert()

      return res.status(401).json({
        error:        `Incorrect code.${!shouldLock ? ` ${MAX_OTP_ATTEMPTS - newAttempts} attempt(s) remaining.` : ''}`,
        locked:       shouldLock,
        attemptsLeft: Math.max(0, MAX_OTP_ATTEMPTS - newAttempts),
      })
    }

    // Success — reset attempts and clear the OTP challenge on this credential only
    await admin.from('biometric_credentials').update({
      otp_attempts:     0,
      otp_locked_until: null,
    }).eq('id', cred.id)
    // Clear challenge in background (non-critical)
    admin.from('biometric_credentials').update({ current_challenge: null }).eq('id', cred.id)

    // Create session directly — no extra verifyOtp round trip needed on the client
    const sessionRes = await fetch(
      `${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}/sessions`,
      {
        method:  'POST',
        headers: {
          'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type':  'application/json',
        },
      }
    )
    if (!sessionRes.ok) return res.status(500).json({ error: 'Failed to create session' })
    const { access_token, refresh_token } = await sessionRes.json()

    res.json({ verified: true, access_token, refresh_token })
  } catch (e) {
    console.error('[backup-otp-verify]', e)
    if (!res.headersSent) res.status(500).json({ error: e.message || 'Internal error' })
  }
}
