import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { supabase } from './utils/supabase'
import { useAuth } from './hooks/useAuth'
import { useSupabaseHeartbeat } from './hooks/useSupabaseHeartbeat'
import Auth from './components/Auth'
import Tracker from './components/Tracker'
import LockScreen from './components/LockScreen'
import OnboardingWizard from './components/OnboardingWizard'

const ENROLLED_KEY      = 'et_v6_biometric_enrolled'
const USER_ID_KEY       = 'et_v6_user_id'
const EMAIL_KEY         = 'et_v6_user_email'
const BACKUP_EMAIL_KEY  = 'et_v6_backup_email'
const CREDENTIAL_ID_KEY = 'et_v6_credential_id'

export default function App() {
  const { session, loading } = useAuth()
  useSupabaseHeartbeat(session?.user?.id)

  const [biometricLocked, setBiometricLocked] = useState(
    () => localStorage.getItem(ENROLLED_KEY) === 'true'
  )
  // Local flag so UI switches to Tracker immediately after wizard — no session refresh wait
  const [completedOnboarding, setCompletedOnboarding] = useState(false)
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

  function handleUnlocked() {
    setBiometricLocked(false)
    // Clear after React commits biometricLocked=false — prevents sign-out effect
    // from seeing session=valid + biometricLocked=true + flag=null between state updates
    requestAnimationFrame(() => localStorage.removeItem('et_v6_unlocking'))
  }

  async function handleSignOut() {
    // These keys are singular, not per-account — on a browser used for more
    // than one account (e.g. testing Connections), leaving them set after
    // sign-out means the next sign-in inherits a stale et_v6_user_id, and a
    // future biometric unlock can silently restore the WRONG account's
    // session via verifyOtp(). Clear them here, same list as useBiometric's
    // removeEnrollment(), so every sign-out starts the next session clean.
    localStorage.removeItem(ENROLLED_KEY)
    localStorage.removeItem(USER_ID_KEY)
    localStorage.removeItem(EMAIL_KEY)
    localStorage.removeItem(BACKUP_EMAIL_KEY)
    localStorage.removeItem(CREDENTIAL_ID_KEY)
    await supabase.auth.signOut()
  }

  if (loading || signingOut) {
    return <div className="app-loading"><div className="spinner" /></div>
  }

  if (biometricLocked) {
    return <LockScreen onUnlocked={handleUnlocked} />
  }

  if (!session) return <Auth />

  const isOnboarded = completedOnboarding || session.user.user_metadata?.onboarded === true
  if (!isOnboarded) {
    return <OnboardingWizard session={session} onComplete={() => setCompletedOnboarding(true)} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-logo" style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}><Zap size={16} color="var(--primary)" />Expense Tracker</span>
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
