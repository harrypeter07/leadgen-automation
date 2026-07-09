// dashboard/src/app/automation/layout.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AutomationLayoutProps {
  children: React.ReactNode
}

export default function AutomationLayout({ children }: AutomationLayoutProps) {
  const pathname = usePathname()
  const [activeWorkspace, setActiveWorkspace] = useState('Zarss Marketing Workspace')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Theme sync state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

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
  const isDark = theme === 'dark'

  return (
    <div className={`flex min-h-screen transition-colors duration-300 font-sans ${
      isDark ? 'bg-[#141416] text-[#E4E3DD]' : 'bg-[#F4F4F6] text-gray-800'
    }`}>
      {/* Command Palette Overlay */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border w-full max-w-lg p-5 shadow-2xl space-y-4 rounded-2xl ${
            isDark ? 'bg-[#1C1C1E] border-[#2D2D30]' : 'bg-white border-gray-200 text-gray-800'
          }`}>
            <div className="flex justify-between items-center border-b border-[#2D2D30]/30 pb-3 text-xs font-bold uppercase tracking-wider text-[#E3B859]">
              <span>⚡ Search Actions & Commands</span>
              <button onClick={() => setCommandPaletteOpen(false)} className="text-gray-400 hover:text-gray-900 transition-colors">Close</button>
            </div>
            <input 
              type="text" 
              placeholder="Search conversations, create lead pipeline, trigger campaign sequence..." 
              className={`w-full border rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#E3B859] ${
                isDark ? 'bg-[#141416] border-[#2D2D30] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            />
            <div className="space-y-1.5 text-xs text-gray-400">
              <div className={`p-2.5 rounded-lg cursor-pointer flex justify-between ${isDark ? 'hover:bg-[#2D2D30]' : 'hover:bg-gray-100 text-gray-600'}`}>
                <span>Go to Unified Chat Inbox</span>
                <span className="font-mono text-[10px] text-gray-500">⌥I</span>
              </div>
              <div className={`p-2.5 rounded-lg cursor-pointer flex justify-between ${isDark ? 'hover:bg-[#2D2D30]' : 'hover:bg-gray-100 text-gray-600'}`}>
                <span>View CRM Pipeline Stages</span>
                <span className="font-mono text-[10px] text-gray-500">⌥P</span>
              </div>
              <div className={`p-2.5 rounded-lg cursor-pointer flex justify-between ${isDark ? 'hover:bg-[#2D2D30]' : 'hover:bg-gray-100 text-gray-600'}`}>
                <span>Launch n8n workflow execution</span>
                <span className="font-mono text-[10px] text-gray-500">⌥W</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inner Sub-Sidebar for Social Automation modules */}
      <aside
        className={`border-r flex flex-col justify-between flex-shrink-0 relative transition-all duration-300 ${
          isDark ? 'border-[#252528] bg-[#18181A]' : 'border-gray-200 bg-white'
        }`}
        style={{ width: sidebarCollapsed ? '56px' : '230px' }}
      >
        {/* Collapse inner toggle arrow */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          className={`absolute -right-3 top-6 z-10 w-6 h-6 rounded-full border flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-md focus:outline-none ${
            isDark ? 'bg-[#252528] border-[#3D3D40]' : 'bg-white border-gray-300 hover:text-gray-900'
          }`}
          title={sidebarCollapsed ? 'Expand sub-menu' : 'Collapse sub-menu'}
        >
          <svg className={`w-3 h-3 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="overflow-hidden">
          {/* Workspace Switcher */}
          <div className={`p-3 border-b ${isDark ? 'border-[#252528]' : 'border-gray-100'}`}>
            {!sidebarCollapsed && <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Workspace</span>}
            {sidebarCollapsed ? (
              <div className="w-8 h-8 rounded-lg bg-[#E3B859] flex items-center justify-center text-[#18181A] font-black text-xs mx-auto">W</div>
            ) : (
              <div className="relative">
                <select
                  value={activeWorkspace}
                  onChange={(e) => setActiveWorkspace(e.target.value)}
                  className={`w-full border text-[10px] font-bold px-2.5 py-2 rounded-xl appearance-none focus:outline-none cursor-pointer ${
                    isDark ? 'bg-[#141416] border-[#2D2D30] text-white focus:border-[#E3B859]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#E3B859]'
                  }`}
                >
                  <option value="Zarss Marketing Workspace">Zarss Marketing</option>
                  <option value="Personal Sandbox Workspace">Personal Sandbox</option>
                  <option value="Client Staging Workspace">Client Staging</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400 text-xs">▼</div>
              </div>
            )}
          </div>

          {/* Navigation Sections */}
          <div className="p-1.5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {[
              { label: 'Business Communication', items: [
                { name: 'Unified Inbox', href: '/automation/inbox', icon: '📥' },
                { name: 'Comment Manager', href: '/automation/comments', icon: '💬' },
                { name: 'CRM Pipelines', href: '/automation/crm', icon: '💼' },
                { name: 'Outreach Campaigns', href: '/automation/campaigns', icon: '📤' },
                { name: 'Email Outreach', href: '/automation/email-outreach', icon: '📧' },
              ]},
              { label: 'Content Publishing', items: [
                { name: 'Campaign Composer', href: '/automation/publish', icon: '📝' },
                { name: 'Content Calendar', href: '/automation/calendar', icon: '📅' },
                { name: 'Trending Research', href: '/automation/trending', icon: '🔥' },
                { name: 'Media Library', href: '/automation/media', icon: '🖼️' },
              ]},
              { label: 'System Operations', items: [
                { name: 'Connected Accounts', href: '/automation/accounts', icon: '🔑' },
                { name: 'Meta Settings', href: '/automation/settings/meta', icon: '⚙️' },
                { name: 'n8n Workflow Jobs', href: '/automation/workflows', icon: '🔄' },
                { name: 'System Health', href: '/automation/health', icon: '🩺' },
                { name: 'API Test Console', href: '/automation/testing', icon: '🧪' },
                { name: 'Activity Logs', href: '/automation/logs', icon: '📋' },
                { name: 'System Docs', href: '/automation/docs', icon: '📖' },
                { name: 'Module Settings', href: '/automation/settings', icon: '⚙️' },
              ]},
            ].map(section => (
              <div key={section.label} className="space-y-0.5">
                {!sidebarCollapsed && (
                  <span className="px-2.5 text-[8px] font-bold text-gray-500 uppercase tracking-widest block mb-1">{section.label}</span>
                )}
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors relative ${
                        isActive 
                          ? 'text-[#E3B859] bg-[#222225]' 
                          : isDark
                          ? 'text-gray-400 hover:bg-[#202022] hover:text-white'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      } ${sidebarCollapsed ? 'justify-center' : ''}`}
                    >
                      {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#E3B859] rounded-r" />}
                      <span className="text-xs">{item.icon}</span>
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
          <div className={`p-3 border-t bg-inherit ${isDark ? 'border-[#252528]' : 'border-gray-100'}`}>
            <button 
              onClick={() => setCommandPaletteOpen(true)}
              className={`w-full py-2.5 border rounded-xl text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${
                isDark ? 'bg-[#222225] border-[#2D2D30] text-gray-300 hover:text-white' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              ⚡ Actions Search
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header navbar */}
        <header className={`h-14 border-b px-6 flex items-center justify-between transition-colors duration-300 ${
          isDark ? 'border-[#252528] bg-[#18181A]' : 'border-gray-200 bg-white shadow-sm'
        }`}>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <Link href="/" className={`hover:text-white ${isDark ? 'text-gray-500' : 'text-gray-400 hover:text-gray-700'}`}>Root</Link>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.href}>
                <span className="text-gray-600">/</span>
                {i === breadcrumbs.length - 1 ? (
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>{b.name}</span>
                ) : (
                  <Link href={b.href} className={`hover:text-white ${isDark ? 'text-gray-500' : 'text-gray-400 hover:text-gray-700'}`}>{b.name}</Link>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors relative focus:outline-none ${
                  isDark ? 'border-[#2D2D30] bg-[#141416] hover:border-gray-500' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <span>🔔</span>
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border border-inherit" />
              </button>
              
              {notificationsOpen && (
                <div className={`absolute right-0 mt-2 border rounded-xl w-60 p-3.5 shadow-xl z-50 text-[10px] space-y-2 ${
                  isDark ? 'bg-[#1C1C1E] border-[#2D2D30] text-gray-300' : 'bg-white border-gray-200 text-gray-700 shadow-md'
                }`}>
                  <div className={`font-bold border-b pb-1.5 uppercase tracking-wider text-[8px] ${isDark ? 'text-white border-[#2D2D30]' : 'text-gray-900 border-gray-100'}`}>Unread Alert Logs</div>
                  <div className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#222225]' : 'hover:bg-gray-50'}`}>
                    <span className={`font-bold block ${isDark ? 'text-white' : 'text-gray-900'}`}>Broadcast completed</span>
                    <span className="text-[9px] text-gray-500">WhatsApp segment sent successfully</span>
                  </div>
                  <div className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#222225]' : 'hover:bg-gray-50'}`}>
                    <span className={`font-bold block ${isDark ? 'text-white' : 'text-gray-900'}`}>Opportunity Created</span>
                    <span className="text-[9px] text-gray-500">Singapore Cafe marked as lead</span>
                  </div>
                </div>
              )}
            </div>

            <div className={`text-[10px] font-bold border px-3 py-1.5 rounded-xl uppercase tracking-wider ${
              isDark ? 'border-[#E3B859]/30 bg-[#E3B859]/10 text-white' : 'border-purple-200 bg-purple-50 text-purple-700'
            }`}>
              💼 ENTERPRISE PORTAL
            </div>
          </div>
        </header>

        {/* Dynamic Panel child views */}
        <main className={`flex-1 p-5 md:p-6 overflow-y-auto transition-colors duration-300 ${
          isDark ? 'bg-[#141416]' : 'bg-[#F4F4F6]'
        }`}>
          {children}
        </main>
      </div>
    </div>
  )
}
