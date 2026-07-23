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
  Smartphone
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
    { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Leads List', href: '/leads', icon: <Users className="w-5 h-5" /> },
    { name: 'WhatsApp Bot', href: '/whatsapp', icon: <Smartphone className="w-5 h-5" /> },
    { name: 'Workflows', href: '/workflows', icon: <RefreshCw className="w-5 h-5" /> },
    { name: 'Agentic Brain', href: '/automation/agent-brain', icon: <Brain className="w-5 h-5" /> },
    { name: 'Social Automation', href: '/automation', icon: <Zap className="w-5 h-5" /> },
    { name: 'Google Scraper', href: '/scraper', icon: <Search className="w-5 h-5" /> },
    { name: 'Email Outreach', href: '/automation/email-outreach', icon: <Mail className="w-5 h-5" /> },
    { name: 'Web Audit', href: '/website-analyzer', icon: <Globe className="w-5 h-5" /> },
    { name: 'Instagram Audit', href: '/instagram-analyzer', icon: <Camera className="w-5 h-5" /> },
    { name: 'System Metrics', href: '/metrics', icon: <BarChart3 className="w-5 h-5" /> },
    { name: 'TinyFish Search', href: '/tinyfish', icon: <Fish className="w-5 h-5" /> },
    { name: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
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
    <div className="min-h-screen flex bg-background text-foreground antialiased font-sans">
      <Toaster position="top-right" />

      {/* Main Left Sidebar */}
      <aside 
        className="hidden md:flex border-r border-border bg-card flex-col justify-between flex-shrink-0 relative transition-all duration-300 z-30"
        style={{ width: sidebarCollapsed ? '72px' : '240px' }}
      >
        <button
          onClick={toggleSidebar}
          className="absolute -right-3.5 top-6 z-40 w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground bg-card shadow-sm transition-transform"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} />
        </button>

        <div className="overflow-hidden flex flex-col h-full">
          {/* Logo Brand Header */}
          <div className="h-16 border-b border-border px-4 flex items-center justify-between flex-shrink-0">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center font-extrabold text-sm text-primary-foreground shadow-sm">
                  S
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground tracking-tight">Stratnent Portal</span>
                  <span className="text-[10px] text-muted-foreground">Lead Gen & Social AI</span>
                </div>
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-extrabold text-sm text-primary-foreground mx-auto shadow-sm">
                S
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  title={sidebarCollapsed ? link.name : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <span className={isActive ? 'text-primary-foreground' : 'text-muted-foreground'}>{link.icon}</span>
                  {!sidebarCollapsed && <span>{link.name}</span>}
                </Link>
              )
            })}
          </nav>

          {/* WhatsApp Connection Status Badge & Logout */}
          <div className="p-3 border-t border-border space-y-2 bg-card">
            {!sidebarCollapsed && (
              <div className="p-2.5 rounded-xl border border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">WhatsApp</span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${whatsappConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${whatsappConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {whatsappConnected ? 'Ready' : 'Offline'}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors ${
                sidebarCollapsed ? 'justify-center px-0' : ''
              }`}
            >
              <LogOut className="w-4 h-4" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="md:hidden h-14 border-b border-border px-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center font-bold text-xs text-primary-foreground">
              S
            </div>
            <span className="text-xs font-bold text-foreground">Stratnent Portal</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
