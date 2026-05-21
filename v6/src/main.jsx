import { StrictMode, Component, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './styles/index.css'
import App from './App.jsx'

// Exposed so Settings can call it without prop-drilling
export async function forceAppUpdate() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch (_) {}
  window.location.reload()
}

function PWAUpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateSW } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (!r) return
      // Immediate check on mount — catches the case where a new SW is already waiting
      r.update()
      setInterval(() => r.update(), 30 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') r.update()
      })
    },
  })

  // Also listen for the SW controller change — fires when the new SW takes over
  useEffect(() => {
    const handler = () => setNeedRefresh(true)
    navigator.serviceWorker?.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', handler)
  }, [setNeedRefresh])

  if (!needRefresh) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)',
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.55rem 1rem',
      fontSize: '0.85rem', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      boxShadow: '0 2px 16px rgba(37,99,235,0.45)',
      gap: '0.75rem',
    }}>
      <span style={{ fontWeight: 600 }}>🔄 New version available</span>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button onClick={() => updateSW(true)} style={{
          background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.4)',
          color: '#fff', borderRadius: '6px', padding: '0.25rem 0.8rem',
          fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
        }}>
          Reload now
        </button>
        <button onClick={() => setNeedRefresh(false)} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)',
          fontSize: '1.1rem', cursor: 'pointer', padding: '0 0.2rem', lineHeight: 1,
        }} aria-label="Dismiss">✕</button>
      </div>
    </div>
  )
}

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#ef4444', background: '#0a0a0a', minHeight: '100vh' }}>
          <h2>Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#888', marginTop: 16 }}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <PWAUpdateBanner />
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
