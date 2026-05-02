import { useState, useCallback } from 'react'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { supabase } from '../utils/supabase'

const ENROLLED_KEY = 'et_v6_biometric_enrolled'
const USER_ID_KEY  = 'et_v6_user_id'
const EMAIL_KEY    = 'et_v6_user_email'

async function safeJson(res) {
  try { return await res.json() } catch { return {} }
}

export function useBiometric() {
  const [enrolling,      setEnrolling]      = useState(false)
  const [authenticating, setAuthenticating] = useState(false)
  const [error,          setError]          = useState(null)

  const isEnrolled  = () => localStorage.getItem(ENROLLED_KEY) === 'true'
  const storedUserId = () => localStorage.getItem(USER_ID_KEY)

  const enroll = useCallback(async (session, deviceName, backupEmail) => {
    setEnrolling(true)
    setError(null)
    try {
      const token = session.access_token

      const optRes = await fetch('/api/biometric-register-options', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (!optRes.ok) {
        const d = await safeJson(optRes)
        throw new Error(d.error || 'Failed to get registration options')
      }
      const options = await optRes.json()

      const credential = await startRegistration({ optionsJSON: options })

      const regRes = await fetch('/api/biometric-register', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, deviceName, backupEmail: backupEmail || '', mainEmail: session.user.email }),
      })
      if (!regRes.ok) {
        const d = await safeJson(regRes)
        throw new Error(d.error || 'Registration failed')
      }

      localStorage.setItem(ENROLLED_KEY, 'true')
      localStorage.setItem(USER_ID_KEY, session.user.id)
      localStorage.setItem(EMAIL_KEY, session.user.email)
      return { success: true }
    } catch (e) {
      const msg = e.name === 'NotAllowedError' ? 'Biometric cancelled or not available on this device.' : e.message
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setEnrolling(false)
    }
  }, [])

  const authenticate = useCallback(async () => {
    setAuthenticating(true)
    setError(null)
    const userId = storedUserId()
    if (!userId) {
      setError('No enrolled credential found.')
      setAuthenticating(false)
      return { success: false }
    }

    try {
      const optRes = await fetch('/api/biometric-auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (optRes.status === 423) {
        const d = await safeJson(optRes)
        throw new Error(d.message || 'Account temporarily locked.')
      }
      if (!optRes.ok) {
        const d = await safeJson(optRes)
        throw new Error(d.error || 'Failed to get auth options')
      }
      const options = await optRes.json()

      const assertion = await startAuthentication({ optionsJSON: options })

      const verRes = await fetch('/api/biometric-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, assertion }),
      })
      const verData = await safeJson(verRes)
      if (!verRes.ok) {
        if (verData.locked) throw new Error('Account locked after too many attempts. A security alert has been sent to your email.')
        const left = verData.attemptsLeft
        throw new Error(`Biometric not recognised.${left > 0 ? ` ${left} attempt(s) remaining.` : ''}`)
      }

      // Flag prevents App.jsx from signing out while session is being restored
      localStorage.setItem('et_v6_unlocking', '1')
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: verData.token_hash,
        type: 'email',
      })
      localStorage.removeItem('et_v6_unlocking')
      if (otpErr) throw new Error('Failed to restore session: ' + otpErr.message)

      return { success: true }
    } catch (e) {
      const msg = e.name === 'NotAllowedError' ? 'Biometric cancelled. Try again.' : e.message
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setAuthenticating(false)
    }
  }, [])

  const removeEnrollment = useCallback(async (session) => {
    try {
      if (session?.access_token) {
        await fetch('/api/biometric-register', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        })
      }
    } catch {}
    localStorage.removeItem(ENROLLED_KEY)
    localStorage.removeItem(USER_ID_KEY)
    localStorage.removeItem(EMAIL_KEY)
    // Sign out current session so user must re-authenticate via magic link
    await supabase.auth.signOut()
  }, [])

  return { enroll, authenticate, removeEnrollment, enrolling, authenticating, error, isEnrolled, setError }
}
