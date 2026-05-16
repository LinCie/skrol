import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ProductApiError, resolveRedirect } from '../lib/api-client'

export const Route = createFileRoute('/$code')({
  component: PublicRedirectPage,
})

type RedirectState = 'loading' | 'not-found' | 'gone' | 'error'

function PublicRedirectPage() {
  const { code } = Route.useParams()
  const [state, setState] = useState<RedirectState>('loading')

  useEffect(() => {
    let isCurrent = true

    async function resolveCode() {
      try {
        const decision = await resolveRedirect(code)

        if (isCurrent) {
          window.location.replace(decision.location)
        }
      } catch (caughtError) {
        if (!isCurrent) {
          return
        }

        if (caughtError instanceof ProductApiError && caughtError.status === 404) {
          setState('not-found')
          return
        }

        if (caughtError instanceof ProductApiError && caughtError.status === 410) {
          setState('gone')
          return
        }

        setState('error')
      }
    }

    void resolveCode()

    return () => {
      isCurrent = false
    }
  }, [code])

  if (state === 'not-found') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="max-w-md rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Link not found</h1>
          <p className="mt-3 text-sm text-slate-600">This short link does not exist.</p>
        </section>
      </main>
    )
  }

  if (state === 'gone') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section className="max-w-md rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Link unavailable</h1>
          <p className="mt-3 text-sm text-slate-600">
            This short link has expired or was disabled.
          </p>
        </section>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <section
          className="max-w-md rounded-2xl border border-slate-200 p-8 text-center shadow-sm"
          role="alert"
        >
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Redirect failed</h1>
          <p className="mt-3 text-sm text-slate-600">
            Could not resolve this short link. Try again.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <p className="text-sm font-medium text-slate-600">Redirecting...</p>
    </main>
  )
}
