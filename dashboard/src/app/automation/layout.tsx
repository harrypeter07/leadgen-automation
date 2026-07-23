'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  Inbox, 
  MessageSquare, 
  Briefcase, 
  Send, 
  Mail, 
  Edit, 
  Calendar, 
  Flame, 
  Image as ImageIcon, 
  Key, 
  Settings, 
  RefreshCw, 
  Activity, 
  Terminal, 
  FileText, 
  BookOpen, 
  Search, 
  Bell,
  Sparkles,
  ChevronRight,
  Menu,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GeminiKeyModal } from '@/components/gemini-key-modal'

interface AutomationLayoutProps {
  children: React.ReactNode
}

export default function AutomationLayout({ children }: AutomationLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [activeWorkspace, setActiveWorkspace] = useState('Stratnent Marketing')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [geminiModalOpen, setGeminiModalOpen] = useState(false)

  // Active connected account state for quick badge
  const [activeAccount, setActiveAccount] = useState<{ accountName?: string; platform?: string } | null>(null)

  useEffect(() => {
    fetch('/api/meta/active-account')
      .then(r => r.json())
      .then(d => {
        if (d.account_name) {
          setActiveAccount({ accountName: d.account_name, platform: d.platform })
        }
      })
      .catch(() => {})
  }, [pathname])

  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean)
    return parts.map((part, index) => {
      const href = '/' + parts.slice(0, index + 1).join('/')
      const name = part.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      return { name, href }
    })
  }

  const breadcrumbs = getBreadcrumbs()

  const navSections = [
    { 
      label: 'Communication', 
      items: [
        { name: 'Unified Inbox', href: '/automation/inbox', icon: <Inbox className="w-4 h-4" /> },
        { name: 'Comment Manager', href: '/automation/comments', icon: <MessageSquare className="w-4 h-4" /> },
        { name: 'CRM Pipelines', href: '/automation/crm', icon: <Briefcase className="w-4 h-4" /> },
        { name: 'Outreach Campaigns', href: '/automation/campaigns', icon: <Send className="w-4 h-4" /> },
        { name: 'Email Outreach', href: '/automation/email-outreach', icon: <Mail className="w-4 h-4" /> },
      ]
    },
    { 
      label: 'Publishing', 
      items: [
        { name: 'Campaign Composer', href: '/automation/publish', icon: <Edit className="w-4 h-4" /> },
        { name: 'Content Calendar', href: '/automation/calendar', icon: <Calendar className="w-4 h-4" /> },
        { name: 'Trending Research', href: '/automation/trending', icon: <Flame className="w-4 h-4" /> },
        { name: 'Media Library', href: '/automation/media', icon: <ImageIcon className="w-4 h-4" /> },
        { name: 'ChatGPT Images', href: '/automation/chatgpt-images', icon: <Sparkles className="w-4 h-4" /> },
      ]
    },
    { 
      label: 'Operations', 
      items: [
        { name: 'Connected Accounts', href: '/automation/accounts', icon: <Key className="w-4 h-4" /> },
        { name: 'Meta Settings', href: '/automation/settings/meta', icon: <Settings className="w-4 h-4" /> },
        { name: 'n8n Workflows', href: '/automation/workflows', icon: <RefreshCw className="w-4 h-4" /> },
        { name: 'System Health', href: '/automation/health', icon: <Activity className="w-4 h-4" /> },
        { name: 'API Console', href: '/automation/testing', icon: <Terminal className="w-4 h-4" /> },
        { name: 'Activity Logs', href: '/automation/logs', icon: <FileText className="w-4 h-4" /> },
        { name: 'Docs', href: '/automation/docs', icon: <BookOpen className="w-4 h-4" /> },
      ]
    },
  ]

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground antialiased font-sans">
      {/* Command Palette Overlay */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border border-border w-full max-w-lg p-5 shadow-2xl space-y-4 rounded-xl bg-card text-card-foreground">
            <div className="flex justify-between items-center border-b border-border pb-3 text-xs font-semibold uppercase tracking-wider text-primary">
              <span className="flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> Search Actions & Modules</span>
              <button onClick={() => setCommandPaletteOpen(false)} className="text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <input 
              type="text" 
              placeholder="Search page, trigger campaign, view inbox..." 
              className="w-full border border-input rounded-md px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring bg-background text-foreground"
            />
            <div className="space-y-1 text-xs text-muted-foreground">
              <div onClick={() => { router.push('/automation/inbox'); setCommandPaletteOpen(false) }} className="p-2 rounded-md cursor-pointer flex justify-between hover:bg-accent hover:text-accent-foreground">
                <span>Go to Unified Chat Inbox</span>
                <span className="font-mono text-[10px]">/inbox</span>
              </div>
              <div onClick={() => { router.push('/automation/email-outreach'); setCommandPaletteOpen(false) }} className="p-2 rounded-md cursor-pointer flex justify-between hover:bg-accent hover:text-accent-foreground">
                <span>Go to Email Outreach</span>
                <span className="font-mono text-[10px]">/email</span>
              </div>
              <div onClick={() => { router.push('/automation/settings/meta'); setCommandPaletteOpen(false) }} className="p-2 rounded-md cursor-pointer flex justify-between hover:bg-accent hover:text-accent-foreground">
                <span>Meta Settings & Accounts</span>
                <span className="font-mono text-[10px]">/settings</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Gemini API Key Modal */}
      <GeminiKeyModal open={geminiModalOpen} onOpenChange={setGeminiModalOpen} />

      {/* Desktop Navigation Sidebar */}
      <aside
        className="hidden md:flex border-r border-border flex-col justify-between flex-shrink-0 relative transition-all duration-300 bg-card"
        style={{ width: sidebarCollapsed ? '64px' : '240px' }}
      >
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          className="absolute -right-3 top-5 z-20 w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground bg-card shadow-sm transition-transform"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} />
        </button>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Sidebar Header / Logo */}
          <div className="h-14 border-b border-border px-4 flex items-center justify-between flex-shrink-0">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center font-bold text-xs text-primary-foreground">
                  A
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold tracking-tight text-foreground">Auto-MT Platform</span>
                  <span className="text-[10px] text-muted-foreground">Automation Command</span>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-xs text-primary-foreground mx-auto">
                A
              </div>
            )}
          </div>

          {/* Navigation Sections */}
          <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
            {navSections.map(section => (
              <div key={section.label} className="space-y-1">
                {!sidebarCollapsed && (
                  <span className="px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    {section.label}
                  </span>
                )}
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive 
                          ? 'bg-secondary text-primary font-semibold shadow-xs' 
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                    >
                      <span className={isActive ? 'text-primary' : 'text-muted-foreground'}>{item.icon}</span>
                      {!sidebarCollapsed && <span>{item.name}</span>}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Sidebar Footer / Gemini Key button */}
          {!sidebarCollapsed && (
            <div className="p-3 border-t border-border bg-card space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGeminiModalOpen(true)}
                className="w-full justify-start gap-2 text-xs border-primary/20 text-primary hover:bg-primary/10"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gemini API Key</span>
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Bar */}
        <header className="h-14 border-b border-border px-4 md:px-6 flex items-center justify-between bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Breadcrumb path */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Link href="/automation" className="hover:text-foreground transition-colors">Automation</Link>
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={b.href}>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-foreground font-semibold">{b.name}</span>
                  ) : (
                    <Link href={b.href} className="hover:text-foreground transition-colors">{b.name}</Link>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-3">
            {/* Active Account Status Badge */}
            {activeAccount && (
              <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeAccount.accountName}</span>
              </Badge>
            )}

            {/* Inline Gemini Key Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGeminiModalOpen(true)}
              className="h-8 gap-1.5 text-xs border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Set Gemini Key</span>
            </Button>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors relative"
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
              </button>
              
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-xl z-50 text-xs space-y-2">
                  <div className="font-semibold border-b border-border pb-1.5 text-foreground">System Alerts</div>
                  <div className="p-2 rounded-md bg-secondary/50">
                    <span className="font-semibold block text-foreground">Meta Active Account</span>
                    <span className="text-[11px] text-muted-foreground">Active profile connected and healthy</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
