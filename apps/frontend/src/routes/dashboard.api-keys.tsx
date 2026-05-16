import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { createApiKey, deleteApiKey, listApiKeys } from '../lib/api-client'
import type { ApiKeyMetadataDto } from '../lib/api-client'

export const Route = createFileRoute('/dashboard/api-keys')({
  component: ApiKeysPage,
})

function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyMetadataDto[]>([])
  const [name, setName] = useState('')
  const [expiresInSeconds, setExpiresInSeconds] = useState('')
  const [createdKey, setCreatedKey] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [loadError, setLoadError] = useState<string | undefined>()
  const [actionError, setActionError] = useState<string | undefined>()

  useEffect(() => {
    let isCurrent = true

    async function loadApiKeys() {
      try {
        const response = await listApiKeys()

        if (isCurrent) {
          setApiKeys((currentApiKeys) => mergeApiKeys(currentApiKeys, response.items))
          setLoadError(undefined)
        }
      } catch {
        if (isCurrent) {
          setLoadError('Could not load API keys. Try again.')
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadApiKeys()

    return () => {
      isCurrent = false
    }
  }, [])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError(undefined)
    setIsCreating(true)

    try {
      const trimmedName = name.trim()
      const trimmedExpiration = expiresInSeconds.trim()
      const response = await createApiKey({
        name: trimmedName,
        ...(trimmedExpiration
          ? { expires_in_seconds: Number(trimmedExpiration) }
          : undefined),
      })

      setApiKeys((currentApiKeys) => [response.api_key, ...currentApiKeys])
      setCreatedKey(response.key)
      setName('')
      setExpiresInSeconds('')
    } catch {
      setActionError('Could not create API key. Try again.')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleRevoke(apiKey: ApiKeyMetadataDto) {
    if (!window.confirm(`Revoke API key ${apiKey.name}?`)) {
      return
    }

    setActionError(undefined)

    try {
      await deleteApiKey(apiKey.id)
      setApiKeys((currentApiKeys) => currentApiKeys.filter((item) => item.id !== apiKey.id))
    } catch {
      setActionError('Could not revoke API key. Try again.')
    }
  }

  async function handleCopyCreatedKey() {
    if (!createdKey) {
      return
    }

    try {
      await navigator.clipboard.writeText(createdKey)
      setActionError(undefined)
    } catch {
      setActionError('Could not copy API key. Copy it manually.')
    }
  }

  const error = actionError ?? loadError

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">API keys</h2>
        <p className="mt-1 text-sm text-slate-600">
          Create and revoke keys for API access to your account.
        </p>
      </div>

      <form className="rounded-2xl border border-slate-200 p-6" onSubmit={handleCreate}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Key name
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Expiration in seconds
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950"
              min="1"
              type="number"
              value={expiresInSeconds}
              onChange={(event) => setExpiresInSeconds(event.target.value)}
            />
          </label>
        </div>
        <button
          className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          type="submit"
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create API key'}
        </button>
      </form>

      {createdKey ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">Copy this key now</h2>
          <p className="mt-2 text-sm text-slate-700">
            For security, Skrol will not show the full key again.
          </p>
          <code className="mt-4 block break-all rounded-lg bg-white p-3 text-sm text-slate-950">
            {createdKey}
          </code>
          <button
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
            type="button"
            onClick={handleCopyCreatedKey}
          >
            Copy key
          </button>
        </section>
      ) : null}

      {isLoading ? <p className="text-sm text-slate-600">Loading API keys...</p> : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {!isLoading && !loadError && apiKeys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8">
          <h3 className="text-lg font-semibold text-slate-950">No API keys yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Create your first API key to see it here.
          </p>
        </div>
      ) : null}

      {!isLoading && !loadError && apiKeys.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium" scope="col">Name</th>
                <th className="px-4 py-3 font-medium" scope="col">Prefix</th>
                <th className="px-4 py-3 font-medium" scope="col">Created</th>
                <th className="px-4 py-3 font-medium" scope="col">Last used</th>
                <th className="px-4 py-3 font-medium" scope="col">Expires</th>
                <th className="px-4 py-3 font-medium" scope="col">Status</th>
                <th className="px-4 py-3 font-medium" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {apiKeys.map((apiKey) => (
                <tr key={apiKey.id}>
                  <td className="px-4 py-3 font-medium text-slate-950">{apiKey.name}</td>
                  <td className="px-4 py-3 text-slate-600">{apiKey.prefix || 'None'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(apiKey.created_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatOptionalDate(apiKey.last_used_at)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatOptionalDate(apiKey.expires_at)}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{apiKey.status}</td>
                  <td className="px-4 py-3">
                    <button
                      className="text-sm font-medium text-red-700 underline disabled:text-slate-400"
                      type="button"
                      disabled={apiKey.status !== 'active'}
                      onClick={() => void handleRevoke(apiKey)}
                    >
                      Revoke {apiKey.name}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : 'Never'
}

function mergeApiKeys(currentApiKeys: ApiKeyMetadataDto[], loadedApiKeys: ApiKeyMetadataDto[]) {
  const loadedById = new Map(loadedApiKeys.map((apiKey) => [apiKey.id, apiKey]))
  const merged = currentApiKeys.map((apiKey) => loadedById.get(apiKey.id) ?? apiKey)
  const currentIds = new Set(currentApiKeys.map((apiKey) => apiKey.id))

  return [
    ...merged,
    ...loadedApiKeys.filter((apiKey) => !currentIds.has(apiKey.id)),
  ]
}
