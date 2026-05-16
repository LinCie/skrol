import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ProductApiError, deleteLink, getLink, updateLink } from '../lib/api-client'
import type { LinkDto } from '../lib/api-client'

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
        ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}),
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
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function toDateTimeLocalValue(value: string) {
  return value.slice(0, 16)
}
