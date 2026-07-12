'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

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
        toast.error(data.error || 'Authentication failed. Incorrect password.')
      }
    } catch {
      toast.error('Unable to reach the authentication service.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#141416] flex items-center justify-center relative overflow-hidden font-sans select-none">
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#1c1c1e', color: '#f3f4f6', border: '1px solid #2d2d30' } }} />

      {/* Decorative gradient background glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#E3B859]/5 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-600/5 blur-[120px]" />

      <div className="w-full max-w-md px-6 z-10 animate-fade-in">
        {/* Stratnent Logo Banner */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="Stratnent logo"
            className="w-16 h-16 rounded-2xl object-cover shadow-xl shadow-[#E3B859]/5 transform hover:scale-105 transition-transform duration-300"
          />
          <h1 className="text-2xl font-bold text-white tracking-tight mt-4 flex items-center gap-2">
            <span>Stratnent</span>
            <span className="text-xs uppercase bg-[#252528] text-gray-400 px-2 py-0.5 rounded font-mono font-normal">ADMIN</span>
          </h1>
          <p className="text-gray-500 text-xs mt-1 uppercase tracking-wider font-semibold">Marketing Automation &amp; CRM Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#18181A] border border-[#252528] rounded-2xl p-8 shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#E3B859] to-transparent opacity-60" />
          
          <h2 className="text-lg font-bold text-white tracking-tight mb-2">Security Verification</h2>
          <p className="text-gray-400 text-xs mb-6">Enter the security credential configured in your env file to unlock access to the system.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Access Key / Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-[#202022] border border-[#2e2e32] focus:border-[#E3B859] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors duration-250 pr-10 font-mono"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-[#E3B859]/10 focus:outline-none transition-colors duration-200 flex items-center justify-center gap-2 select-none active:scale-[0.98] transform"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-[#141416]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
