import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/signup')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()

    if (session) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: Signup,
})

function Signup() {
  return <main>Sign up</main>
}
