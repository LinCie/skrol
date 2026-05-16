// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '../../router'

vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => null,
}))

vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

const replaceMock = vi.fn()

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

describe('public frontend redirect route', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, replace: replaceMock },
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    replaceMock.mockReset()
  })

  it('calls backend redirect decision API and navigates for active code', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse({ location: 'https://example.com/docs' }),
    )

    renderAt('/docs')

    expect(await screen.findByText(/redirecting/i)).not.toBeNull()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/v1/redirect/docs', {
        credentials: 'include',
      })
      expect(replaceMock).toHaveBeenCalledWith('https://example.com/docs')
    })
  })

  it('shows not found for missing code', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse({ error: { code: 'not_found', message: 'Link not found' } }, 404),
    )

    renderAt('/missing')

    expect(await screen.findByRole('heading', { name: /link not found/i })).not.toBeNull()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('shows unavailable for gone code', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse({ error: { code: 'gone', message: 'Link unavailable' } }, 410),
    )

    renderAt('/expired')

    expect(await screen.findByRole('heading', { name: /link unavailable/i })).not.toBeNull()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('shows generic error for unexpected API failures', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      await mockJsonResponse({ error: { code: 'server_error', message: 'Boom' } }, 500),
    )

    renderAt('/broken')

    expect(await screen.findByRole('alert')).not.toBeNull()
    expect(screen.getByText(/could not resolve this short link/i)).not.toBeNull()
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
