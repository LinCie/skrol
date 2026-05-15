import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

type RouterOptions = {
  history?: RouterHistory
}

export function getRouter(options: RouterOptions = {}) {
  const router = createTanStackRouter({
    routeTree,
    history: options.history,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
