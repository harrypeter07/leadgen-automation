// dashboard/src/app/leads/components/ConversationTimeline.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface Observation {
  id: string
  observation_type: string
  content: string
  created_at: string
}

interface TimelineEvent {
  id: string
  type: 'message' | 'observation' | 'meeting' | 'stage_change'
  title: string
  description: string
  timestamp: string
  channel?: string
  direction?: string
  status?: string
}

export default function ConversationTimeline({ leadId }: { leadId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTimeline = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const memoryRes = await fetch(`/api/outreach/memory/${leadId}`)
      if (!memoryRes.ok) {
        throw new Error('Lead has not been initialized for outreach yet.')
      }

      const memoryData = await memoryRes.json()
      const consolidatedEvents: TimelineEvent[] = []

      // 1. Map observations
      if (memoryData.success && memoryData.data.observations) {
        memoryData.data.observations.forEach((obs: Observation) => {
          consolidatedEvents.push({
            id: obs.id,
            type: 'observation',
            title: `Insight Extracted (${obs.observation_type})`,
            description: obs.content,
            timestamp: obs.created_at
          })
        })
      }

      // 2. Map default qualification event
      const profile = memoryData.data.profile || {}
      const memory = memoryData.data.memory || {}

      if (profile.created_at) {
        consolidatedEvents.push({
          id: 'init',
          type: 'stage_change',
          title: 'Lead Qualified',
          description: `Outreach system tracking initialized for ${profile.business_name || 'Business'}.`,
          timestamp: profile.created_at
        })
      }

      // 3. Map default audit event
      if (memory.created_at) {
        consolidatedEvents.push({
          id: 'audit',
          type: 'observation',
          title: 'Automated Audit Synthesized',
          description: memory.summary || 'Initial automated website audit parsed by AI.',
          timestamp: memory.created_at
        })
      }

      // 4. Map chat messages and their delivery logs
      if (memoryData.success && memoryData.data.messages) {
        memoryData.data.messages.forEach((msg: any) => {
          const latestLog = msg.logs?.[0] || {}
          let statusText = ''
          if (latestLog.status) {
            statusText = ` [${latestLog.status.toUpperCase()}]`
          }
          const errText = latestLog.error_message ? ` (Error: ${latestLog.error_message})` : ''

          consolidatedEvents.push({
            id: msg.id,
            type: 'message',
            title: `${msg.direction === 'inbound' ? '📥 Received' : '📤 Sent'} ${msg.channel.toUpperCase()}${statusText}`,
            description: msg.body + errText,
            timestamp: msg.created_at,
            channel: msg.channel,
            direction: msg.direction,
            status: latestLog.status
          })
        })
      }

      // Sort events chronologically
      consolidatedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setEvents(consolidatedEvents)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred fetching the timeline.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    if (leadId) {
      fetchTimeline()
    }
  }, [leadId, fetchTimeline])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse py-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-6 px-4 border border-dashed border-amber-200 rounded-xl bg-amber-50/50 text-amber-700 text-xs font-semibold">
        <p className="font-bold mb-1">Outreach Pending</p>
        <p>{error}</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <p className="text-gray-400 italic text-center py-6 text-xs">No outreach events logged yet.</p>
    )
  }

  return (
    <div className="flow-root py-4 max-h-[450px] overflow-y-auto pr-2">
      <ul className="-mb-8">
        {events.map((event, eventIdx) => (
          <li key={event.id}>
            <div className="relative pb-8">
              {eventIdx !== events.length - 1 ? (
                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-[#E4E3DD]" aria-hidden="true" />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white text-sm
                    ${event.type === 'stage_change' ? 'bg-[#D4E0CD] text-[#2E3A2F]' : ''}
                    ${event.type === 'observation' ? 'bg-purple-100 text-purple-700' : ''}
                    ${event.type === 'meeting' ? 'bg-amber-100 text-amber-700' : ''}
                    ${event.type === 'message' ? 'bg-blue-100 text-blue-700' : ''}
                  `}>
                    {event.type === 'stage_change' && '✓'}
                    {event.type === 'observation' && '💡'}
                    {event.type === 'meeting' && '📅'}
                    {event.type === 'message' && '💬'}
                  </span>
                </div>
                 <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-gray-800">{event.title}</p>
                      {event.status === 'failed' && (
                        <span className="text-[8px] font-black uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">Failed</span>
                      )}
                      {event.status === 'sent' && (
                        <span className="text-[8px] font-black uppercase bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">Sent</span>
                      )}
                      {event.status === 'pending' && (
                        <span className="text-[8px] font-black uppercase bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200 animate-pulse">Sending...</span>
                      )}
                    </div>
                    {event.type === 'message' ? (
                      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-150 p-3 rounded-2xl whitespace-pre-wrap leading-relaxed font-medium inline-block max-w-md">
                        {event.description}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 font-medium leading-relaxed">{event.description}</p>
                    )}
                  </div>
                  <div className="text-right text-[10px] whitespace-nowrap text-gray-400 font-bold uppercase pt-1">
                    {new Date(event.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
