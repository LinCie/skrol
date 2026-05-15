import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ProductApiError, getLink } from '../lib/api-client'
import type { LinkDto } from '../lib/api-client'

export const Route = createFileRoute('/dashboard/links/$id')({
  component: LinkDetailPage,
})

function LinkDetailPage() {
  const { id } = Route.useParams()
  const [link, setLink] = useState<LinkDto | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [isNotFound, setIsNotFound] = useState(false)

  useEffect(() => {
    let isCurrent = true

    async function loadLink() {
      try {
        const response = await getLink(id)

        if (isCurrent) {
          setLink(response)
          setError(undefined)
          setIsNotFound(false)
        }
      } catch (caughtError) {
        if (!isCurrent) {
          return
        }

        if (caughtError instanceof ProductApiError && caughtError.status === 404) {
          setIsNotFound(true)
          setError(undefined)
          return
        }

        setError('Could not load link. Try again.')
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadLink()

    return () => {
      isCurrent = false
    }
  }, [id])

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading link...</p>
  }

  if (isNotFound) {
    return (
      <div className="rounded-2xl border border-slate-200 p-8">
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">Link not found</h2>
        <p className="mt-2 text-sm text-slate-600">
          This link does not exist or you do not have access to it.
        </p>
        <Link className="mt-4 inline-flex font-medium text-slate-950 underline" to="/dashboard/links">
          Back to links
        </Link>
      </div>
    )
  }

  if (error || !link) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
        {error || 'Could not load link. Try again.'}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Link detail</p>
        <h2 className="mt-1 break-all text-2xl font-bold tracking-tight text-slate-950">
          {link.short_url}
        </h2>
      </div>

      <dl className="grid gap-4 rounded-2xl border border-slate-200 p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-slate-500">Destination URL</dt>
          <dd className="mt-1 break-all text-slate-950">{link.destination_url}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Alias</dt>
          <dd className="mt-1 text-slate-950">{link.alias || 'Generated'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Created</dt>
          <dd className="mt-1 text-slate-950">{formatDate(link.created_at)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Expires</dt>
          <dd className="mt-1 text-slate-950">
            {link.expires_at ? formatDate(link.expires_at) : 'Never'}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}
