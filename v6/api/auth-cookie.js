// HttpOnly cookie endpoint — stores Supabase session server-side as a key map
// Supports multiple keys (Supabase uses one primary key but may set/remove others)

const COOKIE_NAME = 'sb_session'
const MAX_AGE     = 60 * 60 * 24 * 7 // 7 days

function parseCookies(req) {
  const list = {}
  const rc = req.headers.cookie || ''
  rc.split(';').forEach(c => {
    const idx = c.indexOf('=')
    if (idx < 0) return
    const k = c.slice(0, idx).trim()
    const v = c.slice(idx + 1).trim()
    list[k] = v
  })
  return list
}

function readMap(req) {
  const cookies = parseCookies(req)
  const raw = cookies[COOKIE_NAME]
  if (!raw) return {}
  try { return JSON.parse(decodeURIComponent(raw)) } catch { return {} }
}

function setCookieHeader(map, maxAge) {
  const encoded = encodeURIComponent(JSON.stringify(map))
  return [
    `${COOKIE_NAME}=${encoded}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ')
}

export default function handler(req, res) {
  // GET ?key=xxx — return value for a specific key
  if (req.method === 'GET') {
    const key = req.query?.key
    if (!key) return res.status(400).json({ error: 'Missing key' })
    const map = readMap(req)
    return res.status(200).json({ value: map[key] || null })
  }

  // POST { key, value } — set a key in the map
  if (req.method === 'POST') {
    const { key, value } = req.body || {}
    if (!key || value === undefined) return res.status(400).json({ error: 'Missing key or value' })
    const map = readMap(req)
    map[key] = value
    res.setHeader('Set-Cookie', setCookieHeader(map, MAX_AGE))
    return res.status(200).json({ ok: true })
  }

  // DELETE ?key=xxx — remove only that key from the map
  if (req.method === 'DELETE') {
    const key = req.query?.key
    if (!key) return res.status(400).json({ error: 'Missing key' })
    const map = readMap(req)
    delete map[key]
    const maxAge = Object.keys(map).length === 0 ? 0 : MAX_AGE
    res.setHeader('Set-Cookie', setCookieHeader(map, maxAge))
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
