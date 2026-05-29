import { StrictMode, Component, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './styles/index.css'
import App from './App.jsx'

// On every load: unregister any stale SW and wipe all caches
// This runs once per page load (not per render), ensuring deploys land immediately
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  }).catch(() => {})
}
if ('caches' in window) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
}

// Synchronous reload — works in iOS Safari PWA standalone mode
// Must be called directly from a click handler, not inside async/await
function hardReload() {
  // Fire-and-forget SW + cache cleanup, then navigate synchronously
  try {
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => r.unregister())).catch(() => {})
    if ('caches' in window)
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {})
  } catch (_) {}
  // location.replace stays within the PWA on iOS (doesn't open browser)
  window.location.replace(window.location.pathname)
}

// Exposed so Settings button can call it directly
window.__forceAppUpdate = hardReload

function PWAUpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh] } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (!r) return
      r.update() // immediate check on mount
      setInterval(() => r.update(), 30 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') r.update()
      })
    },
    onNeedRefresh() { /* handled via state above */ },
  })

  useEffect(() => {
    const handler = () => setNeedRefresh(true)
    navigator.serviceWorker?.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', handler)
  }, [setNeedRefresh])

  if (!needRefresh) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)',
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 'env(safe-area-inset-top, 0px) 1rem 0.55rem',
      fontSize: '0.85rem', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      boxShadow: '0 2px 16px rgba(37,99,235,0.45)',
      gap: '0.75rem',
    }}>
      <span style={{ fontWeight: 600 }}>🔄 New version available</span>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={hardReload}
          style={{
            background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.4)',
            color: '#fff', borderRadius: '6px', padding: '0.35rem 1rem',
            fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
            minHeight: 36, minWidth: 100,
          }}>
          Reload now
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)',
            fontSize: '1.3rem', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1,
            minHeight: 36, minWidth: 36,
          }}
          aria-label="Dismiss">✕</button>
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
