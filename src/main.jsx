import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import ConvaiCharacter from '@convai/embody/react'
import { ConvaiWidget } from '@convai/web-widget/react'

// One URL for the whole install: the Middleman. Embody points the embodiment
// manifest and the character info at it and derives the realtime
// (live-<env>) and Character API (character-apis-<env>) hosts for the Web
// SDK connection. The chat widget reads the client's hosts, so it follows.
const onPrem = import.meta.env.VITE_CONVAI_ONPREM_URL
const apiKey = import.meta.env.VITE_CONVAI_API_KEY
const characterId = import.meta.env.VITE_CONVAI_CHARACTER_ID

function Loading() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: '#c9ced6', font: '15px system-ui, sans-serif' }}>
      Loading the character…
    </div>
  )
}

function App() {
  const [client, setClient] = useState(null)
  return (
    <>
      <ConvaiCharacter
        apiKey={apiKey}
        characterId={characterId}
        onPrem={onPrem}
        // Served from this app (public/draco), not Google's CDN: an on-prem install may have no internet.
        dracoDecoderPath="/draco/"
        session={{ endUserId: 'onprem-example-visitor' }}
        onReady={(character) => setClient(character.client)}
        onError={(e) => console.error('[embody]', e)}
      />
      {/* Until the body is ready. A body is tens of MB, and an install's asset
          host can take a while to serve it on a first visit. */}
      {!client && <Loading />}
      {client && <ConvaiWidget convaiClient={client} />}
    </>
  )
}

createRoot(document.getElementById('root')).render(<App />)
