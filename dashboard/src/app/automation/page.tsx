'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GeminiKeyModal } from '@/components/gemini-key-modal'
import { Activity, MessageSquare, Mail, Calendar, Key, RefreshCw, ShieldCheck, Sparkles, Send, ArrowRight, Zap, CheckCircle2 } from 'lucide-react'

export default function AutomationDashboardPage() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [geminiModalOpen, setGeminiModalOpen] = useState(false)
  const [activeAccount, setActiveAccount] = useState<any>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/automation/accounts')
      const data = await res.json()
      if (res.ok && data.accounts) {
        setAccounts(data.accounts)
        const active = data.accounts.find((a: any) => a.is_active)
        setActiveAccount(active || data.accounts[0])
      }
    } catch (err) {
      console.error('Failed to fetch automation stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  return (
    <div className="space-y-6">
      {/* Reusable Gemini Key Modal */}
      <GeminiKeyModal open={geminiModalOpen} onOpenChange={setGeminiModalOpen} />

      {/* Hero Welcome & Command Banner */}
      <div className="p-6 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-secondary/30 relative overflow-hidden shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
              <Zap className="w-3.5 h-3.5" /> Social & Lead Automation Command Center
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Streamline Lead Gen & Social Workflows</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Auto-reply to Instagram & Messenger DMs, compose multi-platform campaigns, manage email outreach, and execute AI agent jobs with Gemini 2.0.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGeminiModalOpen(true)}
              className="gap-1.5 border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Set Gemini Key</span>
            </Button>
            <Button size="sm" asChild className="gap-1.5">
              <Link href="/automation/inbox">
                <MessageSquare className="w-4 h-4" />
                <span>Open Unified Inbox</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Connected Profiles</p>
              <p className="text-2xl font-bold text-foreground">{accounts.length}</p>
              <p className="text-[10px] text-emerald-400 font-medium">FB & Instagram Active</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <Key className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Active Account</p>
              <p className="text-base font-bold text-foreground truncate max-w-[120px]">
                {activeAccount?.account_name || 'Smriti Profile'}
              </p>
              <Badge variant="success" className="text-[9px]">LIVE</Badge>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Gemini AI Status</p>
              <p className="text-base font-bold text-foreground">Active & Ready</p>
              <p className="text-[10px] text-purple-400 font-medium">Model: gemini-2.0-flash</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">System Health</p>
              <p className="text-base font-bold text-foreground">Operational</p>
              <p className="text-[10px] text-emerald-400 font-medium">Webhooks & API Healthy</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Feature Launch Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="p-2.5 rounded-lg bg-pink-500/10 text-pink-400 w-fit mb-2">
              <MessageSquare className="w-5 h-5" />
            </div>
            <CardTitle>Unified Social Inbox</CardTitle>
            <CardDescription>Respond to DMs from Instagram & Facebook with Gemini AI assistance.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild className="w-full justify-between">
              <Link href="/automation/inbox">
                <span>Launch Inbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 w-fit mb-2">
              <Mail className="w-5 h-5" />
            </div>
            <CardTitle>Email Outreach Engine</CardTitle>
            <CardDescription>Scrape Google business leads & trigger AI email sequences.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild className="w-full justify-between">
              <Link href="/automation/email-outreach">
                <span>Launch Outreach</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 w-fit mb-2">
              <Send className="w-5 h-5" />
            </div>
            <CardTitle>Campaign Composer</CardTitle>
            <CardDescription>Compose, generate AI captions, and publish posts to Meta channels.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild className="w-full justify-between">
              <Link href="/automation/publish">
                <span>Open Composer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
