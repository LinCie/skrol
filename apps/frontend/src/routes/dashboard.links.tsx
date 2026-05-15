import { Link, Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { listLinks } from '../lib/api-client'
import type { LinkDto } from '../lib/api-client'

export const Route = createFileRoute('/dashboard/links')({
  component: LinksPage,
})

function LinksPage() {
  const location = useLocation()
  const [links, setLinks] = useState<LinkDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (location.pathname !== '/dashboard/links') {
      return
    }

    let isCurrent = true

    async function loadLinks() {
      try {
        const response = await listLinks({ limit: 20 })

        if (isCurrent) {
          setLinks(response.items)
          setError(undefined)
        }
      } catch {
        if (isCurrent) {
          setError('Could not load links. Try again.')
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadLinks()

    return () => {
      isCurrent = false
    }
  }, [location.pathname])

  if (location.pathname !== '/dashboard/links') {
    return <Outlet />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Links</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create and inspect short links for your account.
          </p>
        </div>
        <Link
          className="inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
          to="/dashboard/links/new"
        >
          Create link
        </Link>
      </div>

      {isLoading ? <p className="text-sm text-slate-600">Loading links...</p> : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {!isLoading && !error && links.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8">
          <h3 className="text-lg font-semibold text-slate-950">No links yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Create your first short link to see it here.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && links.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {links.map((link) => (
            <li className="p-4" key={link.id}>
              <Link className="font-medium text-slate-950 underline" to="/dashboard/links/$id" params={{ id: link.id }}>
                {link.short_url}
              </Link>
              <p className="mt-1 break-all text-sm text-slate-600">{link.destination_url}</p>
              <p className="mt-2 text-xs text-slate-500">Created {formatDate(link.created_at)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}
