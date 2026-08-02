// dashboard/src/app/layout-client.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Zap, 
  Share2, 
  BarChart3, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Menu, 
  X,
  Smartphone,
  Sparkles,
  Command
} from 'lucide-react'

interface LayoutClientProps {
  children: React.ReactNode
}

export default function LayoutClient({ children }: LayoutClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
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

  // Workflow-Driven 7 Core Workspaces Navigation
  const navLinks = [
    { name: 'Command Center', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'Leads & Intelligence', href: '/leads', icon: <Users className="w-4 h-4" /> },
    { name: 'Outreach & Messaging', href: '/outreach', icon: <MessageSquare className="w-4 h-4" /> },
    { name: 'Automation Engine', href: '/automation', icon: <Zap className="w-4 h-4" /> },
    { name: 'Publishing & Media', href: '/publishing', icon: <Share2 className="w-4 h-4" /> },
    { name: 'Analytics & Metrics', href: '/analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { name: 'System Settings', href: '/settings', icon: <Settings className="w-4 h-4" /> },
  ]

  if (pathname === '/login') {
    return (
      <>
        <Toaster position="top-right" />
        {children}
      </>
    )
  }

  return (
    <div className="min-h-screen flex bg-[#080c14] text-foreground antialiased font-sans selection:bg-blue-500/30 selection:text-blue-200">
      <Toaster position="top-right" />

      {/* Main Left Sidebar */}
      <aside 
        className="hidden md:flex border-r border-blue-500/15 glass flex-col justify-between flex-shrink-0 relative transition-all duration-300 z-30 shadow-2xl"
        style={{ width: sidebarCollapsed ? '76px' : '250px' }}
      >
        <button
          onClick={toggleSidebar}
          className="absolute -right-3.5 top-6 z-40 w-7 h-7 rounded-full border border-blue-500/30 flex items-center justify-center text-blue-300 hover:text-white bg-[#0b1324] shadow-md shadow-blue-500/20 transition-all hover:scale-105"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} />
        </button>

        <div className="overflow-hidden flex flex-col h-full">
          {/* Logo Brand Header */}
          <div className="h-16 border-b border-blue-500/15 px-4 flex items-center justify-between flex-shrink-0 bg-blue-950/20">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-sm text-white shadow-md shadow-blue-500/25 border border-blue-400/30">
                  S
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
                    Stratnent Portal
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                  </span>
                  <span className="text-[10px] text-blue-300/80 font-mono">Lead Gen & Social AI</span>
                </div>
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-sm text-white mx-auto shadow-md shadow-blue-500/25 border border-blue-400/30">
                S
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div className="px-3 py-4 flex-1 overflow-y-auto space-y-1.5 custom-scrollbar">
            {!sidebarCollapsed && (
              <div className="text-[10px] font-mono uppercase tracking-wider text-blue-400/60 px-3 py-1 font-semibold">
                Workspaces
              </div>
            )}
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-blue-600/20 text-white border border-blue-500/30 shadow-md shadow-blue-500/10'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-blue-500/10 border border-transparent'
                  }`}
                  title={sidebarCollapsed ? link.name : undefined}
                >
                  <span className={`transition-colors ${isActive ? 'text-blue-400' : 'group-hover:text-blue-400'}`}>
                    {link.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="truncate flex-1">{link.name}</span>
                  )}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2.5 py-1 bg-zinc-900 text-zinc-200 text-xs rounded-md shadow-xl border border-zinc-800 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                      {link.name}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Sidebar Footer: WhatsApp Status Badge */}
          <div className="p-3 border-t border-blue-500/15 bg-blue-950/10 flex-shrink-0">
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between glass px-3 py-2 rounded-xl border border-blue-500/20 text-xs">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  <span className="text-zinc-300 font-medium text-[11px]">WhatsApp Engine</span>
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    whatsappConnected === true
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : whatsappConnected === false
                      ? 'bg-red-400 shadow-sm shadow-red-400/50'
                      : 'bg-zinc-500'
                  }`}
                  title={whatsappConnected === true ? 'WhatsApp Connected' : 'WhatsApp Disconnected'}
                />
              </div>
            ) : (
              <div
                className={`w-3 h-3 rounded-full mx-auto ${
                  whatsappConnected === true
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    : whatsappConnected === false
                    ? 'bg-red-400 shadow-sm shadow-red-400/50'
                    : 'bg-zinc-500'
                }`}
                title={whatsappConnected === true ? 'WhatsApp Connected' : 'WhatsApp Disconnected'}
              />
            )}
          </div>
        </div>
      </aside>

      {/* Main Viewport Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top App Bar Header */}
        <header className="h-16 border-b border-blue-500/15 glass px-4 sm:px-8 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-blue-500/10"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-blue-400/80 uppercase font-semibold hidden sm:inline-block">Workspace:</span>
              <span className="text-xs font-bold text-white glass px-3 py-1 rounded-lg border border-blue-500/30">
                Primary LeadGen Workspace
              </span>
            </div>
          </div>

          {/* Quick Right Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/15 text-xs font-semibold transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-blue-500/20 glass p-4 space-y-1 z-40 bg-[#080c14]">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                    isActive ? 'bg-blue-600/20 text-white border border-blue-500/30' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {link.icon}
                  {link.name}
                </Link>
              )
            })}
          </div>
        )}

        {/* Workspace Children */}
        <main className="flex-1 overflow-y-auto bg-[#080c14] relative">
          {children}
        </main>
      </div>
    </div>
  )
}
