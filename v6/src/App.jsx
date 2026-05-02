import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { useAuth } from './hooks/useAuth'
import { useSupabaseHeartbeat } from './hooks/useSupabaseHeartbeat'
import Auth from './components/Auth'
import Tracker from './components/Tracker'
import LockScreen from './components/LockScreen'

const ENROLLED_KEY = 'et_v6_biometric_enrolled'
const USER_ID_KEY  = 'et_v6_user_id'
const EMAIL_KEY    = 'et_v6_user_email'

export default function App() {
  const { session, loading } = useAuth()
  useSupabaseHeartbeat(session?.user?.id)

  const [biometricLocked, setBiometricLocked] = useState(
    () => localStorage.getItem(ENROLLED_KEY) === 'true'
  )
  // Prevents Tracker flashing during the sign-out that enforces the lock
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (session && localStorage.getItem(ENROLLED_KEY) === 'true' && biometricLocked) {
      // Skip sign-out if biometric/OTP unlock is actively restoring the session
      if (localStorage.getItem('et_v6_unlocking') === '1') return
      localStorage.setItem(USER_ID_KEY, session.user.id)
      localStorage.setItem(EMAIL_KEY, session.user.email)
      setSigningOut(true)
      supabase.auth.signOut().finally(() => setSigningOut(false))
    }
  }, [session, biometricLocked])

  function handleUnlocked() { setBiometricLocked(false) }

  async function handleSignOut() { await supabase.auth.signOut() }

  if (loading || signingOut) {
    return <div className="app-loading"><div className="spinner" /></div>
  }

  if (biometricLocked) {
    return <LockScreen onUnlocked={handleUnlocked} />
  }

  if (!session) return <Auth />

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-logo">💸 Expense Tracker</span>
        <div className="app-header-right">
          <span className="app-user">{session.user.email}</span>
          <button className="app-signout" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>
      <main className="app-main">
        <Tracker session={session} />
      </main>
    </div>
  )
}
