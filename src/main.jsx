import { useEffect, useState } from 'react'
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

/** Ask this site's server for a short-lived Convai auth token and the character to show. */
async function fetchCharacter(target) {
  const r = await fetch(`/api/character?target=${target}`)
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`)
  return body
}

function Switcher({ target, onChange, disabled }) {
  return (
    <div style={styles.switcher} role="group" aria-label="Choose the character">
      {TARGETS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          disabled={disabled}
          aria-pressed={target === t.id}
          style={{ ...styles.button, ...(target === t.id ? styles.active : null) }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Character({ target }) {
  const [config, setConfig] = useState(null)
  const [client, setClient] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    fetchCharacter(target).then((c) => live && setConfig(c), (e) => live && setError(e.message))
    return () => { live = false }
  }, [target])

  if (error) return <Message>Could not load the character: {error}</Message>
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
          onError={(e) => setError(e.message)}
        />
      )}
      {!client && <Message>Loading the character…</Message>}
      {client && <ConvaiWidget convaiClient={client} />}
    </>
  )
}

function App() {
  const [target, setTarget] = useState('cloud')
  return (
    <>
      {/* key: switching tears down one character (and its connection) before the other connects. */}
      <Character key={target} target={target} />
      <Switcher target={target} onChange={setTarget} />
    </>
  )
}

function Message({ children }) {
  return <div style={styles.message}>{children}</div>
}

const styles = {
  switcher: { position: 'fixed', top: 16, left: 16, display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'rgba(20,22,26,.85)', zIndex: 10 },
  button: { font: '600 14px system-ui, sans-serif', color: '#c9ced6', background: 'transparent', border: 0, borderRadius: 7, padding: '8px 14px', cursor: 'pointer' },
  active: { color: '#0b0c0e', background: '#e8eaed' },
  message: { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: '#c9ced6', font: '15px system-ui, sans-serif', pointerEvents: 'none' },
}

createRoot(document.getElementById('root')).render(<App />)
