import { useBiometric } from '../hooks/useBiometric'

export default function LockScreen({ onUnlocked }) {
  const { authenticate, authenticating, error, setError } = useBiometric()

  async function handleUnlock() {
    setError(null)
    const result = await authenticate()
    if (result.success) onUnlocked()
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-icon">💸</div>
        <h1 className="lock-title">LA Expense Tracker</h1>
        <p className="lock-subtitle">Verify your identity to continue</p>

        {error && <div className="lock-error">{error}</div>}

        <button
          className="lock-btn"
          onClick={handleUnlock}
          disabled={authenticating}
        >
          {authenticating ? (
            <><span className="lock-spinner" /> Verifying…</>
          ) : (
            '🔐 Unlock with Biometrics / PIN'
          )}
        </button>

        <p className="lock-hint">
          Use your device fingerprint, face, or PIN
        </p>
      </div>
    </div>
  )
}
