import { useState } from 'react'
import { Link, Outlet, createFileRoute, redirect, useLocation, useNavigate } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ location }) => {
    const { data } = await authClient.getSession()
    const session = data?.session

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
  const location = useLocation()
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
          <nav className="mt-4 flex gap-4 text-sm font-medium text-slate-700">
            <Link to="/dashboard/links">Links</Link>
            <Link to="/dashboard/api-keys">API keys</Link>
          </nav>
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
        {location.pathname === '/dashboard' ? <DashboardHome /> : <Outlet />}
      </section>
    </main>
  )
}

function DashboardHome() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 p-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">
          Manage your short links
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          View existing links or create a new short link from your dashboard.
        </p>
        <Link className="mt-4 inline-flex font-medium text-slate-950 underline" to="/dashboard/links">
          View links
        </Link>
      </div>
      <div className="rounded-2xl border border-slate-200 p-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">
          Manage API keys
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Create and revoke API keys for programmatic access.
        </p>
        <Link className="mt-4 inline-flex font-medium text-slate-950 underline" to="/dashboard/api-keys">
          View API keys
        </Link>
      </div>
    </div>
  )
}
