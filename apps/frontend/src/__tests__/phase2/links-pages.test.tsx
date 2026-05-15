// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '../../router'
import { authClient } from '../../lib/auth-client'

vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => null,
}))

vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

vi.mock('../../lib/auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
  },
}))

const getSessionMock = vi.mocked(authClient.getSession)

const authenticatedSession = {
  data: {
    session: { id: 'session-1' },
    user: { id: 'user-1', email: 'user@example.com' },
  },
  error: null,
}

function renderAt(initialEntry: string) {
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  const router = getRouter({ history })

  render(<RouterProvider router={router} />)

  return router
}

function mockJsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('dashboard links pages', () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(authenticatedSession)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('shows links empty state and fetches with credentials', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse({ items: [], nextCursor: null }),
    )

    renderAt('/dashboard/links')

    expect(await screen.findByRole('heading', { name: /links/i })).not.toBeNull()
    expect(screen.getByText(/no links yet/i)).not.toBeNull()
    expect(screen.getByRole('link', { name: /create link/i })).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/links?limit=20', {
      credentials: 'include',
    })
  })

  it('shows a generic links list error state', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse(
        { error: { code: 'server_error', message: 'Database unavailable' } },
        500,
      ),
    )

    renderAt('/dashboard/links')

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /could not load links/i,
    )
  })

  it('maps create validation errors from the API', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse(
        {
          error: {
            code: 'validation_error',
            message: 'Alias must be 3-64 lowercase letters, numbers, hyphens, or underscores.',
            details: { alias: ['Invalid alias'] },
          },
        },
        400,
      ),
    )

    renderAt('/dashboard/links/new')

    fireEvent.change(await screen.findByRole('textbox', { name: /destination url/i }), {
      target: { value: 'https://example.com/docs' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /custom alias/i }), {
      target: { value: 'NO' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create link/i }))

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /alias must be 3-64 lowercase/i,
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/links', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/docs',
        alias: 'NO',
      }),
    })
  })

  it('converts create expiration date to an RFC3339 timestamp', async () => {
    const fetchMock = vi.mocked(fetch)
    const createdLink = {
      id: 'link_123',
      short_url: 'https://skrol.test/docs',
      destination_url: 'https://example.com/docs',
      alias: 'docs',
      created_at: '2026-05-16T10:00:00.000Z',
      expires_at: '2026-12-31T23:59:00.000Z',
    }
    const localExpiration = '2026-12-31T23:59'

    fetchMock.mockResolvedValue(await mockJsonResponse(createdLink, 201))

    renderAt('/dashboard/links/new')

    fireEvent.change(await screen.findByRole('textbox', { name: /destination url/i }), {
      target: { value: 'https://example.com/docs' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /custom alias/i }), {
      target: { value: 'docs' },
    })
    fireEvent.change(screen.getByLabelText(/expiration date/i), {
      target: { value: localExpiration },
    })
    fireEvent.click(screen.getByRole('button', { name: /create link/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/links', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/docs',
          alias: 'docs',
          expires_at: new Date(localExpiration).toISOString(),
        }),
      })
    })
  })

  it('shows detail not-found state', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse(
        { error: { code: 'not_found', message: 'Link not found' } },
        404,
      ),
    )

    renderAt('/dashboard/links/link_missing')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /link not found/i })).not.toBeNull()
    })
  })
})
