'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BookOpen, ExternalLink, Key, Sparkles, Globe, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react'

export default function AutomationDocsPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Automation Setup & Setup Credentials Guide</h1>
            <p className="text-xs text-muted-foreground">Step-by-step instructions on where and how to obtain Meta API credentials and Gemini keys.</p>
          </div>
        </div>

        <Button size="sm" asChild className="gap-1.5">
          <Link href="/automation/settings/meta">
            <Key className="w-3.5 h-3.5" />
            <span>Configure Meta Credentials</span>
          </Link>
        </Button>
      </div>

      {/* Meta Developer Setup Guide Card */}
      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            1. How to Obtain Meta (Facebook & Instagram) Credentials
          </CardTitle>
          <CardDescription>Follow these steps to register your Meta Developer App and obtain active tokens.</CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-6 text-xs text-foreground">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                Create Meta Developer App & Get App ID / App Secret
              </span>
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <span>Meta Developers Console</span> <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-muted-foreground pl-7 leading-relaxed">
              Go to <strong className="text-foreground">developers.facebook.com/apps</strong> → Click <strong>Create App</strong> → Select <strong>Business</strong> type. Copy your <strong>App ID</strong> and <strong>App Secret</strong> from <em>App Settings → Basic</em> and paste them in <Link href="/automation/settings/meta" className="text-primary underline">Meta Settings</Link>.
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                Generate Permanent Facebook Page Access Token
              </span>
              <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <span>Graph API Explorer</span> <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-muted-foreground pl-7 leading-relaxed">
              Open <strong>Graph API Explorer</strong> → Select your Meta App → Select permissions: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">pages_show_list</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">pages_read_engagement</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">pages_manage_posts</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">instagram_basic</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">instagram_content_publish</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">instagram_manage_messages</code>. Click <strong>Generate Access Token</strong> and select your Page Token.
            </p>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">3</span>
                Find Instagram Business Account ID
              </span>
            </div>
            <p className="text-muted-foreground pl-7 leading-relaxed">
              In Graph API Explorer, make a GET request to: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">GET /v25.0/me/accounts?fields=instagram_business_account,name</code>. Copy the numeric <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">instagram_business_account.id</code> into <strong>INSTAGRAM_BUSINESS_ID</strong> in Meta Settings.
            </p>
          </div>

          {/* Step 4 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">4</span>
                Register Webhooks for Inbound Chat Auto-Replies
              </span>
              <Link href="/automation/webhook-debugger" className="text-primary hover:underline flex items-center gap-1">
                <span>Webhook Monitor</span> <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-muted-foreground pl-7 leading-relaxed">
              In Meta App Dashboard → Click <strong>Webhooks</strong> → Select <strong>Instagram</strong> &amp; <strong>Page</strong> → Paste your Callback URL (<code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">https://yourdomain.com/api/meta/webhook</code>) and Verify Token (<code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">FLOWFYP_VERIFY_TOKEN</code>). Subscribe to <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">messages</code> and <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">messaging_postbacks</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gemini AI Key Setup Guide Card */}
      <Card>
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            2. How to Obtain a Free Gemini API Key
          </CardTitle>
          <CardDescription>Steps to get an active API key from Google AI Studio.</CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4 text-xs text-foreground">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Visit Google AI Studio</span>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                <span>Google AI Studio</span> <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Log in with your Google account → Click <strong>Get API key</strong> → Click <strong>Create API key</strong>. Copy the key string (e.g. <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">AIzaSy...</code>) and click <strong>Set Gemini Key</strong> in the header or inside Email Outreach/Inbox Chat to test and save it.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
