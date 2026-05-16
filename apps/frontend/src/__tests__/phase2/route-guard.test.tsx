// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '../../router'
import { authClient } from '../../lib/auth-client'

vi.mock('../../lib/auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
  },
}))

const getSessionMock = vi.mocked(authClient.getSession)

const unauthenticatedSession = {
  data: {
    session: null,
    user: null,
  },
  error: null,
}

function renderAt(initialEntry: string) {
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  const router = getRouter({ history })

  render(<RouterProvider router={router} />)

  return router
}

describe('route auth guards', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('redirects unauthenticated dashboard access to login', async () => {
    getSessionMock.mockResolvedValue(unauthenticatedSession)

    const router = renderAt('/dashboard')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
  })

  it('preserves the attempted dashboard target on redirect to login', async () => {
    getSessionMock.mockResolvedValue(unauthenticatedSession)

    const router = renderAt('/dashboard?tab=links')

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        redirect: '/dashboard?tab=links',
      })
    })
  })

  it.each(['/login', '/signup'])(
    'redirects authenticated users from %s to dashboard',
    async (path) => {
      getSessionMock.mockResolvedValue({
        data: {
          session: { id: 'session-1' },
          user: { id: 'user-1', email: 'user@example.com' },
        },
        error: null,
      })

      const router = renderAt(path)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard')
      })
    },
  )

  it.each(['/login', '/signup'])(
    'allows unauthenticated users to stay on %s when session payload has null session',
    async (path) => {
      getSessionMock.mockResolvedValue(unauthenticatedSession)

      const router = renderAt(path)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(path)
      })
    },
  )

  it('restores a safe internal redirect target for authenticated login users', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: { id: 'session-1' },
        user: { id: 'user-1', email: 'user@example.com' },
      },
      error: null,
    })

    const target = encodeURIComponent('/dashboard?tab=links')
    const router = renderAt(`/login?redirect=${target}`)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard')
      expect(router.state.location.search).toEqual({ tab: 'links' })
    })
  })

  it.each(['https://evil.test', '//evil.test'])(
    'falls back to dashboard for unsafe login redirect %s',
    async (unsafeRedirect) => {
      getSessionMock.mockResolvedValue({
        data: {
          session: { id: 'session-1' },
          user: { id: 'user-1', email: 'user@example.com' },
        },
        error: null,
      })

      const router = renderAt(
        `/login?redirect=${encodeURIComponent(unsafeRedirect)}`,
      )

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard')
        expect(router.state.location.search).toEqual({})
      })
    },
  )
})
