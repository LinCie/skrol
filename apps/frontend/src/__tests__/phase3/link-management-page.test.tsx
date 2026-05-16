// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '../../router'
import { authClient } from '../../lib/auth-client'
import { deleteLink, getLink, updateLink } from '../../lib/api-client'
import type * as ApiClient from '../../lib/api-client'
import type { LinkDto } from '../../lib/api-client'

vi.mock('@tanstack/react-devtools', () => ({
  TanStackDevtools: () => null,
}))

vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

vi.mock('../../lib/auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
    signOut: vi.fn(),
  },
}))

vi.mock('../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>()

  return {
    ...actual,
    deleteLink: vi.fn(),
    getLink: vi.fn(),
    updateLink: vi.fn(),
  }
})

const getSessionMock = vi.mocked(authClient.getSession)
const deleteLinkMock = vi.mocked(deleteLink)
const getLinkMock = vi.mocked(getLink)
const updateLinkMock = vi.mocked(updateLink)

const authenticatedSession = {
  data: {
    session: { id: 'session-1' },
    user: { id: 'user-1', email: 'user@example.com' },
  },
  error: null,
}

const activeLink: LinkDto = {
  id: 'link_123',
  short_url: 'https://skrol.test/docs',
  code: 'docs',
  destination_url: 'https://example.com/docs',
  title: 'Docs',
  status: 'active',
  created_at: '2026-05-16T10:00:00.000Z',
  expires_at: null,
}

function renderAt(initialEntry: string) {
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  const router = getRouter({ history })

  render(<RouterProvider router={router} />)

  return router
}

function linkWith(overrides: Partial<LinkDto> = {}) {
  return { ...activeLink, ...overrides }
}

describe('dashboard link management page', () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(authenticatedSession)
    getLinkMock.mockResolvedValue(activeLink)
    updateLinkMock.mockResolvedValue(activeLink)
    deleteLinkMock.mockResolvedValue(undefined)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('renders existing link details after load', async () => {
    renderAt('/dashboard/links/link_123')

    expect(await screen.findByRole('heading', { name: /https:\/\/skrol\.test\/docs/i })).not.toBeNull()
    expect(screen.getByText('docs')).not.toBeNull()
    expect(screen.getByDisplayValue('Docs')).not.toBeNull()
    expect(screen.getByDisplayValue('https://example.com/docs')).not.toBeNull()
  })

  it('updates title and destination from controlled fields', async () => {
    updateLinkMock.mockResolvedValueOnce(
      linkWith({ title: 'Reference Docs', destination_url: 'https://example.com/reference' }),
    )

    renderAt('/dashboard/links/link_123')

    fireEvent.change(await screen.findByRole('textbox', { name: /title/i }), {
      target: { value: 'Reference Docs' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /destination url/i }), {
      target: { value: 'https://example.com/reference' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(updateLinkMock).toHaveBeenCalledWith('link_123', {
        title: 'Reference Docs',
        destination_url: 'https://example.com/reference',
      })
    })
  })

  it('disables an active link', async () => {
    updateLinkMock.mockResolvedValueOnce(linkWith({ status: 'disabled' }))

    renderAt('/dashboard/links/link_123')

    fireEvent.click(await screen.findByRole('button', { name: /disable link/i }))

    await waitFor(() => {
      expect(updateLinkMock).toHaveBeenCalledWith('link_123', { status: 'disabled' })
    })
  })

  it('re-enables a disabled link', async () => {
    getLinkMock.mockResolvedValueOnce(linkWith({ status: 'disabled' }))
    updateLinkMock.mockResolvedValueOnce(linkWith({ status: 'active' }))

    renderAt('/dashboard/links/link_123')

    fireEvent.click(await screen.findByRole('button', { name: /re-enable link/i }))

    await waitFor(() => {
      expect(updateLinkMock).toHaveBeenCalledWith('link_123', { status: 'active' })
    })
  })

  it('asks confirmation before deleting a link', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const router = renderAt('/dashboard/links/link_123')

    fireEvent.click(await screen.findByRole('button', { name: /delete link/i }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Delete this link?')
      expect(deleteLinkMock).toHaveBeenCalledWith('link_123')
      expect(router.state.location.pathname).toBe('/dashboard/links')
    })
  })
})
