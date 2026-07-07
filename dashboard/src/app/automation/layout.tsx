'use client'

import React, { useState } from 'react'
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

  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean)
    return parts.map((part, index) => {
      const href = '/' + parts.slice(0, index + 1).join('/')
      const name = part.charAt(0).toUpperCase() + part.slice(1)
      return { name, href }
    })
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className="flex min-h-screen bg-[#141416] text-[#E4E3DD] antialiased font-sans">
      {/* Command Palette Overlay */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] border border-[#2D2D30] rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2D2D30] pb-3 text-xs font-bold uppercase tracking-wider text-[#E3B859]">
              <span>⚡ Search Actions & Commands</span>
              <button onClick={() => setCommandPaletteOpen(false)} className="text-gray-400 hover:text-white">Close</button>
            </div>
            <input 
              type="text" 
              placeholder="Search conversations, create lead pipeline, trigger campaign sequence..." 
              className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#E3B859]"
            />
            <div className="space-y-1.5 text-xs text-gray-400">
              <div className="p-2.5 hover:bg-[#2D2D30] rounded-lg cursor-pointer flex justify-between">
                <span>Go to Unified Chat Inbox</span>
                <span className="font-mono text-[10px] text-gray-500">⌥I</span>
              </div>
              <div className="p-2.5 hover:bg-[#2D2D30] rounded-lg cursor-pointer flex justify-between">
                <span>View CRM Pipeline Stages</span>
                <span className="font-mono text-[10px] text-gray-500">⌥P</span>
              </div>
              <div className="p-2.5 hover:bg-[#2D2D30] rounded-lg cursor-pointer flex justify-between">
                <span>Launch n8n workflow execution</span>
                <span className="font-mono text-[10px] text-gray-500">⌥W</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Main Sidebar */}
      <aside
        className="border-r border-[#252528] bg-[#18181A] flex flex-col justify-between flex-shrink-0 relative transition-all duration-300"
        style={{ width: sidebarCollapsed ? '56px' : '256px' }}
      >
        {/* Collapse/Expand toggle arrow */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-[#252528] border border-[#3D3D40] flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2D2D30] transition-all shadow-md"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className={`w-3 h-3 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="overflow-hidden">
          {/* Workspace Switcher */}
          <div className="p-4 border-b border-[#252528]">
            {!sidebarCollapsed && <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Active Workspace</span>}
            {sidebarCollapsed ? (
              <div className="w-8 h-8 rounded-lg bg-[#E3B859] flex items-center justify-center text-[#18181A] font-black text-sm mx-auto">Z</div>
            ) : (
              <div className="relative">
                <select
                  value={activeWorkspace}
                  onChange={(e) => setActiveWorkspace(e.target.value)}
                  className="w-full bg-[#141416] border border-[#2D2D30] focus:border-[#E3B859] text-xs font-bold text-white px-3 py-2.5 rounded-xl appearance-none focus:outline-none cursor-pointer"
                >
                  <option value="Zarss Marketing Workspace">Zarss Marketing</option>
                  <option value="Personal Sandbox Workspace">Personal Sandbox</option>
                  <option value="Client Staging Workspace">Client Staging</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-xs">▼</div>
              </div>
            )}
          </div>

          {/* Navigation Sections */}
          <div className="p-2 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {[
              { label: 'Business Communication', items: [
                { name: 'Unified Inbox', href: '/automation/inbox', icon: '📥' },
                { name: 'CRM Pipelines', href: '/automation/crm', icon: '💼' },
                { name: 'Outreach Campaigns', href: '/automation/campaigns', icon: '📤' },
              ]},
              { label: 'Content Publishing', items: [
                { name: 'Campaign Composer', href: '/automation/publish', icon: '📝' },
                { name: 'Content Calendar', href: '/automation/calendar', icon: '📅' },
                { name: 'Media Library', href: '/automation/media', icon: '🖼️' },
              ]},
              { label: 'System Operations', items: [
                { name: 'Connected Accounts', href: '/automation/accounts', icon: '🔑' },
                { name: 'n8n Workflow Jobs', href: '/automation/workflows', icon: '⚙️' },
                { name: 'System Health', href: '/automation/health', icon: '🩺' },
                { name: 'Activity Logs', href: '/automation/logs', icon: '📋' },
                { name: 'System Docs', href: '/automation/docs', icon: '📖' },
                { name: 'Module Settings', href: '/automation/settings', icon: '⚙️' },
              ]},
            ].map(section => (
              <div key={section.label} className="space-y-0.5">
                {!sidebarCollapsed && (
                  <span className="px-3 text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5">{section.label}</span>
                )}
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors relative ${
                        isActive ? 'text-[#E3B859] bg-[#222225]' : 'text-gray-400 hover:bg-[#202022] hover:text-white'
                      } ${sidebarCollapsed ? 'justify-center' : ''}`}
                    >
                      {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-[#E3B859] rounded-r" />}
                      <span className="text-sm">{item.icon}</span>
                      {!sidebarCollapsed && <span>{item.name}</span>}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom action */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-[#252528] space-y-2 bg-[#141416]">
            <button 
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full bg-[#222225] border border-[#2D2D30] text-gray-300 hover:text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              ⚡ Command Palette
            </button>
            <div className="text-[9px] text-gray-500 font-bold uppercase text-center tracking-widest">
              Zarss CRM & Outbox Suite
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header navbar */}
        <header className="h-16 border-b border-[#252528] bg-[#18181A] px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
            <Link href="/" className="hover:text-white text-gray-500">Root</Link>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.href}>
                <span className="text-gray-600">/</span>
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-white">{b.name}</span>
                ) : (
                  <Link href={b.href} className="hover:text-white text-gray-500">{b.name}</Link>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="w-9 h-9 rounded-xl border border-[#2D2D30] hover:border-gray-500 flex items-center justify-center bg-[#141416] transition-colors relative"
              >
                <span>🔔</span>
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#18181A]" />
              </button>
              
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 bg-[#1C1C1E] border border-[#2D2D30] rounded-xl w-64 p-4 shadow-xl z-50 text-xs text-gray-300 space-y-2.5">
                  <div className="font-bold text-white border-b border-[#2D2D30] pb-2 uppercase tracking-wider text-[10px]">Unread Alert Logs</div>
                  <div className="p-2 hover:bg-[#222225] rounded-lg">
                    <span className="font-bold block text-white">Broadcast completed</span>
                    <span className="text-[10px] text-gray-500">WhatsApp segment sent successfully</span>
                  </div>
                  <div className="p-2 hover:bg-[#222225] rounded-lg">
                    <span className="font-bold block text-white">Opportunity Created</span>
                    <span className="text-[10px] text-gray-500">Singapore Cafe Cafe marked as lead</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs font-bold text-white border border-[#E3B859]/30 bg-[#E3B859]/10 px-3.5 py-2 rounded-xl">
              💼 ENTERPRISE PORTAL
            </div>
          </div>
        </header>

        {/* Dynamic Panel child views */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#141416]">
          {children}
        </main>
      </div>
    </div>
  )
}
