import { createAuthClient } from 'better-auth/react'

type AuthClient = ReturnType<typeof createAuthClient>

export const authClient: AuthClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_BASE_URL,
})

export type Session = typeof authClient.$Infer.Session
