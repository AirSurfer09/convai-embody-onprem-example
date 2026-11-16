# Convai Embody — one page, two deployments

A Convai character as a talking 3D body, served from either **Convai Cloud** or
an **on-prem install**, switched with a button. The same component renders
both; only the credential and, for on-prem, the install URL differ.

```jsx
<ConvaiCharacter
  token={token}                 // short-lived Convai auth token from this site's server
  characterId={characterId}
  onPrem={onPremUrl}            // omitted for Convai Cloud
  session={{ audioRouting: 'data_only' }}
  onReady={(character) => setClient(character.client)}
/>
{client && <ConvaiWidget convaiClient={client} />}
```

## How it works

| Piece | Where | What it does |
|---|---|---|
| `api/character.js` | server (a Vercel function; Vite middleware in `pnpm dev`) | Holds the API keys. For `?target=cloud` or `?target=onprem` it mints a short-lived auth token from that deployment's `POST /user/connect` and returns it with the character id and, for on-prem, the install URL. |
| `src/main.jsx` | browser | Asks the server for the selected character, renders it with `@convai/embody`, and puts the `@convai/web-widget` chat panel on the same connection. The button switches characters; the old one disconnects before the new one connects. |

**Authentication.** The browser never sees an API key. It gets a Convai auth
token, valid for an hour, minted on the server for the deployment it is about
to talk to. The endpoint answers only requests from this page (a browser on
another site is refused). It does not check who the visitor is: put your own
sign-in in front of it before you share a deployment widely, as the token lets
whoever holds it talk to the character.

**Voice and lipsync.** `audioRouting: 'data_only'` sends the character's voice
over the data channel next to its lipsync frames. The SDK plays only audio whose
lipsync has also arrived, starting each reply once 0.9 s of both is in hand, and
embody clocks the mouth from what is actually heard, always at least one frame
ahead of the sound. On a slow network the voice pauses between words to refill
instead of stuttering or speaking with a still face.

## Run it

```bash
pnpm install
cp .env.example .env     # fill in both deployments' keys and character ids
pnpm dev
```

Open the printed URL, click the chat launcher (bottom right), then **Exit Voice
Mode** to type, or use the microphone. **Convai Cloud** / **On-prem** (top left)
switch the character.

| Variable | Meaning |
|---|---|
| `CONVAI_API_KEY`, `CONVAI_CHARACTER_ID` | A Convai Cloud key and a character on it with a web body. |
| `CONVAI_ONPREM_URL` | The install's URL, `https://api-<env>.<domain>`. embody derives the install's realtime (`live-<env>`) and Character API (`character-apis-<env>`) hosts from it. |
| `CONVAI_ONPREM_API_KEY`, `CONVAI_ONPREM_CHARACTER_ID` | A key issued by that install and a character on it. Keys and character ids belong to one deployment and are not interchangeable. |

All five are server-side: none is prefixed `VITE_`, so none reaches the page.

## Deploy to Vercel

```bash
vercel link
for v in CONVAI_API_KEY CONVAI_CHARACTER_ID CONVAI_ONPREM_URL CONVAI_ONPREM_API_KEY CONVAI_ONPREM_CHARACTER_ID; do vercel env add $v production; done
vercel --prod
```

Vercel builds the Vite app and serves `api/character.js` as a function; no
configuration file is needed.

## Packages

`@convai/web-sdk` 2.1.0-beta.1 and `@convai/embody` 1.2.0-beta.10 come from npm
(the `beta` tag). `@convai/web-widget` 0.3.4-beta.0 is vendored in `vendor/`
until it is published: it shows the character's name and avatar for a client on
an auth token, where 0.3.2 left the header on a placeholder. Once it is on npm,
replace its `file:vendor/...` entry with the published version and delete
`vendor/`. `pnpm.overrides` keeps one SDK copy, so the chat widget and the body
share one connection.

The Draco decoder is served from `public/draco`, so the page needs no Google CDN
(an on-prem network may have no internet).
