import { useState, useEffect } from 'react'
import { supabase } from './utils/supabase'
import { useAuth } from './hooks/useAuth'
import { useSupabaseHeartbeat } from './hooks/useSupabaseHeartbeat'
import Auth from './components/Auth'
import Tracker from './components/Tracker'
import LockScreen from './components/LockScreen'

const ENROLLED_KEY = 'et_v6_biometric_enrolled'
const USER_ID_KEY  = 'et_v6_user_id'

export default function App() {
  const { session, loading } = useAuth()
  useSupabaseHeartbeat(session?.user?.id)

  // Biometric lock: starts locked if enrolled
  const [biometricLocked, setBiometricLocked] = useState(
    () => localStorage.getItem(ENROLLED_KEY) === 'true'
  )

  // When a session arrives and biometric is enrolled: sign out to enforce lock
  useEffect(() => {
    if (session && localStorage.getItem(ENROLLED_KEY) === 'true' && biometricLocked) {
      // Store user_id before signing out (needed for biometric-auth-options)
      localStorage.setItem(USER_ID_KEY, session.user.id)
      supabase.auth.signOut()
    }
  }, [session, biometricLocked])

  function handleUnlocked() {
    setBiometricLocked(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading && !biometricLocked) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    )
  }

  // Show lock screen if enrolled and not yet unlocked
  if (biometricLocked) {
    return <LockScreen onUnlocked={handleUnlocked} />
  }

  if (!session) {
    return <Auth />
  }

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
