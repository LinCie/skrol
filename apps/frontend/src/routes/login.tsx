import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()

    if (session) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: Login,
})

function Login() {
  return <main>Login</main>
}
