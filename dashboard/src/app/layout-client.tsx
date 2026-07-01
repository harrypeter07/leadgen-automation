'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Toaster } from 'react-hot-toast'

interface LayoutClientProps {
  children: React.ReactNode
}

export default function LayoutClient({ children }: LayoutClientProps) {
  const pathname = usePathname()
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      name: 'Overview',
      href: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      )
    },
    {
      name: 'Leads',
      href: '/leads',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      name: 'WhatsApp',
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
      name: 'Scraper',
      href: '/scraper',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
      name: 'Instagram',
      href: '/instagram-analyzer',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      )
    },
    {
      name: 'Metrics',
      href: '/metrics',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 text-gray-300">
      {/* Brand Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
        <Link href="/" className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
          <span className="text-purple-500">WHSoftec</span> Lead Gen
        </Link>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navLinks.map((link) => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-150 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {link.icon}
              {link.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer Status Indicators */}
      <div className="p-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span>WhatsApp Status:</span>
          {whatsappConnected === null ? (
            <span className="w-2.5 h-2.5 rounded-full bg-gray-600 animate-pulse" title="Checking status" />
          ) : whatsappConnected ? (
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-md shadow-green-500/50" title="Connected" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-md shadow-red-500/50" title="Disconnected" />
          )}
        </div>
        <button
          onClick={checkWhatsappStatus}
          className="text-gray-400 hover:text-white transition-colors"
          title="Force refresh status"
          aria-label="Refresh WhatsApp status"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3m-3-3v12" />
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col md:flex-row font-sans">
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' } }} />

      {/* Mobile Top Bar */}
      <div className="flex md:hidden items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 text-white">
        <Link href="/" className="text-lg font-bold">
          <span className="text-purple-500">WHSoftec</span> Lead Gen
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
      <aside className="hidden md:block w-64 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar - Mobile Slide-out */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          {/* Menu */}
          <div className="relative w-64 max-w-xs flex-1 flex flex-col">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden min-w-0">
        <div className="px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
