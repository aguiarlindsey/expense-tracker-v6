// HttpOnly cookie endpoint — stores Supabase session server-side
// JS cannot read HttpOnly cookies directly; this endpoint is the only bridge

const COOKIE_NAME = 'sb_session'
const MAX_AGE     = 60 * 60 * 24 * 7 // 7 days — matches Supabase refresh token lifetime

function parseCookies(req) {
  const list = {}
  const rc = req.headers.cookie || ''
  rc.split(';').forEach(c => {
    const [k, ...v] = c.split('=')
    if (k) list[k.trim()] = decodeURIComponent(v.join('=').trim())
  })
  return list
}

function cookieHeader(value, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ]
  return parts.join('; ')
}

export default function handler(req, res) {
  // GET — return session value from cookie (read by custom storage adapter on init)
  if (req.method === 'GET') {
    const cookies = parseCookies(req)
    const value   = cookies[COOKIE_NAME]
    return res.status(200).json({ value: value ? decodeURIComponent(value) : null })
  }

  // POST — set session in HttpOnly cookie (called on sign-in / token refresh)
  if (req.method === 'POST') {
    const { value } = req.body || {}
    if (!value) return res.status(400).json({ error: 'Missing value' })
    res.setHeader('Set-Cookie', cookieHeader(value, MAX_AGE))
    return res.status(200).json({ ok: true })
  }

  // DELETE — clear cookie (called on sign-out)
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieHeader('', 0))
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
