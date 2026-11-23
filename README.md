# Convai Embody — one page, two deployments

A Convai character as a talking 3D body, served from either **Convai Cloud** or
an **on-prem install**, switched with a button. The same component renders
both; only the credential and, for on-prem, the install URL differ.

The body is drawn with `@convai/embody` 2.0's studio look: the Convai
MetaHuman materials, studio lighting and post-processing on **WebGPU**, or on
WebGL 2 where the browser has no hardware WebGPU, with quality picked for the
visitor's GPU.

```jsx
<ConvaiCharacter
  token={token}                 // short-lived Convai auth token from this site's server
  characterId={characterId}
  onPrem={onPremUrl}            // omitted for Convai Cloud
  dracoDecoderPath="/draco/"    // served by this site
  benchmarksURL="/detect-gpu"  // GPU benchmark files, served by this site
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
| `public/draco`, `public/detect-gpu` | static | The Draco mesh decoder and the GPU benchmark files embody picks render quality from, served by this site instead of Google's CDN and unpkg. |

**Authentication.** The browser never sees an API key. It gets a Convai auth
token, valid for an hour, minted on the server for the deployment it is about
to talk to. The endpoint answers only requests from this page (a browser on
another site is refused). It does not check who the visitor is: put your own
sign-in in front of it before you share a deployment widely, as the token lets
whoever holds it talk to the character.

**Rendering.** embody 2.0 picks the renderer per visitor: WebGPU on a
hardware adapter; otherwise the same renderer on its WebGL 2 backend at
medium quality. Quality is `'auto'`: set from the GPU's
[detect-gpu](https://github.com/pmndrs/detect-gpu) tier, and stepped down if
frames run slow, never while the character is speaking. To check what a
machine got, add `onStudioState={(s) => console.log(s.backend, s.quality)}` to
`ConvaiCharacter`.

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

`@convai/web-sdk` 2.1.0, `@convai/embody` 2.0.0, `@convai/web-widget` 0.3.4 and
`three` 0.187.0, from npm, pinned exactly. embody 2.0 needs `three` 0.186 or
later. `pnpm.overrides` keeps one SDK copy, so the chat widget and the body
share one connection.

The Draco decoder (`public/draco`) and detect-gpu's benchmark files
(`public/detect-gpu`, from `detect-gpu` 5.0.70, the version embody depends on)
are served by this site, so the page needs neither Google's CDN nor unpkg: an
on-prem network may have no internet.
