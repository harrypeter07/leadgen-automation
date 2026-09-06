'use client'

import React from 'react'
import { 
  Button, 
  Badge, 
  Card, 
  StatCard, 
  HeroCard, 
  GalleryCard 
} from '@/components'
import { Activity, Bot, MessageSquare, Send, Zap } from 'lucide-react'

export default function PlatformOverviewPage() {
  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {/* Hero Header */}
      <HeroCard
        eyebrow="PLATFORM OVERVIEW"
        title="LeadGen & Social Automation Portal"
        description="Unified command center for AI persona copywriting, Graph API webhooks, Playwright scrapers, and multi-channel outreach."
        variant="sage"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="primary" iconType="arrow-right">
              View Active Leads
            </Button>
            <Button variant="secondary" iconType="arrow-right">
              Launch Scraper
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Database Leads"
          value="1,482"
          variant="lavender"
          subtext="Synced across Supabase"
        />
        <StatCard
          label="AI Personalised"
          value="1,120"
          variant="cream"
          subtext="Gemini copy templates ready"
        />
        <StatCard
          label="Outreach Messages"
          value="840"
          variant="sage"
          subtext="WhatsApp & Email dispatches"
        />
        <Card variant="ink" className="flex flex-col justify-between p-6">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-eyebrow text-lime">
              System Health
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-lime animate-pulse" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="lime">Playwright 100%</Badge>
            <Badge variant="dark">Supabase OK</Badge>
          </div>
        </Card>
      </div>

      {/* Feature Modules Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GalleryCard
          title="Automated Lead Scraping"
          badge={<Badge variant="lime">Active</Badge>}
          description="Extract contact metadata from Google Maps & Instagram profiles with concurrency controls."
          caption="Engine V3 Playwright Cluster"
          avatar={<Bot className="w-5 h-5 text-ink" />}
        />
        <GalleryCard
          title="Gemini AI Personalisation"
          badge={<Badge variant="sage">Enabled</Badge>}
          description="Generate tailored WhatsApp pitches based on business categories and profile insights."
          caption="Google Gemini Flash 1.5"
          avatar={<Zap className="w-5 h-5 text-ink" />}
        />
        <GalleryCard
          title="Meta Graph & Webhooks"
          badge={<Badge variant="dark">Connected</Badge>}
          description="Listen to real-time Instagram DMs, Facebook comments, and WhatsApp Webhooks."
          caption="Meta Graph API v19.0"
          avatar={<MessageSquare className="w-5 h-5 text-ink" />}
        />
      </div>
    </div>
  )
}
