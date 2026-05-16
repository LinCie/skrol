// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRouter } from '../../router'
import { authClient } from '../../lib/auth-client'
import { createApiKey, deleteApiKey, listApiKeys } from '../../lib/api-client'

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

vi.mock('../../lib/api-client', () => ({
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  listApiKeys: vi.fn(),
}))

const getSessionMock = vi.mocked(authClient.getSession)
const createApiKeyMock = vi.mocked(createApiKey)
const deleteApiKeyMock = vi.mocked(deleteApiKey)
const listApiKeysMock = vi.mocked(listApiKeys)

const authenticatedSession = {
  data: {
    session: { id: 'session-1' },
    user: { id: 'user-1', email: 'user@example.com' },
  },
  error: null,
}

const apiKeys = [
  {
    id: 'key_123',
    name: 'Production',
    prefix: 'sk_live_1234',
    created_at: '2026-05-16T10:00:00.000Z',
    last_used_at: null,
    expires_at: '2026-06-16T10:00:00.000Z',
    status: 'active' as const,
  },
]

function renderAt(initialEntry: string) {
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  const router = getRouter({ history })

  render(<RouterProvider router={router} />)

  return router
}

describe('dashboard api keys page', () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(authenticatedSession)
    listApiKeysMock.mockResolvedValue({ items: apiKeys })
    createApiKeyMock.mockResolvedValue({
      key: 'sk_live_secret_new_key',
      api_key: {
        id: 'key_new',
        name: 'CLI',
        prefix: 'sk_live_new',
        created_at: '2026-05-16T11:00:00.000Z',
        last_used_at: null,
        expires_at: null,
        status: 'active',
      },
    })
    deleteApiKeyMock.mockResolvedValue(undefined)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('renders api key table headers', async () => {
    renderAt('/dashboard/api-keys')

    expect(await screen.findByRole('columnheader', { name: 'Name' })).not.toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Prefix' })).not.toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Created' })).not.toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Last used' })).not.toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Expires' })).not.toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Status' })).not.toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).not.toBeNull()
  })

  it('creates an api key with numeric expiration seconds', async () => {
    renderAt('/dashboard/api-keys')

    fireEvent.change(await screen.findByRole('textbox', { name: /key name/i }), {
      target: { value: 'CLI' },
    })
    fireEvent.change(screen.getByLabelText(/expiration in seconds/i), {
      target: { value: '3600' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create api key/i }))

    await waitFor(() => {
      expect(createApiKeyMock).toHaveBeenCalledWith({
        name: 'CLI',
        expires_in_seconds: 3600,
      })
    })
  })

  it('shows raw key warning panel after create', async () => {
    renderAt('/dashboard/api-keys')

    fireEvent.change(await screen.findByRole('textbox', { name: /key name/i }), {
      target: { value: 'CLI' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create api key/i }))

    expect(await screen.findByRole('heading', { name: 'Copy this key now' })).not.toBeNull()
    expect(
      screen.getByText('For security, Skrol will not show the full key again.'),
    ).not.toBeNull()
    expect(screen.getByText('sk_live_secret_new_key')).not.toBeNull()
  })

  it('keeps newly created key metadata when initial list resolves late', async () => {
    let resolveList: ((value: { items: typeof apiKeys }) => void) | undefined
    listApiKeysMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve
      }),
    )

    renderAt('/dashboard/api-keys')

    fireEvent.change(await screen.findByRole('textbox', { name: /key name/i }), {
      target: { value: 'CLI' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create api key/i }))

    expect(await screen.findByRole('heading', { name: 'Copy this key now' })).not.toBeNull()
    resolveList?.({ items: apiKeys })

    expect(await screen.findByText('Production')).not.toBeNull()
    expect(screen.getByText('CLI')).not.toBeNull()
    expect(within(screen.getByRole('table')).queryByText('sk_live_secret_new_key')).toBeNull()
  })

  it('shows copy error when clipboard write fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })

    renderAt('/dashboard/api-keys')

    fireEvent.change(await screen.findByRole('textbox', { name: /key name/i }), {
      target: { value: 'CLI' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create api key/i }))
    fireEvent.click(await screen.findByRole('button', { name: /copy key/i }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not copy/i)
    expect(screen.getByText('Production')).not.toBeNull()
  })

  it('copies the one-time key value', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    renderAt('/dashboard/api-keys')

    fireEvent.change(await screen.findByRole('textbox', { name: /key name/i }), {
      target: { value: 'CLI' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create api key/i }))
    fireEvent.click(await screen.findByRole('button', { name: /copy key/i }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('sk_live_secret_new_key')
    })
  })

  it('keeps loaded keys visible when create fails', async () => {
    createApiKeyMock.mockRejectedValueOnce(new Error('server unavailable'))

    renderAt('/dashboard/api-keys')

    fireEvent.change(await screen.findByRole('textbox', { name: /key name/i }), {
      target: { value: 'CLI' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create api key/i }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not create/i)
    expect(screen.getByText('Production')).not.toBeNull()
    expect(screen.getByRole('button', { name: /revoke production/i })).not.toBeNull()
  })

  it('shows created key metadata after initial list load fails', async () => {
    listApiKeysMock.mockRejectedValueOnce(new Error('server unavailable'))

    renderAt('/dashboard/api-keys')

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not load/i)
    fireEvent.change(screen.getByRole('textbox', { name: /key name/i }), {
      target: { value: 'CLI' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create api key/i }))

    expect(await screen.findByRole('heading', { name: 'Copy this key now' })).not.toBeNull()
    expect(screen.getByText('CLI')).not.toBeNull()
    expect(screen.queryByText(/could not load/i)).toBeNull()
  })

  it('asks confirmation before revoking an api key', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderAt('/dashboard/api-keys')

    fireEvent.click(await screen.findByRole('button', { name: /revoke production/i }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
      expect(deleteApiKeyMock).toHaveBeenCalledWith('key_123')
    })
  })
})
