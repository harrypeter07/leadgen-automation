// dashboard/src/app/layout-client.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'

interface LayoutClientProps {
  children: React.ReactNode
}

export default function LayoutClient({ children }: LayoutClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const theme: 'dark' | 'light' = 'light' // Enforce light theme throughout the application

  // Load preferences from localStorage on mount
  useEffect(() => {
    document.documentElement.className = 'light'
    document.documentElement.setAttribute('data-theme', 'light')
    
    const savedCollapse = localStorage.getItem('stratnent_main_sidebar_collapsed')
    if (savedCollapse) {
      setSidebarCollapsed(savedCollapse === 'true')
    }
  }, [])

  const toggleSidebar = () => {
    const nextCollapse = !sidebarCollapsed
    setSidebarCollapsed(nextCollapse)
    localStorage.setItem('stratnent_main_sidebar_collapsed', String(nextCollapse))
  }

  // Handle user logout
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/logout', { method: 'POST' })
      if (res.ok) {
        toast.success('Logged out successfully.')
        router.push('/login')
        router.refresh()
      } else {
        toast.error('Logout failed.')
      }
    } catch {
      toast.error('Network error during logout.')
    }
  }

  // Fetch WhatsApp status
  async function checkWhatsappStatus() {
    try {
      const res = await fetch('/api/whatsapp/health')
      if (res.ok) {
        const data = await res.json()
        setWhatsappConnected(data.ready)
      } else {
        setWhatsappConnected(false)
      }
    } catch {
      setWhatsappConnected(false)
    }
  }

  useEffect(() => {
    checkWhatsappStatus()
    const interval = setInterval(checkWhatsappStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const navLinks = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      )
    },
    {
      name: 'Leads List',
      href: '/leads',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      name: 'WhatsApp Bot',
      href: '/whatsapp',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'Workflows',
      href: '/workflows',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      name: 'Agentic Brain',
      href: '/automation/agent-brain',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    },
    {
      name: 'Social Automation',
      href: '/automation',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      name: 'Google Scraper',
      href: '/scraper',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      name: 'Email Outreach',
      href: '/automation/email-outreach',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'Web Audit',
      href: '/website-analyzer',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'Instagram Audit',
      href: '/instagram-analyzer',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      )
    },
    {
      name: 'System Metrics',
      href: '/metrics',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
        </svg>
      )
    },
    {
      name: 'TinyFish Search',
      href: '/tinyfish',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
    },
    {
      name: 'Webhook Logs',
      href: '/automation/webhook-debugger',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.828a5 5 0 117.072 0M12 13v.01" />
        </svg>
      )
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ]

  const isDark = false

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 text-slate-650 transition-colors select-none">
      {/* Brand Logo - Stratnent Style */}
      <div className={`flex items-center gap-3 px-6 py-5 border-b border-slate-150 ${sidebarCollapsed ? 'justify-center px-2' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="Stratnent logo"
          className="w-8 h-8 rounded-lg object-cover shadow-sm flex-shrink-0"
        />
        {!sidebarCollapsed && (
          <Link href="/" className="text-lg font-black tracking-tight flex items-center gap-1.5 text-slate-900">
            <span>Stratnent</span>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-semibold bg-slate-100 text-slate-500">ADMIN</span>
          </Link>
        )}
      </div>

      {/* User profile widget inside sidebar */}
      {!sidebarCollapsed ? (
        <div className="px-6 py-5 border-b border-slate-150 flex flex-col items-center text-center">
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-rose-500 to-orange-400 p-0.5 shadow-md">
            <div className="w-full h-full rounded-full flex items-center justify-center bg-white text-rose-600 text-sm font-black border border-rose-100">
              OP
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white bg-green-500 shadow-sm" />
          </div>
          <span className="mt-2.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Welcome Back,</span>
          <span className="text-xs font-bold tracking-tight mt-0.5 text-slate-800">Operator LeadGen</span>
          <button
            onClick={handleLogout}
            className="mt-2.5 px-2.5 py-1 text-[9px] uppercase tracking-wider rounded-lg border transition-all duration-200 active:scale-95 flex items-center gap-1.5 focus:outline-none bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600"
          >
            Logout
          </button>
        </div>
      ) : (
        <div className="py-4 border-b border-slate-150 flex justify-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-orange-400 p-0.5">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-rose-600 text-[10px] font-black border border-rose-100">
              OP
            </div>
          </div>
        </div>
      )}

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navLinks.map((link) => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              title={sidebarCollapsed ? link.name : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'text-rose-600 bg-rose-50/80 font-extrabold shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              {isActive && (
                <span className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-rose-600 rounded-r-md" />
              )}
              <span className={`transition-colors duration-200 ${isActive ? 'text-rose-600' : 'text-slate-400 group-hover:text-slate-650'}`}>
                {link.icon}
              </span>
              {!sidebarCollapsed && <span>{link.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer Status Indicators */}
      <div className="p-4 border-t border-slate-150 flex flex-col gap-2.5 text-[10px] text-slate-500">
        {!sidebarCollapsed && (
          <>
            <div className="flex items-center justify-between pt-1">
              <span className="font-semibold uppercase tracking-wider text-[9px]">WhatsApp Status</span>
              {whatsappConnected === null ? (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 font-mono text-[8px] animate-pulse">CHECKING</span>
              ) : whatsappConnected ? (
                <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-mono text-[8px] font-bold border border-green-200">ONLINE</span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 font-mono text-[8px] font-bold border border-rose-200">OFFLINE</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-slate-400">Engine Node:</span>
              <span className="font-mono text-slate-600 font-semibold">Railway v3</span>
            </div>
          </>
        )}
      </div>
    </div>
  )

  if (pathname === '/login') {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#1c1c1e', color: '#f3f4f6', border: '1px solid #2d2d30' } }} />
        {children}
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-slate-50 text-slate-900">
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0' } }} />

      <div className="flex md:hidden items-center justify-between px-6 py-4 border-b bg-slate-900 border-slate-800 text-white">
        <Link href="/" className="text-base font-black flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="Stratnent logo"
            className="w-6 h-6 rounded object-cover shadow-sm"
          />
          <span>Stratnent Admin</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 rounded-md text-gray-400 hover:text-white focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Sidebar - Desktop */}
      <aside 
        className="hidden md:block flex-shrink-0 z-20 transition-all duration-300 relative"
        style={{ width: sidebarCollapsed ? '64px' : '256px' }}
      >
        <div className="h-screen sticky top-0">
          {/* Main Sidebar Collapse Arrow Trigger (Stratnent Style) */}
          <button
            onClick={toggleSidebar}
            className={`absolute -right-3 top-7 z-30 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 border transition-all shadow-md focus:outline-none ${
              isDark ? 'bg-[#252528] border-[#3D3D40] hover:text-white' : 'bg-white border-gray-300 hover:text-gray-900'
            }`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className={`w-3 h-3 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <SidebarContent />
        </div>
      </aside>

      {/* Sidebar - Mobile Slide-out */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          {/* Menu */}
          <div className="relative w-64 max-w-xs flex-1 flex flex-col h-full z-10">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden min-w-0">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  )
}
