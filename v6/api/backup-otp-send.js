import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import crypto from 'crypto'

// Excludes O, 0, I, 1 to avoid visual confusion
function generateOTP(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.randomBytes(length)).map(b => chars[b % chars.length]).join('')
}

// Reuse transporter across calls in the same function instance
const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true, // keep SMTP connection alive
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

    // Run getUserById and generateLink sequentially (generateLink needs the email)
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId)
    if (userErr || !userData?.user) return res.status(404).json({ error: 'User not found' })

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type:  'magiclink',
      email: userData.user.email,
    })
    if (linkErr || !linkData?.properties) return res.status(500).json({ error: 'Failed to generate OTP' })

    const otpCode   = generateOTP(8)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const challenge = JSON.stringify({ otp: otpCode, token_hash: linkData.properties.hashed_token, expires_at: expiresAt })

    // Parallel: save to DB and send email at the same time
    await Promise.all([
      admin.from('biometric_credentials')
        .update({ current_challenge: challenge })
        .eq('user_id', userId),
      transporter.sendMail({
        from:    `"LA Expense Tracker" <${process.env.GMAIL_USER}>`,
        to:      backupEmail,
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
