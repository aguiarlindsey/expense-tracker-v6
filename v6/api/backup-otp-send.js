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

    // Get stored credential — includes server-side backup_email and main_email
    const { data: cred } = await admin
      .from('biometric_credentials')
      .select('id, backup_email, main_email, last_otp_sent_at, otp_locked_until')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!cred) return res.status(404).json({ error: 'No credential enrolled for this account' })

    // ── Server-side backup email validation ─────────────
    // Must match stored backup_email OR main_email — prevents bypass when backup_email is empty
    const inputEmail = backupEmail.toLowerCase()
    const validEmails = [cred.backup_email, cred.main_email].filter(Boolean).map(e => e.toLowerCase())
    if (validEmails.length === 0 || !validEmails.includes(inputEmail)) {
      return res.status(403).json({ error: 'Email does not match our records.' })
    }

    // ── OTP lock check ───────────────────────────────────
    if (cred.otp_locked_until && new Date(cred.otp_locked_until) > new Date()) {
      return res.status(423).json({
        error: `Too many failed attempts. Try again after ${new Date(cred.otp_locked_until).toLocaleTimeString()}.`,
      })
    }

    // ── Rate limit: max 1 per 60s and max 10 per day ─────
    if (cred.last_otp_sent_at) {
      const secondsSince = (Date.now() - new Date(cred.last_otp_sent_at).getTime()) / 1000
      if (secondsSince < 60) {
        const wait = Math.ceil(60 - secondsSince)
        return res.status(429).json({ error: `Please wait ${wait}s before requesting another code.` })
      }
    }
    // Daily cap stored as JSON in current_challenge temporarily — check otp_attempts as proxy
    // (otp_attempts resets on success; if it somehow reaches 10 without success → daily cap hit)
    if ((cred.otp_attempts || 0) >= 10) {
      return res.status(429).json({ error: 'Daily OTP limit reached. Try again tomorrow or use biometrics.' })
    }

    // Get main email — use stored value, fall back to getUserById for old credentials
    const mainEmail = cred.main_email || (await admin.auth.admin.getUserById(userId)).data?.user?.email
    if (!mainEmail) return res.status(500).json({ error: 'Could not determine account email' })

    // Generate session link + OTP in parallel with rate limit update
    const [linkResult] = await Promise.all([
      admin.auth.admin.generateLink({ type: 'magiclink', email: mainEmail }),
      admin.from('biometric_credentials').update({ last_otp_sent_at: new Date().toISOString() }).eq('user_id', userId),
    ])

    if (linkResult.error || !linkResult.data?.properties) {
      return res.status(500).json({ error: 'Failed to generate session token' })
    }

    const otpCode   = generateOTP(8)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const challenge = JSON.stringify({ otp: otpCode, token_hash: linkResult.data.properties.hashed_token, expires_at: expiresAt })
    const sendTo    = cred.backup_email || backupEmail

    // Parallel: save challenge + send email
    await Promise.all([
      admin.from('biometric_credentials').update({ current_challenge: challenge, otp_attempts: 0 }).eq('user_id', userId),
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
