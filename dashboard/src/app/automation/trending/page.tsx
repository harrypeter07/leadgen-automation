'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { 
  Flame, 
  Sparkles, 
  Database, 
  BarChart2, 
  Search, 
  MessageCircle, 
  ThumbsUp, 
  Compass 
} from 'lucide-react'

interface TrendingIdea {
  title: string
  hook: string
  description: string
  copy: string
  mediaSuggestion: string
}

export default function TrendingResearchPage() {
  const router = useRouter()
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<'instagram' | 'facebook'>('instagram')
  const [directMode, setDirectMode] = useState(false)
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<{
    niche: string
    hashtags: string[]
    sentiment: string
    ideas: TrendingIdea[]
    realDataFetched?: boolean
    directMode?: boolean
    hashtagsSearched?: string[]
  } | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    setSearching(true)
    const toastId = toast.loading('📡 Searching Instagram hashtags & generating ideas…')
    try {
      const res = await fetch('/api/meta/instagram/trending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), platform, directMode }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setResult(data)
        toast.success('Research completed!', { id: toastId })
      } else {
        throw new Error(data.error || 'Failed to fetch trends')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
    setSearching(false)
  }

  const handleSendToComposer = (copyText: string) => {
    // Save to localStorage and redirect to Publisher page
    localStorage.setItem('draft_post_caption', copyText)
    toast.success('Caption loaded into publisher draft!')
    router.push('/automation/publish')
  }

  return (
    <div className="space-y-6 text-white select-none">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E3B859] to-[#f5d58c] flex items-center justify-center shadow-lg shadow-[#E3B859]/10">
          <Flame className="w-5.5 h-5.5 text-[#141416]" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">Trending Content Research</h1>
          <p className="mt-0.5 text-xs text-gray-500 font-medium">Discover trending hashtags, hooks, and content formats for your niche using real-time data.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Search Panel */}
        <div className="md:col-span-1 border border-[#2D2D30] rounded-2xl bg-[#0E0E10] p-5 space-y-4 h-fit">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Trend Search</h2>
          
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Target Niche / Topic</label>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="E.g., Speciality Coffee, B2B SaaS"
                className="w-full bg-[#141416] border border-[#2D2D30] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Platform</label>
              <div className="grid grid-cols-2 p-1 bg-[#141416] border border-[#2D2D30] rounded-xl">
                {([
                  { 
                    id: 'instagram', 
                    label: 'Instagram', 
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                    )
                  },
                  { 
                    id: 'facebook', 
                    label: 'Facebook', 
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                      </svg>
                    )
                  }
                ] as const).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      platform === p.id 
                        ? 'bg-[#27272A] text-white border border-[#3F3F46]/50 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#141416] border border-[#2D2D30]">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-300 uppercase">Direct Live Data</span>
                  <span className="text-[8px] text-gray-500 font-medium">Bypass AI synthesis, show raw posts</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDirectMode(!directMode)}
                  className={`w-9 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                    directMode ? 'bg-[#E3B859]' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`bg-[#141416] w-3 h-3 rounded-full shadow-md transform transition-transform ${
                      directMode ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={searching || !topic.trim()}
              className="w-full py-2.5 rounded-xl bg-[#E3B859] hover:bg-[#d4ac50] text-[#141416] text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
            >
              {searching ? '⏳ Analyzing Trends…' : '🔍 Scan Trends'}
            </button>
          </form>
        </div>

        {/* Results Panel */}
        <div className="md:col-span-2 space-y-4">
          {!result ? (
            <div className="border border-[#2D2D30] rounded-2xl bg-[#0E0E10] p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#141416] border border-[#2D2D30] flex items-center justify-center text-gray-400">
                <Compass className="w-8 h-8 text-gray-400" />
              </div>
              <div className="max-w-xs space-y-1">
                <h3 className="text-sm font-bold text-gray-300">No Research Run Yet</h3>
                <p className="text-xs text-gray-500">Enter a target niche or topic on the left to scan live social media trends.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="border border-[#2D2D30] rounded-2xl bg-[#0E0E10] p-5 space-y-3">
                <div className="flex justify-between items-center border-b border-[#2D2D30] pb-2">
                  <span className="text-xs font-bold text-gray-400">RESEARCH RESULTS: {result.niche.toUpperCase()}</span>
                  <div className="flex items-center gap-2">
                    {result.realDataFetched ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
                        <Database className="w-2.5 h-2.5" /> REAL INSTAGRAM DATA
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                        <Sparkles className="w-2.5 h-2.5" /> AI GENERATED
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-purple-400 font-mono leading-relaxed">{result.sentiment}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {result.hashtags.map(tag => (
                    <span key={tag} className="text-[10px] font-bold bg-[#141416] border border-[#2D2D30] px-2.5 py-1 rounded-full text-purple-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Ideas List */}
              <div className="space-y-4">
                {result.ideas.map((idea, idx) => (
                  <div key={idx} className="border border-[#2D2D30] rounded-2xl bg-[#0E0E10] p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Idea #{idx + 1}: {idea.title}</h3>
                        <p className="text-[10px] text-gray-500 mt-1 leading-relaxed"><span className="font-bold text-purple-400">Format:</span> {idea.mediaSuggestion}</p>
                      </div>
                      <button
                        onClick={() => handleSendToComposer(idea.copy + '\n\n' + result.hashtags.join(' '))}
                        className="px-2.5 py-1.5 rounded-lg bg-[#E3B859] text-[#141416] text-[10px] font-bold uppercase transition-colors"
                      >
                        Use Copy
                      </button>
                    </div>

                    <div className="p-4 bg-[#141416] border border-[#2D2D30]/60 rounded-xl space-y-3 font-sans">
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="text-purple-400 font-bold uppercase tracking-wider text-[10px] min-w-[70px] inline-block pt-0.5">
                          {result.directMode ? 'METRICS:' : 'HOOK:'}
                        </span>
                        <span className="text-white font-medium">
                          {result.directMode ? idea.hook : `"${idea.hook}"`}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="text-purple-400 font-bold uppercase tracking-wider text-[10px] min-w-[70px] inline-block pt-0.5">
                          {result.directMode ? 'FORMAT:' : 'CONCEPT:'}
                        </span>
                        <span className="text-white">
                          {idea.description}
                        </span>
                      </div>
                      <div className="border-t border-[#2D2D30]/40 pt-3.5 space-y-1.5">
                        <span className="text-purple-400 font-bold text-[10px] uppercase tracking-wider block">
                          {result.directMode ? 'ORIGINAL CAPTION:' : 'CAPTION COPY:'}
                        </span>
                        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                          {idea.copy}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
