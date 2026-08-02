'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { Button, Card, Input } from '@/components'
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
        router.push('/')
        router.refresh()
      } else {
        const errorMsg = typeof data.error === 'object' ? (data.error?.message || 'Authentication failed.') : (data.error || 'Authentication failed. Incorrect password.')
        toast.error(errorMsg)
      }
    } catch {
      toast.error('Unable to reach the authentication service.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center relative overflow-hidden font-sans select-none p-4">
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#1c1c1e', color: '#f3f4f6', border: '1px solid #2d2d30' } }} />

      {/* Decorative gradient background glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[140px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[140px]" />

      <div className="w-full max-w-md px-4 z-10 animate-fade-in">
        {/* Stratnent Logo Banner */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="Stratnent logo"
            className="w-16 h-16 rounded-2xl object-cover shadow-2xl border border-blue-500/20 transform hover:scale-105 transition-transform duration-300"
          />
          <h1 className="text-2xl font-bold text-white tracking-tight mt-4 flex items-center gap-2">
            <span>Stratnent</span>
            <span className="text-xs uppercase bg-blue-950/60 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-mono font-normal">ADMIN</span>
          </h1>
          <p className="text-zinc-400 text-xs mt-1 uppercase tracking-wider font-semibold">Marketing Automation &amp; CRM Portal</p>
        </div>

        {/* Login Card */}
        <Card className="p-8 shadow-2xl relative border-blue-500/20 bg-slate-950/80 backdrop-blur-xl">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-80" />
          
          <div className="flex items-center gap-2.5 mb-2">
            <Lock className="w-4 h-4 text-blue-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Security Verification</h2>
          </div>
          <p className="text-zinc-400 text-xs mb-6">Enter the security credential configured in your environment to unlock full admin access.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">Access Key / Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="pr-12 font-mono text-sm"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              variant="primary"
              size="large"
              className="w-full font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-500/20"
            >
              Authenticate &amp; Unlock
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
