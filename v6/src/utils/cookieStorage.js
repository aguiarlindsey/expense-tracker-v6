// Async storage adapter for Supabase client
// Replaces localStorage — tokens stored in HttpOnly cookie via /api/auth-cookie
// Supabase calls getItem/setItem/removeItem with a single key (sb-[ref]-auth-token)

async function getItem() {
  try {
    const res = await fetch('/api/auth-cookie', { credentials: 'include' })
    if (!res.ok) return null
    const { value } = await res.json()
    return value || null
  } catch {
    return null
  }
}

async function setItem(_key, value) {
  try {
    await fetch('/api/auth-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ value }),
    })
  } catch {}
}

async function removeItem() {
  try {
    await fetch('/api/auth-cookie', {
      method: 'DELETE',
      credentials: 'include',
    })
  } catch {}
}

export const cookieStorage = { getItem, setItem, removeItem }
