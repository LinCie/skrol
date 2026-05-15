import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/signup')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()

    if (session) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: Signup,
})

function Signup() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('name') ?? '')
    const email = String(formData.get('email') ?? '')
    const password = String(formData.get('password') ?? '')

    const result = await authClient.signUp.email({ name, email, password })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message || 'Signup failed. Check your details.')
      return
    }

    await navigate({ to: '/dashboard' })
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-slate-500">skrol</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Create skrol account
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Create an account to start managing short links.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-800">
            Name
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
              name="name"
              type="text"
              autoComplete="name"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-800">
            Email
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-800">
            Password
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950 outline-none focus:border-slate-950"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="w-full rounded-lg bg-slate-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <a className="font-medium text-slate-950 underline" href="/login">
            Log in
          </a>
        </p>
      </div>
    </main>
  )
}
