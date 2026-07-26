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
  RefreshCw, 
  Brain, 
  Zap, 
  Search, 
  Mail, 
  Globe, 
  Camera, 
  BarChart3, 
  Fish, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Menu, 
  X,
  Smartphone,
  Sparkles
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

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'Leads List', href: '/leads', icon: <Users className="w-4 h-4" /> },
    { name: 'WhatsApp Bot', href: '/whatsapp', icon: <Smartphone className="w-4 h-4" /> },
    { name: 'Workflows', href: '/workflows', icon: <RefreshCw className="w-4 h-4" /> },
    { name: 'Agentic Brain', href: '/automation/agent-brain', icon: <Brain className="w-4 h-4" /> },
    { name: 'Social Automation', href: '/automation', icon: <Zap className="w-4 h-4" /> },
    { name: 'Google Scraper', href: '/scraper', icon: <Search className="w-4 h-4" /> },
    { name: 'Email Outreach', href: '/automation/email-outreach', icon: <Mail className="w-4 h-4" /> },
    { name: 'Web Audit', href: '/website-analyzer', icon: <Globe className="w-4 h-4" /> },
    { name: 'Instagram Audit', href: '/instagram-analyzer', icon: <Camera className="w-4 h-4" /> },
    { name: 'System Metrics', href: '/metrics', icon: <BarChart3 className="w-4 h-4" /> },
    { name: 'TinyFish Search', href: '/tinyfish', icon: <Fish className="w-4 h-4" /> },
    { name: 'Settings', href: '/settings', icon: <Settings className="w-4 h-4" /> },
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
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  title={sidebarCollapsed ? link.name : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm shadow-blue-500/15 font-semibold'
                      : 'text-zinc-400 hover:bg-blue-500/10 hover:text-zinc-100 hover:border hover:border-blue-500/20 border border-transparent'
                  } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <span className={isActive ? 'text-blue-400' : 'text-zinc-400'}>{link.icon}</span>
                  {!sidebarCollapsed && <span>{link.name}</span>}
                </Link>
              )
            })}
          </nav>

          {/* WhatsApp Connection Status Badge & Logout */}
          <div className="p-3 border-t border-blue-500/15 space-y-2 bg-blue-950/20">
            {!sidebarCollapsed && (
              <div className="p-2.5 rounded-xl border border-blue-500/20 bg-blue-900/10 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">WhatsApp Engine</span>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold font-mono ${whatsappConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${whatsappConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {whatsappConnected ? 'READY' : 'OFFLINE'}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border hover:border-rose-500/20 border border-transparent transition-all ${
                sidebarCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="md:hidden h-14 border-b border-blue-500/15 px-4 flex items-center justify-between glass z-40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-sm shadow-blue-500/30">
              S
            </div>
            <span className="text-xs font-bold text-foreground">Stratnent Portal</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-blue-500/20 text-blue-300 hover:bg-blue-500/10"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile Slideout Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-14 z-50 glass bg-black/80 backdrop-blur-xl p-4 overflow-y-auto space-y-2 border-t border-blue-500/20">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold ${
                    isActive ? 'bg-blue-600/30 border border-blue-500/40 text-blue-200' : 'text-zinc-300 hover:bg-blue-500/10'
                  }`}
                >
                  {link.icon}
                  <span>{link.name}</span>
                </Link>
              )
            })}
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-transparent">
          {children}
        </main>
      </div>
    </div>
  )
}
