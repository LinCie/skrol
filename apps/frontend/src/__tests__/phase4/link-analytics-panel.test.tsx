import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LinkAnalyticsPanelsView } from '../../routes/dashboard.links.$id'
import { getLinkAnalytics } from '../../lib/api-client'

vi.mock('../../lib/api-client', () => ({
  getLinkAnalytics: vi.fn(),
}))

const getLinkAnalyticsMock = getLinkAnalytics as unknown as {
  mockResolvedValue: (value: unknown) => void
  mockResolvedValueOnce: (value: unknown) => void
  mockRejectedValueOnce: (value: unknown) => void
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
    vi.restoreAllMocks()
    vi.clearAllMocks()
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
