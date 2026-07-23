'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Key, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface GeminiKeyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GeminiKeyModal({ open, onOpenChange }: GeminiKeyModalProps) {
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success?: boolean; status?: string; error?: string; models?: string[] } | null>(null)

  useEffect(() => {
    if (open) {
      // Fetch active settings to prefill stored key
      setLoading(true)
      fetch('/api/meta/settings')
        .then(r => r.json())
        .then(d => {
          if (d.settings?.GEMINI_API_KEY) {
            setKey(d.settings.GEMINI_API_KEY)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [open])

  async function handleTestKey() {
    if (!key || key.trim() === '') {
      toast.error('Please enter a Gemini API key to test')
      return
    }

    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/meta/gemini-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key.trim() }),
      })
      const data = await res.json()
      setTestResult(data)
      if (data.success && data.status === 'active') {
        toast.success(`Key verified successfully! Found ${data.models?.length || 0} active models.`)
      } else {
        toast.error(data.error || 'Gemini API key verification failed')
      }
    } catch (err: any) {
      setTestResult({ success: false, status: 'error', error: err.message })
      toast.error(err.message || 'Network error verifying key')
    } finally {
      setTesting(false)
    }
  }

  async function handleSaveKey() {
    if (!key || key.trim() === '') {
      toast.error('Please enter a valid Gemini API key')
      return
    }

    const toastId = toast.loading('Updating Gemini API Key...')
    try {
      const res = await fetch('/api/meta/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { GEMINI_API_KEY: key.trim() }
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Gemini API Key updated successfully!', { id: toastId })
        onOpenChange(false)
      } else {
        throw new Error(data.error || 'Failed to update key')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle>Gemini AI Key Configuration</DialogTitle>
            <DialogDescription>View, test, or update your active Gemini API key used across AI workflows.</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-muted-foreground" />
              API Key
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setShowKey(v => !v)}
            >
              {showKey ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
              {showKey ? 'Hide' : 'Reveal'}
            </Button>
          </label>
          <div className="relative">
            <Input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Enter your Gemini API key (e.g. AIzaSy...)"
              disabled={loading}
              className="font-mono text-xs pr-20"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={testing || !key}
              onClick={handleTestKey}
              className="absolute right-1 top-1 h-7 text-[10px]"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test Key'}
            </Button>
          </div>
        </div>

        {testResult && (
          <div className={`p-3 rounded-lg border text-xs space-y-1 ${
            testResult.status === 'active' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
              : 'bg-destructive/10 border-destructive/20 text-destructive-foreground'
          }`}>
            <div className="flex items-center gap-2 font-medium">
              {testResult.status === 'active' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>
                {testResult.status === 'active' 
                  ? 'Key Active & Verified' 
                  : `Error: ${testResult.error || 'Key check failed'}`}
              </span>
            </div>
            {testResult.models && testResult.models.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {testResult.models.slice(0, 4).map(m => (
                  <Badge key={m} variant="secondary" className="text-[10px] py-0">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={handleSaveKey} disabled={!key || loading}>Save API Key</Button>
      </DialogFooter>
    </Dialog>
  )
}
