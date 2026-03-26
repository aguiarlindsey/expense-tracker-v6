import { supabase } from './utils/supabase'
import { useAuth } from './hooks/useAuth'
import Auth from './components/Auth'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
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
        <p style={{ textAlign: 'center', opacity: 0.5, marginTop: '4rem' }}>
          Phase 1 complete — expense UI coming in Phase 2.
        </p>
      </main>
    </div>
  )
}
