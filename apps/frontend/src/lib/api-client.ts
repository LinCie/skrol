import { buildQueryString } from './query-string'

export type LinkDto = {
  id: string
  short_url: string
  code: string
  destination_url: string
  title: string | null
  status: string
  created_at: string
  expires_at: string | null
}

type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

type ListLinksResponse = {
  items: LinkDto[]
  nextCursor: string | null
}

export type ApiKeyMetadataDto = {
  id: string
  name: string
  prefix: string | null
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  status: 'active' | 'revoked' | 'expired'
}

export type CreateApiKeyInput = { name: string; expires_in_seconds?: number }
export type CreateApiKeyResponse = { key: string; api_key: ApiKeyMetadataDto }
export type ListApiKeysResponse = { items: ApiKeyMetadataDto[] }
export type UpdateLinkInput = {
  title?: string | null
  destination_url?: string
  expires_at?: string | null
  status?: 'active' | 'disabled'
}

type RedirectDecisionResponse = {
  location: string
}

export class ProductApiError extends Error {
  code: string
  status: number
  details: unknown

  constructor(message: string, options: { code: string; status: number; details?: unknown }) {
    super(message)
    this.name = 'ProductApiError'
    this.code = options.code
    this.status = options.status
    this.details = options.details
  }
}

export async function listLinks(options: { limit?: number; cursor?: string } = {}) {
  const queryString = buildQueryString({
    limit: options.limit ?? 20,
    cursor: options.cursor,
  })

  return productFetch<ListLinksResponse>(`/api/v1/links${queryString}`)
}

export async function createLink(input: {
  url: string
  alias?: string
  expires_at?: string
}) {
  return productFetch<LinkDto>('/api/v1/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function getLink(id: string) {
  return productFetch<LinkDto>(`/api/v1/links/${encodeURIComponent(id)}`)
}

export async function updateLink(id: string, input: UpdateLinkInput) {
  return productFetch<LinkDto>(`/api/v1/links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteLink(id: string) {
  return productFetch<void>(`/api/v1/links/${id}`, { method: 'DELETE' })
}

export async function resolveRedirect(code: string) {
  return productFetch<RedirectDecisionResponse>(
    `/api/v1/redirect/${encodeURIComponent(code)}`,
  )
}

export async function createApiKey(input: CreateApiKeyInput) {
  return productFetch<CreateApiKeyResponse>('/api/v1/api-keys', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function listApiKeys() {
  return productFetch<ListApiKeysResponse>('/api/v1/api-keys')
}

export async function deleteApiKey(id: string) {
  return productFetch<void>(`/api/v1/api-keys/${id}`, { method: 'DELETE' })
}

async function productFetch<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(resolveProductApiUrl(path), {
    ...init,
    credentials: 'include',
  })

  const body = (await response.json().catch(() => undefined)) as ApiErrorBody | T | undefined

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | undefined
    throw new ProductApiError(
      errorBody?.error?.message || 'Request failed. Try again.',
      {
        code: errorBody?.error?.code || 'request_failed',
        status: response.status,
        details: errorBody?.error?.details,
      },
    )
  }

  return body as T
}

function resolveProductApiUrl(path: string) {
  const baseUrl = [import.meta.env.VITE_API_BASE_URL, import.meta.env.VITE_AUTH_BASE_URL]
    .map((value) => value?.trim())
    .find(Boolean)

  if (!baseUrl) {
    return path
  }

  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
