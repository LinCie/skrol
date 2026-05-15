import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLink, listLinks } from '../../lib/api-client'

function mockJsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('product API client origin resolution', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockJsonResponse({ items: [], nextCursor: null })))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses VITE_API_BASE_URL for product API calls with credentials', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')

    await listLinks()

    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/links?limit=20', {
      credentials: 'include',
    })
  })

  it('falls back to VITE_AUTH_BASE_URL for product API calls with credentials', async () => {
    vi.stubEnv('VITE_AUTH_BASE_URL', 'http://localhost:8000/')

    await createLink({ url: 'https://example.com/docs' })

    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/links', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/docs' }),
    })
  })

  it('keeps same-origin relative paths when no backend origin env is configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubEnv('VITE_AUTH_BASE_URL', '')

    await listLinks()

    expect(fetch).toHaveBeenCalledWith('/api/v1/links?limit=20', {
      credentials: 'include',
    })
  })
})
