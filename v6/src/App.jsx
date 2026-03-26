import { supabase } from './utils/supabase'
import { useAuth } from './hooks/useAuth'
import Auth from './components/Auth'
import Tracker from './components/Tracker'

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
        <Tracker session={session} />
      </main>
    </div>
  )
}
