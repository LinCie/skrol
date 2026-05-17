import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ProductApiError,
  deleteLink,
  getLink,
  getLinkAnalytics,
  updateLink,
} from '../lib/api-client'
import type { LinkAnalyticsResponse, LinkDto } from '../lib/api-client'

export const Route = createFileRoute('/dashboard/links/$id')({
  component: LinkDetailPage,
})

function LinkDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [link, setLink] = useState<LinkDto | undefined>()
  const [title, setTitle] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isNotFound, setIsNotFound] = useState(false)

  useEffect(() => {
    let isCurrent = true

    setIsLoading(true)
    setLink(undefined)
    setError(undefined)
    setIsNotFound(false)

    async function loadLink() {
      try {
        const response = await getLink(id)

        if (isCurrent) {
          setLink(response)
          setTitle(response.title ?? '')
          setDestinationUrl(response.destination_url)
          setExpiresAt(response.expires_at ? toDateTimeLocalValue(response.expires_at) : '')
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

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!link) {
      return
    }

    setError(undefined)
    setIsSaving(true)

    try {
      const input = {
        title: title.trim() || null,
        destination_url: destinationUrl.trim(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      }
      const response = await updateLink(link.id, input)

      setLink(response)
      setTitle(response.title ?? '')
      setDestinationUrl(response.destination_url)
      setExpiresAt(response.expires_at ? toDateTimeLocalValue(response.expires_at) : '')
    } catch (caughtError) {
      if (caughtError instanceof ProductApiError) {
        setError(caughtError.message)
      } else {
        setError('Could not update link. Try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleStatus() {
    if (!link) {
      return
    }

    setError(undefined)
    setIsUpdatingStatus(true)

    try {
      const nextStatus = link.status === 'active' ? 'disabled' : 'active'
      const response = await updateLink(link.id, { status: nextStatus })

      setLink(response)
      setTitle(response.title ?? '')
      setDestinationUrl(response.destination_url)
      setExpiresAt(response.expires_at ? toDateTimeLocalValue(response.expires_at) : '')
    } catch (caughtError) {
      if (caughtError instanceof ProductApiError) {
        setError(caughtError.message)
      } else {
        setError('Could not update link status. Try again.')
      }
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  async function handleDelete() {
    if (!link || !window.confirm('Delete this link?')) {
      return
    }

    setError(undefined)
    setIsDeleting(true)

    try {
      await deleteLink(link.id)
      await navigate({ to: '/dashboard/links' })
    } catch (caughtError) {
      if (caughtError instanceof ProductApiError) {
        setError(caughtError.message)
      } else {
        setError('Could not delete link. Try again.')
      }
      setIsDeleting(false)
    }
  }

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

  if (!link) {
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
          <dt className="text-sm font-medium text-slate-500">Short code</dt>
          <dd className="mt-1 text-slate-950">{link.code}</dd>
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

      <form className="space-y-5 rounded-2xl border border-slate-200 p-6" onSubmit={handleSave}>
        <h3 className="text-lg font-semibold tracking-tight text-slate-950">Manage link</h3>

        <label className="block text-sm font-medium text-slate-800">
          Title
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
            name="title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          Destination URL
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
            name="destination_url"
            type="url"
            required
            value={destinationUrl}
            onChange={(event) => setDestinationUrl(event.target.value)}
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          Expiration date
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
            name="expires_at"
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? 'Saving changes...' : 'Save changes'}
          </button>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
            type="button"
            disabled={isUpdatingStatus}
            onClick={handleToggleStatus}
          >
            {link.status === 'active'
              ? isUpdatingStatus
                ? 'Disabling link...'
                : 'Disable link'
              : isUpdatingStatus
                ? 'Re-enabling link...'
                : 'Re-enable link'}
          </button>
          <button
            className="rounded-lg border border-red-200 px-4 py-2 font-medium text-red-700 disabled:cursor-not-allowed disabled:text-red-300"
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? 'Deleting link...' : 'Delete link'}
          </button>
        </div>
      </form>

      <LinkAnalyticsPanels key={id} linkId={id} />
    </div>
  )
}

export function LinkAnalyticsPanels({ linkId }: { linkId: string }) {
  const [analytics, setAnalytics] = useState<LinkAnalyticsResponse['data'] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    let isCurrent = true

    setIsLoading(true)
    setAnalytics(null)
    setError(undefined)

    async function loadAnalytics() {
      try {
        const response = await getLinkAnalytics(linkId)

        if (!isCurrent) {
          return
        }

        setAnalytics(response.data)
        setError(undefined)
      } catch (caughtError) {
        if (!isCurrent) {
          return
        }

        if (caughtError instanceof ProductApiError) {
          setError(caughtError.message)
        } else {
          setError('Could not load analytics. Try again.')
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      isCurrent = false
    }
  }, [linkId])

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading analytics...</p>
  }

  if (error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
        {error}
      </p>
    )
  }

  if (!analytics) {
    return null
  }

  return <LinkAnalyticsPanelsView analytics={analytics} />
}

export function LinkAnalyticsPanelsView({
  analytics,
}: {
  analytics: LinkAnalyticsResponse['data']
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 p-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-950">Analytics</h3>
        {analytics.total_clicks === 0 ? (
          <p className="mt-1 text-sm text-slate-600">No clicks recorded yet.</p>
        ) : null}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total clicks" value={analytics.total_clicks.toString()} />
        <Metric label="Referrers" value={analytics.referrers.length.toString()} />
        <Metric label="Browsers" value={analytics.browsers.length.toString()} />
        <Metric label="Devices" value={analytics.devices.length.toString()} />
      </dl>

      <AnalyticsList
        title="Clicks over time"
        emptyLabel="No click history yet."
        items={analytics.clicks_over_time.map(
          (row) => `${formatUtcDate(row.bucket_start)}: ${row.clicks}`,
        )}
      />
      <AnalyticsList
        title="Referrers"
        emptyLabel="No referrer data yet."
        items={analytics.referrers.map((row) => `${row.referrer_domain}: ${row.clicks}`)}
      />
      <AnalyticsList
        title="Browsers"
        emptyLabel="No browser data yet."
        items={analytics.browsers.map((row) => `${row.browser}: ${row.clicks}`)}
      />
      <AnalyticsList
        title="Devices"
        emptyLabel="No device data yet."
        items={analytics.devices.map((row) => `${row.device}: ${row.clicks}`)}
      />

      {analytics.countries !== undefined ? (
        <AnalyticsList
          title="Countries"
          emptyLabel="No country data yet."
          items={analytics.countries.map((row) => `${row.country}: ${row.clicks}`)}
        />
      ) : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</dd>
    </div>
  )
}

function AnalyticsList({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: string[]
  emptyLabel: string
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1 text-sm text-slate-800">
          {items.map((item) => (
            <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatUtcDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)

  return localDate.toISOString().slice(0, 16)
}
