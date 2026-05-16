import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createApiKey,
  deleteApiKey,
  deleteLink,
  listApiKeys,
  updateLink,
} from '../../lib/api-client'

function mockJsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('phase 3 product API client methods', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockJsonResponse({})))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates an API key with credentials and returns the key payload', async () => {
    const response = {
      key: 'sk_live_123',
      api_key: {
        id: 'key_1',
        name: 'CI',
        prefix: 'sk_live',
        created_at: '2026-05-16T00:00:00.000Z',
        last_used_at: null,
        expires_at: null,
        status: 'active',
      },
    }
    vi.mocked(fetch).mockResolvedValueOnce(await mockJsonResponse(response))

    await expect(
      createApiKey({ name: 'CI', expires_in_seconds: 3600 }),
    ).resolves.toEqual(response)

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/api-keys',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'CI', expires_in_seconds: 3600 }),
      },
    )
  })

  it('lists API keys with credentials', async () => {
    const response = { items: [] }
    vi.mocked(fetch).mockResolvedValueOnce(await mockJsonResponse(response))

    await expect(listApiKeys()).resolves.toEqual(response)

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/api-keys',
      {
        credentials: 'include',
      },
    )
  })

  it('deletes an API key with credentials and accepts 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(deleteApiKey('key_1')).resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/api-keys/key_1',
      {
        method: 'DELETE',
        credentials: 'include',
      },
    )
  })

  it('encodes API key ids in delete paths', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(deleteApiKey('key/1')).resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/api-keys/key%2F1',
      {
        method: 'DELETE',
        credentials: 'include',
      },
    )
  })

  it('updates a link with credentials', async () => {
    const response = {
      id: 'link_1',
      short_url: 'http://localhost:8000/s/docs',
      code: 'docs',
      destination_url: 'https://example.com/docs',
      title: null,
      status: 'disabled',
      created_at: '2026-05-16T00:00:00.000Z',
      expires_at: null,
    }
    vi.mocked(fetch).mockResolvedValueOnce(await mockJsonResponse(response))

    await expect(updateLink('link_1', { status: 'disabled' })).resolves.toEqual(
      response,
    )

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/links/link_1',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'disabled' }),
      },
    )
  })

  it('encodes link ids in update and delete paths', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(await mockJsonResponse({}))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await updateLink('link/1', { status: 'disabled' })
    await deleteLink('link/1')

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8000/api/v1/links/link%2F1',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'disabled' }),
      },
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8000/api/v1/links/link%2F1',
      {
        method: 'DELETE',
        credentials: 'include',
      },
    )
  })

  it('deletes a link with credentials and accepts 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(deleteLink('link_1')).resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/links/link_1',
      {
        method: 'DELETE',
        credentials: 'include',
      },
    )
  })
})
