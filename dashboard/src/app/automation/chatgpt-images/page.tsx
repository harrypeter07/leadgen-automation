'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { 
  Settings, 
  ArrowLeft, 
  Play, 
  Loader2, 
  Upload, 
  Trash2, 
  ExternalLink, 
  Copy, 
  Check, 
  FileText, 
  Image as ImageIcon,
  Key,
  Database,
  Terminal
} from 'lucide-react'

interface CustomSelectors {
  textarea?: string
  fileInput?: string
  sendButton?: string
  stopButton?: string
  assistantBubble?: string
  markdownText?: string
  generatedImage?: string
}

export default function ChatGPTImageAutomationPage() {
  const router = useRouter()

  // App settings states
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [sessionToken, setSessionToken] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [tabMode, setTabMode] = useState<'reuse' | 'new'>('reuse')
  const [customSelectors, setCustomSelectors] = useState<CustomSelectors>({})
  const [savingConfig, setSavingConfig] = useState(false)

  // Execution states
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<{ file: File; preview: string; url?: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<{ type: 'image' | 'text'; content: string } | null>(null)
  
  // Ref for auto-scrolling log terminal
  const logTerminalRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch initial config
  async function fetchConfig() {
    try {
      const res = await fetch('/api/automation/chatgpt/config')
      const data = await res.json()
      if (res.ok) {
        setHasToken(data.hasToken)
        setTabMode(data.tabMode || 'reuse')
        setCustomSelectors(data.customSelectors || {})
      }
    } catch (err) {
      console.error('Failed to load ChatGPT config:', err)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  // Auto scroll logs to bottom
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight
    }
  }, [logs])

  // Poll active logs while automation is running
  function startLogPolling() {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/automation/chatgpt/logs')
        const data = await res.json()
        if (res.ok && data.logs) {
          setLogs(data.logs)
          setIsRunning(data.isRunning)
          if (!data.isRunning && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
          }
        }
      } catch (err) {
        console.error('Error polling logs:', err)
      }
    }, 1000)
  }

  function stopLogPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopLogPolling()
  }, [])

  // Handle save configuration
  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    setSavingConfig(true)
    const toastId = toast.loading('Saving ChatGPT session configurations...')
    
    try {
      const res = await fetch('/api/automation/chatgpt/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: sessionToken.trim() || undefined,
          tabMode,
          customSelectors
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Configuration saved successfully!', { id: toastId })
        setShowConfigModal(false)
        setSessionToken('') // clear input display
        fetchConfig()
      } else {
        throw new Error(data.error || 'Failed to save config')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    } finally {
      setSavingConfig(false)
    }
  }

  // Handle uploading images to Cloudinary
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (images.length + files.length > 2) {
      toast.error('You can upload a maximum of 2 reference images.')
      return
    }

    setUploading(true)
    const newImages = [...images]

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const preview = URL.createObjectURL(file)
      const imageIndex = newImages.length

      newImages.push({ file, preview })
      setImages([...newImages]) // Set preview immediately

      // Upload to Cloudinary
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'chatgpt_references')

      try {
        const res = await fetch('/api/meta/cloudinary', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        if (res.ok && data.success) {
          newImages[imageIndex].url = data.publicUrl
          setImages([...newImages])
        } else {
          throw new Error(data.error || 'Cloudinary upload failed')
        }
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}: ${err.message}`)
        // Remove failed upload
        newImages.splice(imageIndex, 1)
        setImages([...newImages])
      }
    }

    setUploading(false)
  }

  // Remove uploaded reference image
  function handleRemoveImage(index: number) {
    const updated = [...images]
    URL.revokeObjectURL(updated[index].preview)
    updated.splice(index, 1)
    setImages(updated)
  }

  // Trigger ChatGPT Generation
  async function handleTriggerAutomation() {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt.')
      return
    }

    if (!hasToken) {
      toast.error('Please configure your ChatGPT Session Token first.')
      setShowConfigModal(true)
      return
    }

    // Verify all images have finished uploading
    const unfinished = images.some(img => !img.url)
    if (unfinished) {
      toast.error('Please wait for image uploads to complete.')
      return
    }

    setIsRunning(true)
    setLogs([])
    setResult(null)
    setLogs(['[System] Initializing ChatGPT Image Generation pipeline...'])
    
    // Start active polling
    startLogPolling()

    try {
      const imageUrls = images.map(img => img.url).filter(Boolean) as string[]
      
      const res = await fetch('/api/automation/chatgpt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          imageUrls,
          tabMode
        })
      })

      const data = await res.json()
      stopLogPolling() // Stop active polling to get final state

      if (res.ok && data.success) {
        setResult({ type: data.type, content: data.content })
        setLogs(data.logs || [])
        toast.success('ChatGPT automation complete!')
      } else {
        throw new Error(data.error || 'Automation execution failed')
      }
    } catch (err: any) {
      stopLogPolling()
      toast.error(`Automation failed: ${err.message}`)
      // Retrieve whatever final logs the API was able to output before crashing
      try {
        const res = await fetch('/api/automation/chatgpt/logs')
        const data = await res.json()
        if (res.ok && data.logs) setLogs(data.logs)
      } catch {}
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/automation/accounts')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                🤖 ChatGPT Image & Text Automation
              </h1>
              <p className="text-xs text-slate-400">Automate browser-based content generation via official ChatGPT and DALL-E 3</p>
            </div>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-800 flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Settings className="w-4 h-4" /> Configuration settings
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid gap-6 md:grid-cols-5">
          
          {/* Left Column: Composer Settings (3 cols) */}
          <div className="md:col-span-3 space-y-6">
            
            {/* Main composer card */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-2xl space-y-5">
              <div>
                <h3 className="text-sm font-black text-white">Generate with ChatGPT</h3>
                <p className="text-xs text-slate-400 mt-0.5">Input reference templates, describe instructions, and let Playwright script execute DALL-E 3</p>
              </div>

              {/* Reference Images Upload */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Reference Images (Max 2)</label>
                <div className="grid grid-cols-2 gap-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden group">
                      <img src={img.preview} alt="Upload preview" className="w-full h-full object-cover" />
                      {!img.url && (
                        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-xs text-slate-400 animate-pulse">
                          Uploading to cloud...
                        </div>
                      )}
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {images.length < 2 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="aspect-video rounded-xl border border-dashed border-slate-800 hover:border-rose-500/50 bg-slate-950/40 flex flex-col items-center justify-center gap-1.5 transition-all text-slate-400 hover:text-slate-200"
                    >
                      <Upload className="w-5 h-5 text-slate-500" />
                      <span className="text-[10px] font-bold">Add Reference Image</span>
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Prompt Instructions</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Draw a realistic portrait of a developer, or synthesize these two images into a single futuristic cyberpunk interface..."
                  className="w-full h-32 p-3.5 rounded-xl bg-slate-950 border border-slate-850 focus:border-rose-500/40 text-xs text-slate-200 focus:outline-none resize-none font-medium leading-relaxed"
                />
              </div>

              {/* Mode details */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-850 text-xs">
                <div>
                  <span className="font-bold text-white block">Tab Reuse Strategy</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Reusing existing tabs is significantly faster</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTabMode('reuse')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      tabMode === 'reuse' 
                        ? 'bg-rose-600 text-white font-black' 
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    Reuse Tab
                  </button>
                  <button
                    onClick={() => setTabMode('new')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      tabMode === 'new' 
                        ? 'bg-rose-600 text-white font-black' 
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    New Tab
                  </button>
                </div>
              </div>

              {/* Action trigger button */}
              <button
                onClick={handleTriggerAutomation}
                disabled={isRunning || uploading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.99] transition-all shadow-md shadow-rose-950/30 disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executing Automation...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Start ChatGPT Generation
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Viewer & logs (2 cols) */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Response Viewer */}
            <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3.5 min-h-[160px] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  ✨ Generated Response Viewer
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Final text response or generated DALL-E 3 image canvas</p>
              </div>

              <div className="flex-1 flex items-center justify-center bg-slate-950 border border-slate-850 rounded-xl overflow-hidden min-h-[220px]">
                {result ? (
                  result.type === 'image' ? (
                    <div className="relative group w-full h-full flex items-center justify-center p-2">
                      <img src={result.content} alt="DALL-E Output" className="max-h-[300px] w-auto rounded-lg shadow-2xl" />
                      <a
                        href={result.content}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-4 right-4 p-2 rounded-xl bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-900/25 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ) : (
                    <div className="p-4 w-full text-xs font-medium leading-relaxed text-slate-350 overflow-y-auto max-h-[300px] whitespace-pre-wrap">
                      {result.content}
                    </div>
                  )
                ) : isRunning ? (
                  <div className="text-center space-y-2 p-6 animate-pulse">
                    <Loader2 className="w-6 h-6 text-rose-500 animate-spin mx-auto" />
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Generating Output...</span>
                  </div>
                ) : (
                  <div className="text-center text-xs text-slate-600 p-6 leading-relaxed">
                    No results compiled yet.<br />Trigger the pipeline to generate content.
                  </div>
                )}
              </div>
            </div>

            {/* Execution Logger Terminal */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
              <div className="px-4 py-2.5 bg-slate-850 border-b border-slate-800 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-rose-500" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Live Playwright Logger
                </span>
              </div>
              <div 
                ref={logTerminalRef}
                className="p-4 bg-slate-950 font-mono text-[9px] leading-relaxed space-y-1.5 h-48 overflow-y-auto"
              >
                {logs.map((log, i) => (
                  <div key={i} className="text-slate-300 border-l-2 border-rose-500/20 pl-2">{log}</div>
                ))}
                {logs.length === 0 && (
                  <div className="text-slate-650 italic">Terminal listening for incoming Playwright browser events...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Modal */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
              
              <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-850">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-rose-500" /> ChatGPT Session Settings
                </h3>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ✕ Close
                </button>
              </div>

              <form onSubmit={handleSaveConfig} className="p-6 space-y-5">
                
                {/* Session Token */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    ChatGPT Session Token (__Secure-next-auth.session-token)
                  </label>
                  <input
                    type="password"
                    value={sessionToken}
                    onChange={(e) => setSessionToken(e.target.value)}
                    placeholder={hasToken ? "•••••••••••••••••••••••• (Saved)" : "Paste your session-token cookie value"}
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-850 focus:border-rose-500/40 text-xs focus:outline-none text-slate-200"
                  />
                  <p className="text-[9px] text-slate-500 leading-relaxed">
                    Instructions: Log in to chatgpt.com in your browser. Open DevTools (F12) -> Application -> Cookies -> Copy the value of the <code>__Secure-next-auth.session-token</code> cookie.
                  </p>
                </div>

                {/* Custom DOM Selectors override */}
                <div className="space-y-3.5 pt-3.5 border-t border-slate-800">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-rose-400" /> Advanced DOM Selector Overrides
                    </h4>
                    <p className="text-[9px] text-slate-500 mt-0.5">Allows updating query selectors if OpenAI changes their web UI code</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Textarea Input</label>
                      <input
                        type="text"
                        value={customSelectors.textarea || ''}
                        onChange={(e) => setCustomSelectors({ ...customSelectors, textarea: e.target.value || undefined })}
                        placeholder="textarea#prompt-textarea"
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-850 text-[10px] focus:outline-none text-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">File Input</label>
                      <input
                        type="text"
                        value={customSelectors.fileInput || ''}
                        onChange={(e) => setCustomSelectors({ ...customSelectors, fileInput: e.target.value || undefined })}
                        placeholder="input[type='file']"
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-850 text-[10px] focus:outline-none text-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Send Button</label>
                      <input
                        type="text"
                        value={customSelectors.sendButton || ''}
                        onChange={(e) => setCustomSelectors({ ...customSelectors, sendButton: e.target.value || undefined })}
                        placeholder="button[data-testid='send-button']"
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-850 text-[10px] focus:outline-none text-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Stop Button</label>
                      <input
                        type="text"
                        value={customSelectors.stopButton || ''}
                        onChange={(e) => setCustomSelectors({ ...customSelectors, stopButton: e.target.value || undefined })}
                        placeholder="button[data-testid='stop-button']"
                        className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-850 text-[10px] focus:outline-none text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex gap-3.5 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-950 border border-slate-850 text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase"
                  >
                    {savingConfig ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </div>
      <Toaster position="bottom-right" />
    </div>
  )
}
