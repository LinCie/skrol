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
    signIn: {
      email: vi.fn(),
    },
    signUp: {
      email: vi.fn(),
    },
    signOut: vi.fn(),
  },
}))

const getSessionMock = vi.mocked(authClient.getSession)
const signInEmailMock = vi.mocked(authClient.signIn.email)
const signUpEmailMock = vi.mocked(authClient.signUp.email)
const signOutMock = vi.mocked(authClient.signOut)

const authenticatedSession = {
  data: {
    session: { id: 'session-1' },
    user: { id: 'user-1', email: 'user@example.com' },
  },
  error: null,
}

const unauthenticatedSession = { data: null, error: null }

function renderAt(initialEntry: string) {
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  const router = getRouter({ history })

  render(<RouterProvider router={router} />)

  return router
}

async function fillTextField(name: RegExp, value: string) {
  fireEvent.change(await screen.findByRole('textbox', { name }), {
    target: { value },
  })
}

async function fillPassword(value: string) {
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value },
  })
}

describe('auth pages', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('renders custom login and signup forms', async () => {
    getSessionMock.mockResolvedValue(unauthenticatedSession)

    renderAt('/login')

    expect(
      await screen.findByRole('heading', { name: /log in to skrol/i }),
    ).not.toBeNull()
    expect(screen.getByRole('textbox', { name: /email/i })).not.toBeNull()
    expect(screen.getByLabelText(/password/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: /log in/i })).not.toBeNull()

    cleanup()
    getSessionMock.mockResolvedValue(unauthenticatedSession)
    renderAt('/signup')

    expect(
      await screen.findByRole('heading', { name: /create skrol account/i }),
    ).not.toBeNull()
    expect(screen.getByRole('textbox', { name: /name/i })).not.toBeNull()
    expect(screen.getByRole('textbox', { name: /email/i })).not.toBeNull()
    expect(screen.getByLabelText(/password/i)).not.toBeNull()
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).not.toBeNull()
  })

  it('calls Better Auth on login and navigates to a safe redirect target', async () => {
    getSessionMock
      .mockResolvedValueOnce(unauthenticatedSession)
      .mockResolvedValue(authenticatedSession)
    signInEmailMock.mockResolvedValue({ data: authenticatedSession.data, error: null })

    const router = renderAt('/login?redirect=%2Fdashboard%3Ftab%3Dlinks')

    await fillTextField(/email/i, 'user@example.com')
    await fillPassword('password123')
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      })
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard')
      expect(router.state.location.search).toEqual({ tab: 'links' })
    })
  })

  it('calls Better Auth on signup and navigates to dashboard', async () => {
    getSessionMock
      .mockResolvedValueOnce(unauthenticatedSession)
      .mockResolvedValue(authenticatedSession)
    signUpEmailMock.mockResolvedValue({
      data: authenticatedSession.data,
      error: null,
    })

    const router = renderAt('/signup')

    await fillTextField(/name/i, 'User Example')
    await fillTextField(/email/i, 'user@example.com')
    await fillPassword('password123')
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(signUpEmailMock).toHaveBeenCalledWith({
        name: 'User Example',
        email: 'user@example.com',
        password: 'password123',
      })
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard')
    })
  })

  it('shows actionable login and signup errors', async () => {
    getSessionMock.mockResolvedValue(unauthenticatedSession)
    signInEmailMock.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email or password', status: 401 },
    })

    renderAt('/login')

    await fillTextField(/email/i, 'user@example.com')
    await fillPassword('bad-password')
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /invalid email or password/i,
    )

    cleanup()
    getSessionMock.mockResolvedValue(unauthenticatedSession)
    signUpEmailMock.mockResolvedValue({
      data: null,
      error: { message: 'Password must be at least 8 characters', status: 422 },
    })

    renderAt('/signup')

    await fillTextField(/name/i, 'User Example')
    await fillTextField(/email/i, 'user@example.com')
    await fillPassword('short')
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /password must be at least 8 characters/i,
    )
  })

  it('exposes logout, signs out, redirects to login, and blocks dashboard afterward', async () => {
    getSessionMock
      .mockResolvedValueOnce(authenticatedSession)
      .mockResolvedValue(unauthenticatedSession)
    signOutMock.mockResolvedValue({ data: null, error: null })

    const router = renderAt('/dashboard')

    fireEvent.click(await screen.findByRole('button', { name: /log out/i }))

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1)
      expect(router.state.location.pathname).toBe('/login')
    })

    await router.navigate({ to: '/dashboard' })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
  })
})
