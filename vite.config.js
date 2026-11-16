import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import character from './api/character.js'

// In `pnpm dev`, serve /api/character from the same handler Vercel runs, with
// the server-side keys from .env (none of them is exposed to the page).
function convaiAuth() {
  return {
    name: 'convai-auth',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), 'CONVAI_')
      server.middlewares.use('/api/character', (req, res) => {
        req.url = `/api/character${req.url}`
        character(req, res, env)
      })
    },
  }
}

export default { plugins: [react(), convaiAuth()] }
