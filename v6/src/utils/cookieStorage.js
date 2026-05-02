// Async storage adapter for Supabase client
// Stores tokens in HttpOnly cookie via /api/auth-cookie as a key→value map
// Each Supabase storage key gets its own entry — removeItem is key-specific

async function getItem(key) {
  try {
    const res = await fetch(`/api/auth-cookie?key=${encodeURIComponent(key)}`, {
      credentials: 'include',
    })
    if (!res.ok) return null
    const { value } = await res.json()
    return value || null
  } catch {
    return null
  }
}

async function setItem(key, value) {
  try {
    await fetch('/api/auth-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key, value }),
    })
  } catch {}
}

async function removeItem(key) {
  try {
    await fetch(`/api/auth-cookie?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
  } catch {}
}

export const cookieStorage = { getItem, setItem, removeItem }
