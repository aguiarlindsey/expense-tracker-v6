import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './styles/index.css'
import App from './App.jsx'

function PWAAutoUpdate() {
  useRegisterSW({
    onNeedRefresh() { window.location.reload() },
    onRegisteredSW(_url, r) { r && setInterval(() => r.update(), 60 * 1000) },
  })
  return null
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
      <PWAAutoUpdate />
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
