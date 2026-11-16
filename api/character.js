// GET /api/character?target=cloud|onprem
//
// Convai auth: the API keys stay here, on the server. For the character the
// page asks for, this mints a short-lived auth token from that deployment's
// /user/connect and returns it with the character id (and, for the on-prem
// install, its URL). The browser only ever holds the token.
//
// Runs as a Vercel function in production and as Vite middleware in `pnpm dev`
// (see vite.config.js), so the same code serves both.

const CLOUD_URL = 'https://api.convai.com'

function targets(env) {
  return {
    cloud: {
      label: 'Convai Cloud',
      baseUrl: CLOUD_URL,
      apiKey: env.CONVAI_API_KEY,
      characterId: env.CONVAI_CHARACTER_ID,
    },
    onprem: {
      label: 'On-prem',
      baseUrl: env.CONVAI_ONPREM_URL,
      apiKey: env.CONVAI_ONPREM_API_KEY,
      characterId: env.CONVAI_ONPREM_CHARACTER_ID,
    },
  }
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res, env = process.env) {
  // Only this page may ask: a browser on another site sends Sec-Fetch-Site: cross-site.
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin') return send(res, 403, { error: 'Requests must come from this page.' })

  const name = new URL(req.url, 'http://localhost').searchParams.get('target')
  const t = targets(env)[name]
  if (!t) return send(res, 400, { error: 'target must be "cloud" or "onprem".' })
  if (!t.baseUrl || !t.apiKey || !t.characterId) return send(res, 503, { error: `${t.label} is not configured on the server.` })

  const r = await fetch(`${t.baseUrl}/user/connect`, {
    method: 'POST',
    headers: { 'CONVAI-API-KEY': t.apiKey, 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => null)
  if (!r?.ok) return send(res, 502, { error: `Could not get a token from ${t.label} (${r ? r.status : 'no response'}).` })
  const { apiAuthToken, expirationTime } = await r.json()

  return send(res, 200, {
    target: name,
    label: t.label,
    token: apiAuthToken,
    expiresAt: expirationTime,
    characterId: t.characterId,
    // Only the on-prem install needs its URL; the cloud is embody's default.
    onPrem: t.baseUrl === CLOUD_URL ? undefined : t.baseUrl,
  })
}
