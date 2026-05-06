import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

function generateOTP(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.randomBytes(length)).map(b => chars[b % chars.length]).join('')
}

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

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end()

    const { userId, backupEmail } = req.body
    if (!userId || !backupEmail) return res.status(400).json({ error: 'Missing fields' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backupEmail)) return res.status(400).json({ error: 'Invalid email format' })

    // Fetch ALL credentials — .limit(1) picks the wrong row when PC + phone are both enrolled
    const { data: creds } = await admin
      .from('biometric_credentials')
      .select('id, backup_email, main_email, last_otp_sent_at, otp_locked_until, otp_attempts')
      .eq('user_id', userId)

    if (!creds || creds.length === 0) {
      return res.status(404).json({ error: 'No credential enrolled for this account' })
    }

    // Find the credential whose backup_email or main_email matches the input
    const inputEmail = backupEmail.toLowerCase()
    const cred = creds.find(c =>
      [c.backup_email, c.main_email].filter(Boolean).some(e => e.toLowerCase() === inputEmail)
    )
    if (!cred) return res.status(403).json({ error: 'Email does not match our records.' })

    // OTP lock check
    if (cred.otp_locked_until && new Date(cred.otp_locked_until) > new Date()) {
      return res.status(423).json({
        error: `Too many failed attempts. Try again after ${new Date(cred.otp_locked_until).toLocaleTimeString()}.`,
      })
    }

    // Rate limit: max 1 per 60s
    if (cred.last_otp_sent_at) {
      const secondsSince = (Date.now() - new Date(cred.last_otp_sent_at).getTime()) / 1000
      if (secondsSince < 60) {
        const wait = Math.ceil(60 - secondsSince)
        return res.status(429).json({ error: `Please wait ${wait}s before requesting another code.` })
      }
    }
    if ((cred.otp_attempts || 0) >= 10) {
      return res.status(429).json({ error: 'Daily OTP limit reached. Try again tomorrow or use biometrics.' })
    }

    const otpCode   = generateOTP(8)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    // No token_hash stored — backup-otp-verify creates the session directly via admin API
    const challenge = JSON.stringify({ otp: otpCode, expires_at: expiresAt })
    const sendTo    = cred.backup_email || backupEmail

    // Store OTP only on the matching credential row — not all user credentials
    await Promise.all([
      admin.from('biometric_credentials')
        .update({ current_challenge: challenge, otp_attempts: 0, last_otp_sent_at: new Date().toISOString() })
        .eq('id', cred.id),
      transporter.sendMail({
        from:    `"LA Expense Tracker" <${process.env.GMAIL_USER}>`,
        to:      sendTo,
        subject: '🔐 Your LA Expense Tracker sign-in code',
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:auto">
            <h2>LA Expense Tracker — Sign In Code</h2>
            <p>Your one-time sign-in code is:</p>
            <h1 style="font-size:2.2rem;letter-spacing:0.35em;font-family:monospace;color:#2563eb">${otpCode}</h1>
            <p>Enter this code on the lock screen. It expires in <strong>10 minutes</strong>.</p>
            <p style="color:#555;font-size:0.88rem">Code is case-insensitive. Characters I, O, 0 and 1 are not used.</p>
            <hr/>
            <p style="color:#888;font-size:0.82rem">If you didn't request this, someone may be trying to access your account.</p>
          </div>
        `,
      }),
    ])

    res.json({ sent: true })
  } catch (e) {
    console.error('[backup-otp-send]', e)
    if (!res.headersSent) res.status(500).json({ error: e.message || 'Internal error' })
  }
}
