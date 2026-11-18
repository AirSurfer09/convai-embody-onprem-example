// GET /api/character?target=cloud|onprem
//
// Convai auth: the API keys stay here, on the server. For the character the
// page asks for, this mints a short-lived auth token from that deployment's
// /user/connect and returns it with the character id (and, for the on-prem
// install, its URL). The browser only ever holds the token.
//
// Every failure answers { error, code, retryable }: `error` is a sentence the
// page can show as is, `code` lets it branch, `retryable` says whether trying
// again can help.
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
      vars: ['CONVAI_API_KEY', 'CONVAI_CHARACTER_ID'],
    },
    onprem: {
      label: 'On-prem',
      baseUrl: env.CONVAI_ONPREM_URL,
      apiKey: env.CONVAI_ONPREM_API_KEY,
      characterId: env.CONVAI_ONPREM_CHARACTER_ID,
      vars: ['CONVAI_ONPREM_URL', 'CONVAI_ONPREM_API_KEY', 'CONVAI_ONPREM_CHARACTER_ID'],
    },
  }
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}
const fail = (res, status, code, error, retryable) => send(res, status, { error, code, retryable })

export default async function handler(req, res, env = process.env) {
  try {
    // Only this page may ask: a browser on another site sends Sec-Fetch-Site: cross-site.
    const site = req.headers['sec-fetch-site']
    if (site && site !== 'same-origin') return fail(res, 403, 'forbidden', 'Requests must come from this page.', false)

    const name = new URL(req.url, 'http://localhost').searchParams.get('target')
    const t = targets(env)[name]
    if (!t) return fail(res, 400, 'bad-target', 'Unknown character: choose Convai Cloud or On-prem.', false)
    const missing = t.vars.filter((v) => !env[v])
    if (missing.length) {
      return fail(res, 503, 'not-configured', `${t.label} is not set up on this server yet (missing ${missing.join(', ')}).`, false)
    }

    let r
    try {
      r = await fetch(`${t.baseUrl.replace(/\/+$/, '')}/user/connect`, {
        method: 'POST',
        headers: { 'CONVAI-API-KEY': t.apiKey, 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(15000),
      })
    } catch (e) {
      const timedOut = e?.name === 'TimeoutError'
      return fail(res, 502, 'deployment-unreachable', `${t.label} did not ${timedOut ? 'answer in time' : 'respond'} (${t.baseUrl}). It may be down or unreachable from this server; try again shortly.`, true)
    }
    if (r.status === 401 || r.status === 403) {
      return fail(res, 502, 'key-refused', `${t.label} refused this server's API key. The key may be wrong, revoked, or for another deployment.`, false)
    }
    if (!r.ok) {
      return fail(res, 502, 'token-failed', `${t.label} could not issue a token (HTTP ${r.status}). Try again shortly.`, r.status >= 500)
    }
    const body = await r.json().catch(() => ({}))
    if (!body.apiAuthToken) {
      return fail(res, 502, 'token-failed', `${t.label} answered without a token. Try again shortly.`, true)
    }

    return send(res, 200, {
      target: name,
      label: t.label,
      token: body.apiAuthToken,
      expiresAt: body.expirationTime,
      characterId: t.characterId,
      // Only the on-prem install needs its URL; the cloud is embody's default.
      onPrem: t.baseUrl === CLOUD_URL ? undefined : t.baseUrl,
    })
  } catch (e) {
    return fail(res, 500, 'server-error', 'Something went wrong on this server while preparing the character. Try again.', true)
  }
}
