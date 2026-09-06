'use client'

import React, { useState } from 'react'
import { 
  Button, 
  Badge, 
  Card, 
  StatCard, 
  HeroCard, 
  GalleryCard, 
  Tabs, 
  SearchInput, 
  Input, 
  Accordion,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from '@/components'

export default function DesignPreviewPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [searchValue, setSearchValue] = useState('')

  const accordionItems = [
    {
      id: 'item-1',
      title: 'How does automatic Meta Graph API token refresh work?',
      content: 'The platform periodically runs a token audit task every 6 hours, checking expiration windows against Meta auth servers.'
    },
    {
      id: 'item-2',
      title: 'What happens when a lead is tagged as Ready for Outreach?',
      content: 'The automation workflow triggers Gemini AI copywriting to generate custom WhatsApp messages and queues them for delivery.'
    }
  ]

  return (
    <div className="p-10 space-y-12 max-w-6xl mx-auto bg-page min-h-screen">
      {/* Header */}
      <div>
        <Badge variant="dark" className="mb-2">DESIGN SYSTEM PREVIEW</Badge>
        <h1 className="text-4xl font-extrabold text-ink font-display">Loops House UI Components</h1>
        <p className="text-text-muted mt-1 font-medium">Isolated preview route for visual verification across all component states.</p>
      </div>

      {/* Buttons Section */}
      <Card variant="page-alt" className="p-8 space-y-6">
        <h2 className="text-xl font-bold text-ink font-display">Buttons</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" iconType="arrow-right">Primary Button</Button>
          <Button variant="secondary" iconType="arrow-right">Secondary Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="icon" iconType="arrow-up-right" />
          <Button variant="darkIcon" iconType="arrow-right" />
          <Button variant="primary" loading>Loading...</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </Card>

      {/* Badges Section */}
      <Card variant="page-alt" className="p-8 space-y-6">
        <h2 className="text-xl font-bold text-ink font-display">Badges</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="dark">Dark Badge</Badge>
          <Badge variant="lime">Lime Badge</Badge>
          <Badge variant="neutral">Neutral Badge</Badge>
          <Badge variant="muted">Muted Badge</Badge>
          <Badge variant="sage">Sage Badge</Badge>
          <Badge variant="lavender">Lavender Badge</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
        </div>
      </Card>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value="1,248" variant="lavender" subtext="+12% this week" />
        <StatCard label="Active Campaigns" value="8" variant="cream" subtext="All systems active" />
        <StatCard label="Conversion Rate" value="34.2%" variant="sage" subtext="Above average" />
        <StatCard label="Qualified Leads" value="412" variant="page-alt" subtext="Pending outreach" />
      </div>

      {/* Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <HeroCard
          eyebrow="MODULE 01"
          title="Social Automation Platform"
          description="Manage automated Instagram DM workflows, Facebook comment auto-replies, and WhatsApp outreach."
          variant="sage"
          action={<Button variant="primary">Launch Module</Button>}
        />
        <HeroCard
          eyebrow="SYSTEM TELEMETRY"
          title="Engine Status & Logs"
          description="Live Playwright browser pool monitoring, worker status, and backend metrics."
          variant="ink"
          action={<Button variant="primary" iconType="arrow-right">View Telemetry</Button>}
        />
      </div>

      {/* Gallery Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <GalleryCard
          title="Singapore Clinic Campaign"
          badge={<Badge variant="lime">Active</Badge>}
          description="Targeted lead generation for dental clinics across East Coast region."
          caption="Updated 2 hours ago"
          avatar="SC"
        />
        <GalleryCard
          title="Cafe Outreach Pipeline"
          badge={<Badge variant="sage">Queued</Badge>}
          description="AI personalized outreach templates generated for 48 new cafe prospects."
          caption="Updated yesterday"
          avatar="CO"
        />
        <GalleryCard
          title="Fitness Leads Scraper"
          badge={<Badge variant="dark">Done</Badge>}
          description="Completed scraping 150 local gym accounts with contact details."
          caption="Completed July 28"
          avatar="FL"
        />
      </div>

      {/* Controls & Inputs */}
      <Card variant="page-alt" className="p-8 space-y-6">
        <h2 className="text-xl font-bold text-ink font-display">Controls & Form Elements</h2>
        <div className="space-y-4 max-w-md">
          <Tabs
            tabs={[
              { id: 'all', label: 'All Items' },
              { id: 'active', label: 'Active', count: 12 },
              { id: 'archived', label: 'Archived' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
          <SearchInput
            placeholder="Search leads or campaigns..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <Input placeholder="Standard Input text field..." />
        </div>
      </Card>

      {/* Accordions */}
      <Card variant="page-alt" className="p-8 space-y-6">
        <h2 className="text-xl font-bold text-ink font-display">Accordion FAQ</h2>
        <Accordion items={accordionItems} />
      </Card>

      {/* Table */}
      <Card variant="page-alt" className="p-8 space-y-6">
        <h2 className="text-xl font-bold text-ink font-display">Table Primitives</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-bold text-ink">Urban Roast Cafe</TableCell>
              <TableCell>Food & Beverage</TableCell>
              <TableCell><Badge variant="lime">Qualified</Badge></TableCell>
              <TableCell className="text-right font-mono font-bold">94/100</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-bold text-ink">Apex Dental Studio</TableCell>
              <TableCell>Healthcare</TableCell>
              <TableCell><Badge variant="sage">Contacted</Badge></TableCell>
              <TableCell className="text-right font-mono font-bold">88/100</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
