'use client'

import React from 'react'
import Link from 'next/link'

export default function AutomationDocsPage() {
  return (
    <div className="space-y-8 select-none text-white max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">System Architecture &amp; Integration Docs</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">
          Comprehensive guide to messaging workflows, AI persona customization files, and pipeline engines.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content Columns */}
        <div className="md:col-span-2 space-y-6">
          {/* Section 1: Monorepo Architecture */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#E3B859] uppercase tracking-wider border-b border-[#2D2D30] pb-2">
              🌐 Monorepo Data Flows
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed font-semibold">
              The LeadGen monorepo consists of multiple modular services cooperating to automate scraping, qualification, AI personalization, and outreach dispatch:
            </p>
            <div className="bg-[#141416] p-4 rounded-xl font-mono text-[11px] text-gray-300 border border-[#2D2D30] overflow-x-auto leading-relaxed">
{` [Scraper Service]  --> POST leads -->  [n8n / API Intake Webhook]
                                            |
                                            v
 [Next.js UI Dashboard] <------------- [Supabase DB]
                                            |
                                            v
 [WhatsApp Microservice] <----------- [Agent Brain / n8n]
  (whatsapp-web.js / QR)              (Gemini AI Personalization)`}
            </div>
            <ul className="space-y-2 text-xs text-gray-400 font-semibold list-disc list-inside">
              <li><span className="text-white">Scraper:</span> Python Maps API CLI script that harvests business details.</li>
              <li><span className="text-white">Dashboard:</span> The frontend control panel (Next.js 14).</li>
              <li><span className="text-white">Agent-Brain / n8n:</span> The intelligence orchestrating decisions, qualification rules, and Gemini prompts.</li>
              <li><span className="text-white">WhatsApp Service:</span> Express client managing session authentication and headless browser delivery.</li>
            </ul>
          </div>

          {/* Section 2: Changing Messaging Personas */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#E3B859] uppercase tracking-wider border-b border-[#2D2D30] pb-2">
              ✏️ Modifying AI Messaging Personas
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed font-semibold">
              The AI cold outreach copywriter rules and parameters are loaded dynamically from a JSON file in the backend service. To change the system prompt, target audience, pitch angle, or rate limits, edit this file:
            </p>
            <div className="bg-[#141416] p-4 rounded-xl border border-[#2D2D30] font-mono text-[11px] text-gray-300 space-y-1">
              <p className="text-[#E3B859] font-bold">// File Location:</p>
              <p className="text-white select-all">leadgen/backend/config/outreach_settings.json</p>
            </div>
            <div className="bg-[#141416] p-4 rounded-xl border border-[#2D2D30] font-mono text-[11px] text-gray-400 leading-relaxed overflow-x-auto">
{`{
  "company_name": "Zarss Dev",
  "icp_description": "Singapore-based cafes, restaurants, fitness studios, and local services...",
  "offering_pitch": "We build a free custom homepage mockup showing how a modern design will improve...",
  "system_instructions": "You are a professional outreach assistant from Zarss. Write a friendly, highly-personalized message. Keep under 3 sentences...",
  "whatsapp_delay_ms": 5000,
  "followup_cooldown_hours": 24,
  "rate_limit_messages_per_minute": 5
}`}
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-semibold">
              Any changes committed to this JSON file are automatically reflected the next time n8n or the AI Orchestrator requests Gemini API to compose a custom message.
            </p>
          </div>

          {/* Section 3: Showcases vs. Implementation */}
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#E3B859] uppercase tracking-wider border-b border-[#2D2D30] pb-2">
              🎯 Interactive Frontend Showcase Status
            </h3>
            <div className="p-4 bg-purple-950/20 border border-purple-900/30 rounded-xl space-y-2">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">📢 Important Note</span>
              <p className="text-xs text-gray-300 leading-relaxed font-semibold">
                Yes, the <span className="text-white">Unified Inbox &amp; CRM</span> view and <span className="text-white">n8n Workflow Builder</span> screens are **showcase mockups (static mock data with reactive inputs)**. 
              </p>
              <p className="text-xs text-gray-300 leading-relaxed font-semibold">
                They are built for demonstration and client pitches to display the final vision of how incoming triggers validate, CRM fields edit, and how n8n webhook pipelines integrate.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Workflow Explanation */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D2D30] pb-2">
              ⚙️ Automation Workflows
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed font-semibold">
              The system runs three core workflows that drive lead nurturing:
            </p>
            
            <div className="space-y-3.5">
              <div className="p-3 bg-[#141416] border border-[#2D2D30]/60 rounded-xl text-xs space-y-1">
                <span className="font-bold text-white">1. Outreach Master Orchestrator</span>
                <p className="text-gray-400 leading-relaxed">Pulls qualified scraper leads, triggers Gemini using the outreach settings persona, and pushes messages via the WhatsApp gateway or Resend email APIs.</p>
              </div>

              <div className="p-3 bg-[#141416] border border-[#2D2D30]/60 rounded-xl text-xs space-y-1">
                <span className="font-bold text-white">2. Discovery Batch Scraper</span>
                <p className="text-gray-400 leading-relaxed">Orchestrates automated Map scraping routines. Fan-outs keyword list searches against defined area nodes in n8n.</p>
              </div>

              <div className="p-3 bg-[#141416] border border-[#2D2D30]/60 rounded-xl text-xs space-y-1">
                <span className="font-bold text-white">3. Cold Lead Cleanup Daemon</span>
                <p className="text-gray-400 leading-relaxed">Runs on a cron job schedule to mark stale conversations as unresponsive, archiving cold opportunities automatically.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#2D2D30] bg-[#18181A] p-6 text-xs text-center space-y-2">
            <span className="font-bold text-white block">Need Help Editing?</span>
            <p className="text-gray-500">Contact Zarss Dev Team to adjust Supabase keys or webhook routing parameters.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
