'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { 
  LayoutDashboard, 
  Users, 
  Smartphone, 
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
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LayoutClientProps {
  children: React.ReactNode
}

export default function LayoutClient({ children }: LayoutClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

  const isExpanded = !sidebarCollapsed || isHovered

  useEffect(() => {
    const savedCollapse = localStorage.getItem('stratnent_main_sidebar_collapsed')
    if (savedCollapse !== null) {
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
    { name: 'WhatsApp Engine', href: '/whatsapp', icon: <Smartphone className="w-5 h-5" /> },
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
      <div className="min-h-screen bg-page text-ink font-body">
        <Toaster position="top-right" />
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-page text-ink font-body select-none">
      <Toaster position="top-right" />

      {/* Main Left Icon Rail Sidebar with Hover-to-Expand */}
      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "hidden md:flex bg-ink text-page flex-col justify-between flex-shrink-0 relative transition-all duration-300 ease-in-out z-30",
          isExpanded ? "w-[240px]" : "w-[80px]"
        )}
      >
        <button
          onClick={toggleSidebar}
          className="absolute -right-3.5 top-6 z-40 w-7 h-7 rounded-full bg-ink border border-border-subtle/30 flex items-center justify-center text-text-onDarkMuted hover:text-page transition-all"
          title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <ChevronRight className={cn("w-4 h-4 transition-transform duration-200", isExpanded ? "rotate-180" : "rotate-0")} />
        </button>

        <div className="flex flex-col h-full items-center py-6 px-3 overflow-hidden">
          {/* Logo Header */}
          <div className="mb-6 flex items-center shrink-0 w-full px-1">
            <Link href="/dashboard" className="flex items-center gap-3 w-full">
              <div className="w-10 h-10 rounded-sm bg-lime text-ink flex items-center justify-center font-extrabold text-base tracking-tight shrink-0">
                L
              </div>
              {isExpanded && (
                <div className="flex flex-col whitespace-nowrap overflow-hidden transition-opacity duration-200">
                  <span className="text-sm font-bold text-page tracking-tight">Stratnent</span>
                  <span className="text-[10px] text-lime uppercase font-mono font-semibold">LeadGen AI</span>
                </div>
              )}
            </Link>
          </div>

          <div className="w-full h-[1px] bg-border-subtle/10 mb-6" />

          {/* Nav Icons */}
          <nav className="flex-1 w-full flex flex-col items-center space-y-2 overflow-y-auto scrollbar-none">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  title={!isExpanded ? link.name : undefined}
                  className={cn(
                    "flex items-center gap-3 transition-all duration-200 group relative w-full px-1.5 py-1 rounded-pill",
                    !isExpanded && "justify-center"
                  )}
                >
                  <div
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 shrink-0",
                      isActive
                        ? "bg-page text-ink shadow-sm"
                        : "text-text-onDarkMuted hover:text-page hover:bg-ink-soft"
                    )}
                  >
                    {link.icon}
                  </div>
                  {isExpanded && (
                    <span className={cn("text-xs font-semibold tracking-button uppercase truncate whitespace-nowrap transition-opacity duration-200", isActive ? "text-page" : "text-text-onDarkMuted")}>
                      {link.name}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="w-full h-[1px] bg-border-subtle/10 my-4" />

          {/* Bottom Avatar & Logout */}
          <div className="flex items-center justify-between gap-2 w-full px-1 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-full bg-lime text-ink flex items-center justify-center font-bold text-xs shadow-sm cursor-pointer shrink-0"
                title="Hassan Mansuri (HM)"
              >
                HM
              </div>
              {isExpanded && (
                <div className="flex flex-col whitespace-nowrap overflow-hidden">
                  <span className="text-xs font-bold text-page truncate">Hassan M.</span>
                  <span className="text-[10px] text-text-onDarkMuted truncate">Admin</span>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-full text-text-onDarkMuted hover:text-rose-400 hover:bg-ink-soft flex items-center justify-center transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-page">
        {/* Mobile Header Bar */}
        <header className="md:hidden h-16 bg-ink text-page px-4 flex items-center justify-between z-40 border-b border-border-subtle/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-lime text-ink flex items-center justify-center font-extrabold text-xs">
              L
            </div>
            <span className="text-xs font-bold uppercase tracking-button">Stratnent AI</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-page hover:text-lime"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile Slideout Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 z-50 bg-ink text-page p-6 overflow-y-auto space-y-3">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-pill text-xs font-bold uppercase tracking-button",
                    isActive ? "bg-lime text-ink" : "text-text-onDarkMuted hover:bg-ink-soft hover:text-page"
                  )}
                >
                  {link.icon}
                  <span>{link.name}</span>
                </Link>
              )
            })}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12">
          {children}
        </main>
      </div>
    </div>
  )
}
