import { useState } from 'react'
import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession()

    if (!session) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: Dashboard,
})

function Dashboard() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | undefined>()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleLogout() {
    setError(undefined)
    setIsSigningOut(true)

    const result = await authClient.signOut()

    setIsSigningOut(false)

    if (result.error) {
      setError(result.error.message || 'Logout failed. Try again.')
      return
    }

    await navigate({
      to: '/login',
      search: { redirect: undefined },
      replace: true,
    })
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-medium text-slate-500">skrol</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Dashboard
          </h1>
        </div>
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
          type="button"
          disabled={isSigningOut}
          onClick={handleLogout}
        >
          {isSigningOut ? 'Logging out...' : 'Log out'}
        </button>
      </header>

      {error ? (
        <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="py-10">
        <Outlet />
      </section>
    </main>
  )
}
