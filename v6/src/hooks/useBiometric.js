import { useState, useCallback } from 'react'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { supabase } from '../utils/supabase'

const ENROLLED_KEY = 'et_v6_biometric_enrolled'
const USER_ID_KEY  = 'et_v6_user_id'

export function useBiometric() {
  const [enrolling,       setEnrolling]       = useState(false)
  const [authenticating,  setAuthenticating]  = useState(false)
  const [error,           setError]           = useState(null)

  const isEnrolled = () => localStorage.getItem(ENROLLED_KEY) === 'true'
  const storedUserId = () => localStorage.getItem(USER_ID_KEY)

  const enroll = useCallback(async (session, deviceName) => {
    setEnrolling(true)
    setError(null)
    try {
      const token = session.access_token

      // Get registration options from server
      const optRes = await fetch('/api/biometric-register-options', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (!optRes.ok) throw new Error('Failed to get registration options')
      const options = await optRes.json()

      // Prompt device biometric / PIN
      const credential = await startRegistration({ optionsJSON: options })

      // Send credential to server for verification + storage
      const regRes = await fetch('/api/biometric-register', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, deviceName }),
      })
      if (!regRes.ok) {
        const { error: e } = await regRes.json()
        throw new Error(e || 'Registration failed')
      }

      localStorage.setItem(ENROLLED_KEY, 'true')
      localStorage.setItem(USER_ID_KEY, session.user.id)
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
    if (!userId) { setError('No enrolled credential found.'); setAuthenticating(false); return { success: false } }

    try {
      // Get auth options from server
      const optRes = await fetch('/api/biometric-auth-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (optRes.status === 423) {
        const { message } = await optRes.json()
        throw new Error(message || 'Account temporarily locked.')
      }
      if (!optRes.ok) throw new Error('Failed to get auth options')
      const options = await optRes.json()

      // Prompt device biometric / PIN
      const assertion = await startAuthentication({ optionsJSON: options })

      // Verify with server → get new session tokens
      const verRes = await fetch('/api/biometric-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, assertion }),
      })
      const verData = await verRes.json()
      if (!verRes.ok) {
        if (verData.locked) throw new Error(`Account locked after too many attempts. A security alert has been sent to your email.`)
        const left = verData.attemptsLeft
        throw new Error(`Biometric not recognised.${left > 0 ? ` ${left} attempt(s) remaining.` : ''}`)
      }

      // Restore session client-side
      await supabase.auth.setSession({
        access_token:  verData.access_token,
        refresh_token: verData.refresh_token,
      })

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
      const userId = storedUserId()
      if (userId && session?.access_token) {
        await fetch('/api/biometric-register', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        })
      }
    } catch {}
    localStorage.removeItem(ENROLLED_KEY)
    localStorage.removeItem(USER_ID_KEY)
  }, [])

  return { enroll, authenticate, removeEnrollment, enrolling, authenticating, error, isEnrolled, setError }
}
