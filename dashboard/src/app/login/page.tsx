'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { Button, Input, Card } from '@/components'
import { Eye, EyeOff, Lock } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      toast.error('Please enter the security password')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('Access granted. Redirecting...')
        router.push('/dashboard')
        router.refresh()
      } else {
        toast.error(typeof data.error === 'object' ? data.error?.message : (data.error || 'Authentication failed.'))
      }
    } catch {
      toast.error('Unable to reach authentication service.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-page text-ink flex items-center justify-center p-6 select-none font-body">
      <Toaster position="top-right" />

      <div className="w-full max-w-[440px] animate-fade-in">
        {/* Logo Banner Lockup */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-sm bg-lime text-ink flex items-center justify-center font-extrabold text-2xl tracking-tight shadow-sm mb-4">
            L
          </div>
          <h1 className="text-3xl font-extrabold text-ink font-display tracking-tight flex items-center gap-2 justify-center">
            <span>Stratnent AI</span>
            <span className="text-[10px] uppercase bg-ink text-lime px-2 py-0.5 rounded-pill font-mono">PRO</span>
          </h1>
          <p className="text-text-muted text-xs uppercase tracking-button font-bold mt-1">Lead Gen &amp; Social Automation Portal</p>
        </div>

        {/* Login Card */}
        <Card variant="page-alt" className="rounded-xl p-8 lg:p-10 border-none shadow-none">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-ink" />
            <h2 className="text-xl font-bold text-ink font-display">Security Verification</h2>
          </div>
          <p className="text-text-muted text-xs mb-6 font-medium leading-relaxed">
            Enter the admin password configured in your environment to unlock the platform.
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-text-muted text-[11px] font-bold uppercase tracking-eyebrow mb-2">
                Access Key / Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-12 rounded-pill bg-page border-none px-5 text-sm text-ink font-mono focus:ring-2 focus:ring-lime pr-12"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-ink transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              variant="primary"
              size="lg"
              className="w-full"
              iconType="arrow-right"
            >
              Enter Dashboard
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
