import { useState } from 'react'
import { useBiometric } from '../hooks/useBiometric'
import { supabase } from '../utils/supabase'

const EMAIL_KEY        = 'et_v6_user_email'
const BACKUP_EMAIL_KEY = 'et_v6_backup_email'

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

  // The actual OTP email (backup if set, else login email)
  const [otpEmail] = useState(() => {
    const backup = localStorage.getItem(BACKUP_EMAIL_KEY)
    return backup || localStorage.getItem(EMAIL_KEY) || ''
  })

  const [mode, setMode]               = useState('biometric') // 'biometric' | 'otp-confirm' | 'otp-verify'
  const [confirmInput, setConfirmInput] = useState('')
  const [confirmError, setConfirmError] = useState(null)
  const [otp, setOtp]                 = useState('')
  const [otpLoading, setOtpLoading]   = useState(false)
  const [otpError, setOtpError]       = useState(null)

  async function handleUnlock() {
    setError(null)
    const result = await authenticate()
    if (result.success) onUnlocked()
  }

  function handleConfirmEmail() {
    setConfirmError(null)
    if (confirmInput.trim().toLowerCase() !== otpEmail.toLowerCase()) {
      setConfirmError('Email does not match. Please try again.')
      return
    }
    handleSendOtp()
  }

  async function handleSendOtp() {
    setOtpLoading(true)
    setOtpError(null)
    try {
      const { error: e } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: { shouldCreateUser: false },
      })
      if (e) throw new Error(e.message)
      setMode('otp-verify')
    } catch (e) {
      setConfirmError(e.message || 'Failed to send code. Try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setOtpLoading(true)
    setOtpError(null)
    try {
      const { error: e } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otp.trim(),
        type: 'email',
      })
      if (e) throw new Error(e.message)
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
              Can't use biometrics? Sign in with email
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
              {maskEmail(otpEmail)}
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
          </>
        )}

        {/* ── OTP verify mode ── */}
        {mode === 'otp-verify' && (
          <>
            <p className="lock-otp-desc">
              Code sent to <strong>{maskEmail(otpEmail)}</strong>.<br />
              Check your inbox and enter it below.
            </p>

            {otpError && <div className="lock-error">{otpError}</div>}

            <input
              className="lock-otp-input"
              type="text"
              inputMode="numeric"
              maxLength={8}
              placeholder="00000000"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && otp.length >= 6 && handleVerifyOtp()}
            />

            <button className="lock-btn" onClick={handleVerifyOtp}
              disabled={otpLoading || otp.length < 6}>
              {otpLoading
                ? <><span className="lock-spinner" /> Verifying…</>
                : 'Verify Code'}
            </button>

            <button className="lock-fallback-link" onClick={handleSendOtp} disabled={otpLoading}>
              Resend code
            </button>
          </>
        )}
      </div>
    </div>
  )
}
