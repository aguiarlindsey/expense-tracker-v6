import { useState } from 'react'
import { useBiometric } from '../hooks/useBiometric'
import { supabase } from '../utils/supabase'

const EMAIL_KEY = 'et_v6_user_email'

export default function LockScreen({ onUnlocked }) {
  const { authenticate, authenticating, error, setError } = useBiometric()

  const [mode, setMode]           = useState('biometric') // 'biometric' | 'otp-send' | 'otp-verify'
  const [email]                   = useState(() => localStorage.getItem(EMAIL_KEY) || '')
  const [otp, setOtp]             = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError]   = useState(null)
  const [otpSent, setOtpSent]     = useState(false)

  async function handleUnlock() {
    setError(null)
    const result = await authenticate()
    if (result.success) onUnlocked()
  }

  async function handleSendOtp() {
    setOtpLoading(true)
    setOtpError(null)
    try {
      const { error: e } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      if (e) throw new Error(e.message)
      setOtpSent(true)
      setMode('otp-verify')
    } catch (e) {
      setOtpError(e.message || 'Failed to send code. Try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setOtpLoading(true)
    setOtpError(null)
    try {
      const { error: e } = await supabase.auth.verifyOtp({
        email,
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

            <button className="lock-fallback-link" onClick={() => { setError(null); setMode('otp-send') }}>
              Can't use biometrics? Sign in with email
            </button>
          </>
        )}

        {/* ── OTP send mode ── */}
        {mode === 'otp-send' && (
          <>
            <p className="lock-otp-desc">
              We'll send a one-time code to<br />
              <strong>{email || 'your registered email'}</strong>
            </p>

            {otpError && <div className="lock-error">{otpError}</div>}

            <button className="lock-btn" onClick={handleSendOtp} disabled={otpLoading}>
              {otpLoading
                ? <><span className="lock-spinner" /> Sending…</>
                : '📧 Send One-Time Code'}
            </button>

            <button className="lock-fallback-link" onClick={() => { setOtpError(null); setMode('biometric') }}>
              ← Back to biometrics
            </button>
          </>
        )}

        {/* ── OTP verify mode ── */}
        {mode === 'otp-verify' && (
          <>
            <p className="lock-otp-desc">
              Code sent to <strong>{email}</strong>.<br />
              Check your inbox and enter it below.
            </p>

            {otpError && <div className="lock-error">{otpError}</div>}

            <input
              className="lock-otp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />

            <button
              className="lock-btn"
              onClick={handleVerifyOtp}
              disabled={otpLoading || otp.length < 6}
            >
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
