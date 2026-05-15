import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data: session } = await authClient.getSession()

    if (session) {
      const redirectTarget = getSafeRedirectTarget(search.redirect)

      if (redirectTarget) {
        throw redirect({ href: redirectTarget })
      }

      throw redirect({ to: '/dashboard' })
    }
  },
  component: Login,
})

function Login() {
  return <main>Login</main>
}

function getSafeRedirectTarget(redirectTo: string | undefined) {
  if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return undefined
  }

  const url = new URL(redirectTo, window.location.origin)

  if (url.origin !== window.location.origin) {
    return undefined
  }

  return `${url.pathname}${url.search}${url.hash}`
}
