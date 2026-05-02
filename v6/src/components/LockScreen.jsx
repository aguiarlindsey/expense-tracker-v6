import { useState } from 'react'
import { useBiometric } from '../hooks/useBiometric'
import { supabase } from '../utils/supabase'

const EMAIL_KEY        = 'et_v6_user_email'
const BACKUP_EMAIL_KEY = 'et_v6_backup_email'
const USER_ID_KEY      = 'et_v6_user_id'

function maskEmail(email) {
  if (!email) return ''
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length <= 2) return `${local[0]}*@${domain}`
  const masked = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
  return `${masked}@${domain}`
}

export default function LockScreen({ onUnlocked }) {
  const { authenticate, authenticating, error, setError } = useBiometric()

  const [backupEmail] = useState(() => localStorage.getItem(BACKUP_EMAIL_KEY) || localStorage.getItem(EMAIL_KEY) || '')
  const [mainEmail]   = useState(() => localStorage.getItem(EMAIL_KEY) || '')
  const [userId]      = useState(() => localStorage.getItem(USER_ID_KEY) || '')

  const [mode, setMode]                 = useState('biometric') // 'biometric' | 'otp-confirm' | 'otp-verify' | 'magic-link'
  const [confirmInput, setConfirmInput] = useState('')
  const [confirmError, setConfirmError] = useState(null)
  const [otp, setOtp]                   = useState('')
  const [otpLoading, setOtpLoading]     = useState(false)
  const [otpError, setOtpError]         = useState(null)

  const [magicEmail,   setMagicEmail]   = useState(() => localStorage.getItem(EMAIL_KEY) || '')
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicSent,    setMagicSent]    = useState(false)
  const [magicError,   setMagicError]   = useState(null)

  async function handleUnlock() {
    setError(null)
    const result = await authenticate()
    if (result.success) onUnlocked()
  }

  async function handleConfirmEmail() {
    setConfirmError(null)
    if (confirmInput.trim().toLowerCase() !== backupEmail.toLowerCase()) {
      setConfirmError('Email does not match. Please try again.')
      return
    }
    setOtpLoading(true)
    try {
      const res = await fetch('/api/backup-otp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, backupEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setMode('otp-verify')
    } catch (e) {
      setConfirmError(e.message || 'Failed to send code. Try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleResendOtp() {
    setOtpLoading(true)
    setOtpError(null)
    try {
      const res = await fetch('/api/backup-otp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, backupEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resend code')
    } catch (e) {
      setOtpError(e.message)
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleSendMagicLink() {
    setMagicLoading(true)
    setMagicError(null)
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: magicEmail.trim().toLowerCase(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (err) throw new Error(err.message)
      setMagicSent(true)
    } catch (e) {
      setMagicError(e.message || 'Failed to send link. Try again.')
    } finally {
      setMagicLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setOtpLoading(true)
    setOtpError(null)
    try {
      const res = await fetch('/api/backup-otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: otp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')

      // Restore MAIN account session using the hashed token
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'email',
      })
      if (otpErr) throw new Error('Failed to restore session: ' + otpErr.message)
      onUnlocked()
    } catch (e) {
      setOtpError(e.message || 'Invalid or expired code. Try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-icon">💸</div>
        <h1 className="lock-title">LA Expense Tracker</h1>
        <p className="lock-subtitle">Verify your identity to continue</p>

        {/* ── Biometric mode ── */}
        {mode === 'biometric' && (
          <>
            {error && <div className="lock-error">{error}</div>}

            <button className="lock-btn" onClick={handleUnlock} disabled={authenticating}>
              {authenticating
                ? <><span className="lock-spinner" /> Verifying…</>
                : '🔐 Unlock with Biometrics / PIN'}
            </button>

            <p className="lock-hint">Use your device fingerprint, face, or PIN</p>

            <button className="lock-fallback-link"
              onClick={() => { setError(null); setConfirmError(null); setConfirmInput(''); setMode('otp-confirm') }}>
              Can't use biometrics? Use backup email code
            </button>
            <button className="lock-fallback-link"
              onClick={() => { setError(null); setMagicError(null); setMagicSent(false); setMode('magic-link') }}>
              Send a magic link to my email
            </button>
          </>
        )}

        {/* ── OTP confirm email mode ── */}
        {mode === 'otp-confirm' && (
          <>
            <p className="lock-otp-desc">
              Confirm your backup email address to receive a one-time code.
            </p>

            <div className="lock-email-hint">
              {maskEmail(backupEmail)}
            </div>

            {confirmError && <div className="lock-error">{confirmError}</div>}

            <input
              className="lock-otp-confirm-input"
              type="email"
              placeholder="Enter your backup email"
              value={confirmInput}
              onChange={e => { setConfirmInput(e.target.value); setConfirmError(null) }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleConfirmEmail()}
            />

            <button className="lock-btn" onClick={handleConfirmEmail} disabled={otpLoading || !confirmInput.trim()}>
              {otpLoading
                ? <><span className="lock-spinner" /> Sending…</>
                : '📧 Send One-Time Code'}
            </button>

            <button className="lock-fallback-link"
              onClick={() => { setConfirmError(null); setConfirmInput(''); setMode('biometric') }}>
              ← Back to biometrics
            </button>
            <button className="lock-fallback-link"
              onClick={() => { setMagicError(null); setMagicSent(false); setMode('magic-link') }}>
              Don't know your backup email? Send a magic link
            </button>
          </>
        )}

        {/* ── Magic link mode ── */}
        {mode === 'magic-link' && (
          <>
            {!magicSent ? (
              <>
                <p className="lock-otp-desc">
                  Enter your account email and we'll send you a sign-in link. No backup email needed.
                </p>

                {magicError && <div className="lock-error">{magicError}</div>}

                <input
                  className="lock-otp-confirm-input"
                  type="email"
                  placeholder="your@email.com"
                  value={magicEmail}
                  onChange={e => { setMagicEmail(e.target.value); setMagicError(null) }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && magicEmail.trim() && handleSendMagicLink()}
                />

                <button className="lock-btn" onClick={handleSendMagicLink}
                  disabled={magicLoading || !magicEmail.trim()}>
                  {magicLoading
                    ? <><span className="lock-spinner" /> Sending…</>
                    : '✉️ Send Magic Link'}
                </button>
              </>
            ) : (
              <>
                <div className="lock-magic-sent">✅</div>
                <p className="lock-otp-desc">
                  Magic link sent to <strong>{magicEmail}</strong>.<br />
                  Check your inbox and click the link — this window will unlock automatically.
                </p>
              </>
            )}

            <button className="lock-fallback-link"
              onClick={() => { setMagicError(null); setMagicSent(false); setMode('biometric') }}>
              ← Back to biometrics
            </button>
          </>
        )}

        {/* ── OTP verify mode ── */}
        {mode === 'otp-verify' && (
          <>
            <p className="lock-otp-desc">
              Code sent to <strong>{maskEmail(backupEmail)}</strong>.<br />
              Check your inbox and enter it below.
            </p>

            {otpError && <div className="lock-error">{otpError}</div>}

            <input
              className="lock-otp-input"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              maxLength={8}
              placeholder="XXXXXXXX"
              value={otp}
              onChange={e => setOtp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && otp.length >= 6 && handleVerifyOtp()}
            />

            <button className="lock-btn" onClick={handleVerifyOtp}
              disabled={otpLoading || otp.length < 6}>
              {otpLoading
                ? <><span className="lock-spinner" /> Verifying…</>
                : 'Verify Code'}
            </button>

            <button className="lock-fallback-link" onClick={handleResendOtp} disabled={otpLoading}>
              Resend code
            </button>
          </>
        )}
      </div>
    </div>
  )
}
