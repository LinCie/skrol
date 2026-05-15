import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { ProductApiError, createLink } from '../lib/api-client'

export const Route = createFileRoute('/dashboard/links/new')({
  component: NewLinkPage,
})

function NewLinkPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const url = String(formData.get('url') ?? '').trim()
    const alias = String(formData.get('alias') ?? '').trim()
    const expiresAt = String(formData.get('expires_at') ?? '').trim()
    const expiresAtIso = expiresAt ? new Date(expiresAt).toISOString() : undefined

    try {
      const link = await createLink({
        url,
        ...(alias ? { alias } : {}),
        ...(expiresAtIso ? { expires_at: expiresAtIso } : {}),
      })

      await navigate({ to: '/dashboard/links/$id', params: { id: link.id } })
    } catch (caughtError) {
      if (caughtError instanceof ProductApiError) {
        setError(caughtError.message)
      } else {
        setError('Could not create link. Try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Create link</h2>
      <p className="mt-1 text-sm text-slate-600">
        Shorten a destination URL with an optional custom alias.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-800">
          Destination URL
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
            name="url"
            type="url"
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          Custom alias
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
            name="alias"
            type="text"
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          Expiration date
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
            name="expires_at"
            type="datetime-local"
          />
        </label>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="rounded-lg bg-slate-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating link...' : 'Create link'}
        </button>
      </form>
    </div>
  )
}
