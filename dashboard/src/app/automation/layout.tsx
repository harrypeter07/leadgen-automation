// dashboard/src/app/automation/layout.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Bell 
} from 'lucide-react'

interface AutomationLayoutProps {
  children: React.ReactNode
}

export default function AutomationLayout({ children }: AutomationLayoutProps) {
  const pathname = usePathname()
  const [activeWorkspace, setActiveWorkspace] = useState('Stratnent Workspace')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Theme sync state
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    // Monitor theme changes via DOM attribute
    const checkTheme = () => {
      const activeTheme = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null
      if (activeTheme) {
        setTheme(activeTheme)
      }
    }
    checkTheme()
    
    // Create a MutationObserver to watch document element changes
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    
    return () => observer.disconnect()
  }, [])

  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean)
    return parts.map((part, index) => {
      const href = '/' + parts.slice(0, index + 1).join('/')
      const name = part.charAt(0).toUpperCase() + part.slice(1)
      return { name, href }
    })
  }

  const breadcrumbs = getBreadcrumbs()
  const isDark = false

  return (
    <div className={`flex min-h-screen transition-colors duration-300 font-sans ${
      isDark ? 'bg-[#141416] text-[#E4E3DD]' : 'bg-[#F4F4F6] text-gray-800'
    }`}>
      {/* Command Palette Overlay */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="border w-full max-w-lg p-5 shadow-2xl space-y-4 rounded-2xl bg-white border-slate-200 text-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 text-xs font-bold uppercase tracking-wider text-rose-600">
              <span className="flex items-center gap-1"><Search className="w-3.5 h-3.5" /> Search Actions & Commands</span>
              <button onClick={() => setCommandPaletteOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">Close</button>
            </div>
            <input 
              type="text" 
              placeholder="Search conversations, create lead pipeline, trigger campaign sequence..." 
              className="w-full border rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-rose-600 bg-slate-50 border-slate-200 text-slate-900"
            />
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="p-2.5 rounded-lg cursor-pointer flex justify-between hover:bg-slate-50 text-slate-650 font-bold">
                <span>Go to Unified Chat Inbox</span>
                <span className="font-mono text-[10px] text-slate-400">⌥I</span>
              </div>
              <div className="p-2.5 rounded-lg cursor-pointer flex justify-between hover:bg-slate-50 text-slate-650 font-bold">
                <span>View CRM Pipeline Stages</span>
                <span className="font-mono text-[10px] text-slate-400">⌥P</span>
              </div>
              <div className="p-2.5 rounded-lg cursor-pointer flex justify-between hover:bg-slate-50 text-slate-650 font-bold">
                <span>Launch n8n workflow execution</span>
                <span className="font-mono text-[10px] text-slate-400">⌥W</span>
              </div>
            </div>
          </div>
        </div>
      )}
            {/* Inner Sub-Sidebar for Social Automation modules */}
      <aside
        className="border-r flex flex-col justify-between flex-shrink-0 relative transition-all duration-300 border-slate-200 bg-white"
        style={{ width: sidebarCollapsed ? '56px' : '230px' }}
      >
        {/* Collapse inner toggle arrow */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full border flex items-center justify-center text-slate-400 hover:text-slate-900 bg-white border-slate-350 hover:border-slate-300 transition-all shadow-md focus:outline-none"
          title={sidebarCollapsed ? 'Expand sub-menu' : 'Collapse sub-menu'}
        >
          <svg className={`w-3 h-3 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="overflow-hidden">
          {/* Workspace Switcher */}
          <div className="p-3 border-b border-slate-100">
            {!sidebarCollapsed && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Workspace</span>}
            {sidebarCollapsed ? (
              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs mx-auto shadow-md shadow-rose-600/20">W</div>
            ) : (
              <div className="relative">
                <select
                  value={activeWorkspace}
                  onChange={(e) => setActiveWorkspace(e.target.value)}
                  className="w-full border text-[10px] font-bold px-2.5 py-2 rounded-xl appearance-none focus:outline-none cursor-pointer bg-slate-50 border-slate-200 text-slate-800 focus:border-rose-600 transition-colors"
                >
                  <option value="Stratnent Workspace">Stratnent Marketing</option>
                  <option value="Personal Sandbox Workspace">Personal Sandbox</option>
                  <option value="Client Staging Workspace">Client Staging</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400 text-xs">▼</div>
              </div>
            )}
          </div>

          {/* Navigation Sections */}
          <div className="p-1.5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {[
              { label: 'Business Communication', items: [
                { name: 'Unified Inbox', href: '/automation/inbox', icon: <Inbox className="w-3.5 h-3.5" /> },
                { name: 'Comment Manager', href: '/automation/comments', icon: <MessageSquare className="w-3.5 h-3.5" /> },
                { name: 'CRM Pipelines', href: '/automation/crm', icon: <Briefcase className="w-3.5 h-3.5" /> },
                { name: 'Outreach Campaigns', href: '/automation/campaigns', icon: <Send className="w-3.5 h-3.5" /> },
                { name: 'Email Outreach', href: '/automation/email-outreach', icon: <Mail className="w-3.5 h-3.5" /> },
              ]},
              { label: 'Content Publishing', items: [
                { name: 'Campaign Composer', href: '/automation/publish', icon: <Edit className="w-3.5 h-3.5" /> },
                { name: 'Content Calendar', href: '/automation/calendar', icon: <Calendar className="w-3.5 h-3.5" /> },
                { name: 'Trending Research', href: '/automation/trending', icon: <Flame className="w-3.5 h-3.5" /> },
                { name: 'Media Library', href: '/automation/media', icon: <ImageIcon className="w-3.5 h-3.5" /> },
              ]},
              { label: 'System Operations', items: [
                { name: 'Connected Accounts', href: '/automation/accounts', icon: <Key className="w-3.5 h-3.5" /> },
                { name: 'Meta Settings', href: '/automation/settings/meta', icon: <Settings className="w-3.5 h-3.5" /> },
                { name: 'n8n Workflow Jobs', href: '/automation/workflows', icon: <RefreshCw className="w-3.5 h-3.5" /> },
                { name: 'System Health', href: '/automation/health', icon: <Activity className="w-3.5 h-3.5" /> },
                { name: 'API Test Console', href: '/automation/testing', icon: <Terminal className="w-3.5 h-3.5" /> },
                { name: 'Activity Logs', href: '/automation/logs', icon: <FileText className="w-3.5 h-3.5" /> },
                { name: 'System Docs', href: '/automation/docs', icon: <BookOpen className="w-3.5 h-3.5" /> },
                { name: 'Module Settings', href: '/automation/settings', icon: <Settings className="w-3.5 h-3.5" /> },
              ]},
            ].map(section => (
              <div key={section.label} className="space-y-0.5">
                {!sidebarCollapsed && (
                  <span className="px-2.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{section.label}</span>
                )}
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all relative ${
                        isActive 
                          ? 'text-rose-600 bg-rose-50/80 border border-rose-100/50 shadow-sm' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      } ${sidebarCollapsed ? 'justify-center' : ''}`}
                    >
                      {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-rose-600 rounded-r" />}
                      <span className={`transition-colors ${isActive ? 'text-rose-600' : 'text-slate-400'}`}>{item.icon}</span>
                      {!sidebarCollapsed && <span>{item.name}</span>}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Command Palette trigger */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-slate-100 bg-inherit">
            <button 
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full py-2.5 border rounded-xl text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              <Search className="w-3 h-3 text-rose-600" /> Actions Search
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header navbar */}
        <header className="h-14 border-b px-6 flex items-center justify-between transition-colors duration-300 border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Link href="/" className="hover:text-slate-700 text-slate-400">Root</Link>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.href}>
                <span className="text-slate-300">/</span>
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-slate-900">{b.name}</span>
                ) : (
                  <Link href={b.href} className="hover:text-slate-700 text-slate-400">{b.name}</Link>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors relative focus:outline-none border-slate-200 bg-slate-50 hover:bg-slate-100"
              >
                <Bell className="w-4 h-4 text-slate-655" />
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full border border-white" />
              </button>
              
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 border rounded-xl w-60 p-3.5 shadow-xl z-50 text-[10px] space-y-2 bg-white border-slate-200 text-slate-700 shadow-md">
                  <div className="font-bold border-b pb-1.5 uppercase tracking-wider text-[8px] text-slate-900 border-slate-100">Unread Alert Logs</div>
                  <div className="p-1.5 rounded-lg hover:bg-slate-50">
                    <span className="font-bold block text-slate-900">Broadcast completed</span>
                    <span className="text-[9px] text-slate-500">WhatsApp segment sent successfully</span>
                  </div>
                  <div className="p-1.5 rounded-lg hover:bg-slate-50">
                    <span className="font-bold block text-slate-900">Opportunity Created</span>
                    <span className="text-[9px] text-slate-500">Singapore Cafe marked as lead</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] font-bold border px-3 py-1.5 rounded-xl uppercase tracking-wider border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100/50 transition-colors cursor-pointer shadow-xs">
              Enterprise Portal
            </div>
          </div>
        </header>

        {/* Dynamic Panel child views */}
        <main className="flex-1 p-5 md:p-6 overflow-y-auto transition-colors duration-300 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  )
}
