import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ConvaiCharacter from '@convai/embody/react'
import { ConvaiWidget } from '@convai/web-widget/react'

const TARGETS = [
  { id: 'cloud', label: 'Convai Cloud' },
  { id: 'onprem', label: 'On-prem' },
]

// Session options shared by both characters. The voice comes over the data
// channel next to its lipsync, and the SDK plays only what the face can move to.
const SESSION = {
  endUserId: 'embody-example-visitor',
  audioRouting: 'data_only',
}

/** Problems the page shows; embody's EmbodyError has the same shape. */
function problem(code, message, retryable, extra = {}) {
  return { code, message, retryable, ...extra }
}

/** Ask this site's server for a short-lived Convai auth token and the character to show. */
async function fetchCharacter(target) {
  let r
  try {
    r = await fetch(`/api/character?target=${target}`)
  } catch {
    throw problem('offline', "Couldn't reach this site's server. Check your internet connection and try again.", true)
  }
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw problem(body.code || `http-${r.status}`, body.error || `This site's server answered with an error (HTTP ${r.status}).`, body.retryable ?? r.status >= 500)
  return body
}

const TITLES = {
  'not-configured': 'This character is not set up yet',
  'key-refused': 'The server could not sign in to Convai',
  'deployment-unreachable': 'The Convai deployment is not reachable',
  offline: "You're offline",
  unauthorized: 'Access was refused',
  'character-not-found': 'Character not found',
  'no-body': 'This character has no 3D body',
  capacity: 'Busy right now',
  network: 'Could not reach Convai',
  'body-download': 'The 3D body did not download',
  connection: 'Could not connect to the character',
  webgl: "Your browser can't show 3D here",
  'connection-lost': 'Connection lost',
}

function Switcher({ target, onChange }) {
  return (
    <div style={styles.switcher} role="group" aria-label="Choose the character">
      {TARGETS.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} aria-pressed={target === t.id} style={{ ...styles.button, ...(target === t.id ? styles.active : null) }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Shown while the body downloads; after a while, says why it can take long. */
function Loading({ label }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const iv = setInterval(() => setSeconds(Math.round((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [])
  return (
    <div style={styles.center} role="status" aria-live="polite">
      <div style={styles.card}>
        <p style={styles.title}>Loading {label}…</p>
        {seconds >= 15 && (
          <p style={styles.text}>
            {seconds} s. The 3D body is a large download (tens of MB); the first load can take a few minutes on a slow connection. Later loads are faster.
          </p>
        )}
      </div>
    </div>
  )
}

function Problem({ problem: p, onRetry }) {
  const [details, setDetails] = useState(false)
  return (
    <div style={styles.center} role="alert">
      <div style={{ ...styles.card, pointerEvents: 'auto' }}>
        <p style={styles.title}>{TITLES[p.code] || 'Something went wrong'}</p>
        <p style={styles.text}>{p.message}</p>
        <div style={styles.actions}>
          {p.retryable !== false && <button style={styles.primary} onClick={onRetry}>Try again</button>}
          <button style={styles.link} onClick={() => setDetails((d) => !d)}>{details ? 'Hide details' : 'Details'}</button>
        </div>
        {details && (
          <pre style={styles.details}>
            {[`code: ${p.code}`, p.stage && `stage: ${p.stage}`, p.cause && `cause: ${p.cause.message ?? String(p.cause)}`].filter(Boolean).join('\n')}
          </pre>
        )}
      </div>
    </div>
  )
}

function Character({ target, label, onRetry }) {
  const [config, setConfig] = useState(null)
  const [client, setClient] = useState(null)
  const [issue, setIssue] = useState(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  useEffect(() => {
    fetchCharacter(target).then(
      (c) => mounted.current && setConfig(c),
      (p) => mounted.current && setIssue(p),
    )
  }, [target])

  // After the character is up, a dropped connection is said out loud, not left as a frozen face.
  useEffect(() => {
    if (!client) return
    return client.on?.('stateChange', (s) => {
      if (mounted.current && s.agentState === 'disconnected') {
        setIssue(problem('connection-lost', 'The connection to the character was lost. Reconnect to continue the conversation.', true))
      }
    })
  }, [client])

  if (issue) return <Problem problem={issue} onRetry={onRetry} />
  return (
    <>
      {config && (
        <ConvaiCharacter
          token={config.token}
          characterId={config.characterId}
          onPrem={config.onPrem}
          dracoDecoderPath="/draco/"
          session={SESSION}
          onReady={(character) => setClient(character.client)}
          // The first failure is the one that matters; a later one (teardown, a retry racing) must not replace it.
          onError={(e) => setIssue((prev) => prev ?? e)}
        />
      )}
      {!client && <Loading label={label} />}
      {client && <ConvaiWidget convaiClient={client} />}
    </>
  )
}

function App() {
  const [target, setTarget] = useState('cloud')
  // Bumped by "Try again": remounts the character, which fetches a fresh token.
  const [attempt, setAttempt] = useState(0)
  const label = TARGETS.find((t) => t.id === target).label
  return (
    <>
      {/* key: switching or retrying tears down one character (and its connection) before the next connects. */}
      <Character key={`${target}-${attempt}`} target={target} label={label} onRetry={() => setAttempt((n) => n + 1)} />
      <Switcher target={target} onChange={setTarget} />
    </>
  )
}

const styles = {
  switcher: { position: 'fixed', top: 16, left: 16, display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'rgba(20,22,26,.85)', zIndex: 10 },
  button: { font: '600 14px system-ui, sans-serif', color: '#c9ced6', background: 'transparent', border: 0, borderRadius: 7, padding: '8px 14px', cursor: 'pointer' },
  active: { color: '#0b0c0e', background: '#e8eaed' },
  center: { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', padding: 24 },
  card: { maxWidth: 440, color: '#c9ced6', font: '15px/1.5 system-ui, sans-serif', textAlign: 'center' },
  title: { margin: '0 0 6px', font: '600 17px system-ui, sans-serif', color: '#e8eaed' },
  text: { margin: '0 0 14px', color: '#aab0ba' },
  actions: { display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' },
  primary: { font: '600 14px system-ui, sans-serif', color: '#0b0c0e', background: '#e8eaed', border: 0, borderRadius: 8, padding: '9px 18px', cursor: 'pointer' },
  link: { font: '14px system-ui, sans-serif', color: '#aab0ba', background: 'none', border: 0, textDecoration: 'underline', cursor: 'pointer' },
  details: { textAlign: 'left', marginTop: 12, padding: 10, borderRadius: 6, background: 'rgba(255,255,255,.06)', font: '12px/1.4 ui-monospace, Menlo, monospace', whiteSpace: 'pre-wrap', color: '#aab0ba' },
}

createRoot(document.getElementById('root')).render(<App />)
