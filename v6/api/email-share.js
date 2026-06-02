import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers['authorization'] ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { type, subject, attachment, filename, mimeType } = req.body || {}
  if (!type || !attachment) return res.status(400).json({ error: 'Missing required fields' })

  const toEmail = user.email
  if (!toEmail) return res.status(400).json({ error: 'User has no email address' })

  // Strip data URL prefix (e.g. "data:image/png;base64,...") if present
  const base64Data = attachment.includes(',') ? attachment.split(',')[1] : attachment

  const htmlBody = type === 'pdf'
    ? `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
         <h2 style="color:#4f46e5;margin-top:0">📊 Monthly Expense Report</h2>
         <p style="color:#444">Your expense report is attached as a PDF.</p>
         <p style="font-size:0.8em;color:#888;margin-top:32px">Sent from LA Expense Tracker</p>
       </div>`
    : `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
         <h2 style="color:#4f46e5;margin-top:0">🧾 Receipt Copy</h2>
         <p style="color:#444">Your digital receipt copy is attached for your records.</p>
         <p style="font-size:0.8em;color:#888;margin-top:32px">Sent from LA Expense Tracker</p>
       </div>`

  try {
    await transporter.sendMail({
      from:    `"LA Expense Tracker" <${process.env.GMAIL_USER}>`,
      to:      toEmail,
      subject: subject || (type === 'pdf' ? 'Your Expense Report' : 'Your Receipt Copy'),
      html:    htmlBody,
      attachments: [{
        filename:    filename || (type === 'pdf' ? 'expense-report.pdf' : 'receipt.png'),
        content:     base64Data,
        encoding:    'base64',
        contentType: mimeType || (type === 'pdf' ? 'application/pdf' : 'image/png'),
      }],
    })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('email-share error:', err.message)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}
