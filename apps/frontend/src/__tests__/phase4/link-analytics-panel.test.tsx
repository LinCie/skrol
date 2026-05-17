// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LinkAnalyticsPanels, LinkAnalyticsPanelsView } from '../../routes/dashboard.links.$id'
import { getLinkAnalytics } from '../../lib/api-client'

vi.mock('../../lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api-client')>(
    '../../lib/api-client',
  )

  return {
    ...actual,
    getLinkAnalytics: vi.fn(),
  }
})

const getLinkAnalyticsMock = getLinkAnalytics as unknown as {
  mockResolvedValue: (value: unknown) => void
  mockResolvedValueOnce: (value: unknown) => void
  mockRejectedValueOnce: (value: unknown) => void
  mockReturnValueOnce: (value: Promise<unknown>) => void
}

describe('link analytics panels', () => {
  beforeEach(() => {
    getLinkAnalyticsMock.mockResolvedValue({
      data: {
        link_id: 'link_1',
        total_clicks: 0,
        clicks_over_time: [],
        referrers: [],
        browsers: [],
        devices: [],
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('shows loading then analytics data in live wrapper', async () => {
    getLinkAnalyticsMock.mockResolvedValueOnce({
      data: {
        link_id: 'link_1',
        total_clicks: 3,
        clicks_over_time: [{ bucket_start: '2026-05-01T00:00:00.000Z', clicks: 3 }],
        referrers: [{ referrer_domain: 'direct', clicks: 2 }],
        browsers: [{ browser: 'Chrome', clicks: 2 }],
        devices: [{ device: 'desktop', clicks: 3 }],
      },
    })

    render(<LinkAnalyticsPanels linkId="link_1" />)

    expect(screen.getByText('Loading analytics...')).toBeTruthy()

    expect(await screen.findByRole('heading', { name: 'Analytics' })).toBeTruthy()
    expect(screen.getByText('Total clicks')).toBeTruthy()
    expect(screen.getByText((text) => /2026/.test(text) && /: 3$/.test(text))).toBeTruthy()
    expect(screen.getByText('direct: 2')).toBeTruthy()
  })

  it('shows error state when live load fails', async () => {
    getLinkAnalyticsMock.mockRejectedValueOnce(new Error('server unavailable'))

    render(<LinkAnalyticsPanels linkId="link_1" />)

    expect(await screen.findByRole('alert')).not.toBeNull()
    expect(screen.getByRole('alert').textContent).toMatch(/could not load analytics/i)
  })

  it('resets loading state when link id changes', async () => {
    let resolveSecond: ((value: unknown) => void) | undefined

    getLinkAnalyticsMock.mockResolvedValueOnce({
      data: {
        link_id: 'link_1',
        total_clicks: 1,
        clicks_over_time: [],
        referrers: [],
        browsers: [],
        devices: [],
      },
    })
    getLinkAnalyticsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSecond = resolve
      }),
    )

    const { rerender } = render(<LinkAnalyticsPanels linkId="link_1" />)

    expect(await screen.findByText('Total clicks')).toBeTruthy()

    rerender(<LinkAnalyticsPanels linkId="link_2" />)

    expect(screen.getByText('Loading analytics...')).toBeTruthy()
    expect(screen.queryByText('Total clicks')).toBeNull()

    resolveSecond?.({
      data: {
        link_id: 'link_2',
        total_clicks: 2,
        clicks_over_time: [],
        referrers: [],
        browsers: [],
        devices: [],
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Analytics' })).toBeTruthy()
      expect(screen.getByText('Total clicks')).toBeTruthy()
    })
  })

  it('shows empty analytics state when totals are zero', async () => {
    const markup = renderToStaticMarkup(
      <LinkAnalyticsPanelsView
        analytics={{
          link_id: 'link_1',
          total_clicks: 0,
          clicks_over_time: [],
          referrers: [],
          browsers: [],
          devices: [],
        }}
      />,
    )

    expect(markup).toContain('No clicks recorded yet')
    expect(markup).toContain('Total clicks')
    expect(markup).toContain('Referrers')
    expect(markup).toContain('Browsers')
    expect(markup).toContain('Devices')
  })

  it('hides country panel when countries field omitted', async () => {
    const markup = renderToStaticMarkup(
      <LinkAnalyticsPanelsView
        analytics={{
          link_id: 'link_1',
          total_clicks: 0,
          clicks_over_time: [],
          referrers: [],
          browsers: [],
          devices: [],
        }}
      />,
    )

    expect(markup).not.toContain('Countries')
  })

  it('shows country panel when countries is present', async () => {
    const markup = renderToStaticMarkup(
      <LinkAnalyticsPanelsView
        analytics={{
          link_id: 'link_1',
          total_clicks: 1,
          clicks_over_time: [],
          referrers: [],
          browsers: [],
          devices: [],
          countries: [],
        }}
      />,
    )

    expect(markup).toContain('Countries')
  })

  it('renders time series and breakdown items', async () => {
    const markup = renderToStaticMarkup(
      <LinkAnalyticsPanelsView
        analytics={{
          link_id: 'link_1',
          total_clicks: 3,
          clicks_over_time: [{ bucket_start: '2026-05-01T00:00:00.000Z', clicks: 3 }],
          referrers: [{ referrer_domain: 'direct', clicks: 2 }],
          browsers: [{ browser: 'Chrome', clicks: 2 }],
          devices: [{ device: 'desktop', clicks: 3 }],
        }}
      />,
    )

    expect(markup).toMatch(/2026.*: 3/)
    expect(markup).toContain('direct: 2')
    expect(markup).toContain('Chrome: 2')
    expect(markup).toContain('desktop: 3')
  })

  it('renders breakdown items', async () => {
    const markup = renderToStaticMarkup(
      <LinkAnalyticsPanelsView
        analytics={{
          link_id: 'link_1',
          total_clicks: 3,
          clicks_over_time: [{ bucket_start: '2026-05-01T00:00:00.000Z', clicks: 3 }],
          referrers: [{ referrer_domain: 'direct', clicks: 2 }],
          browsers: [{ browser: 'Chrome', clicks: 2 }],
          devices: [{ device: 'desktop', clicks: 3 }],
        }}
      />,
    )

    expect(markup).toContain('direct: 2')
    expect(markup).toContain('Chrome: 2')
    expect(markup).toContain('desktop: 3')
  })
})
