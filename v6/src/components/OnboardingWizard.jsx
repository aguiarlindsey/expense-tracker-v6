import { useState } from 'react'
import { supabase } from '../utils/supabase'

// Phase 4.1 shell — detection + routing only.
// Full 5-step wizard built in Phase 4.2.

export default function OnboardingWizard({ session, onComplete }) {
  const [loading, setLoading] = useState(false)

  async function handleGetStarted() {
    setLoading(true)
    await supabase.auth.updateUser({ data: { onboarded: true } })
    onComplete()
  }

  return (
    <div className="onb-shell">
      <div className="onb-card">
        <div className="onb-logo">💸</div>
        <h1 className="onb-title">Welcome to Expense Tracker</h1>
        <p className="onb-sub">
          Hi {session.user.email.split('@')[0]} — let's get you set up in under 2 minutes.
        </p>
        <button className="onb-btn-primary" onClick={handleGetStarted} disabled={loading}>
          {loading ? 'Setting up…' : 'Get Started →'}
        </button>
        <button className="onb-btn-skip" onClick={onComplete} disabled={loading}>
          Skip setup, take me to the app
        </button>
      </div>
    </div>
  )
}
