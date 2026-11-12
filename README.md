# Convai Embody on an on-prem install

The smallest page that renders a Convai character as a 3D body and lets you
talk to it, against an on-prem Convai install instead of Convai's SaaS. One
component, one chat widget, one URL for the install.

```jsx
<ConvaiCharacter apiKey={apiKey} characterId={characterId} onPrem="https://api-sh-aws.convai.com"
  onReady={(character) => setClient(character.client)} />
{client && <ConvaiWidget convaiClient={client} />}
```

`onPrem` is the install's Middleman URL. Embody points the embodiment manifest
(`GET /character/{id}/embodiment`) and the character info (`POST /character/get`)
at it, and derives the install's other hosts by the deployment's naming
convention:

| Service | Host | Used for |
|---|---|---|
| Middleman | `api-<env>.<domain>` | the body manifest, the character's name and avatar |
| Realtime | `live-<env>.<domain>` | the `/connect` session: voice, text, lipsync frames |
| Character API | `character-apis-<env>.<domain>` | character versions |
| Assets | `assets-<env>.<domain>` | the GLB files the manifest points at (served by the install's asset proxy) |

Anything you name yourself in `session` (`url`, `characterInfoUrl`,
`characterApiUrl`) or in `baseUrl` wins over what is derived.

## Run it

```bash
pnpm install
cp .env.example .env     # then fill in the key and the character id
pnpm dev
```

Open the printed URL. The body downloads from the install's asset host, the
character stands at eye level, and the chat launcher sits bottom right. Click
it, press **Exit Voice Mode** to type, or use the microphone. The reply is
spoken with lip-sync; every request goes to the install's hosts and none to
`convai.com`'s SaaS (check the Network tab: `api-<env>`, `live-<env>`,
`assets-<env>` only).

Verified on 2026-11-12 against `api-sh-aws.convai.com` with the character
"robot 11": body served from `assets-sh-aws`, connection on `live-sh-aws`,
widget name and avatar from `api-sh-aws`, 964 lipsync frames over a 17 s reply.

## Requirements

- `@convai/embody` 1.2.0-beta.8 or later (the `onPrem` option).
- The install must serve the embodiment route on its Middleman and have the
  character's avatar published with a web body. The runbook for that is
  `aws/apps/EMBODY.md` in `Conv-AI/on-prem-deployments`; the client-side
  notes are in `plugins/convai-embody/README.md` there.
- An API key issued by the install. Keys and character ids are per install:
  a SaaS key or character id does not work here, and the reverse.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `embodiment resolve failed … HTTP 404` | The route is not served on this install, or the character has no web body | Deploy the embodiment blueprint (runbook step 1) or publish a body for the avatar |
| `Invalid API key` | A SaaS key, or a key from another install | Use a key the install issued |
| Body never appears, console shows a blocked `gstatic.com/draco` request | The decoder is fetched from Google by default | Self-host it and pass `dracoDecoderPath` |
| Widget shows "Convi" instead of the name | The character info host is wrong | `onPrem` sets it; if you override `session.characterInfoUrl`, point it at the Middleman |
