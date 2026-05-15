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
  const baseUrl = (
    import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_AUTH_BASE_URL
  )?.trim()

  if (!baseUrl) {
    return path
  }

  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}
