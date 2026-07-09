'use client'

import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

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
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<{
    niche: string
    hashtags: string[]
    sentiment: string
    ideas: TrendingIdea[]
  } | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    setSearching(true)
    const toastId = toast.loading('Researching trends…')
    try {
      const res = await fetch('/api/meta/instagram/trending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), platform }),
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
      <div>
        <h1 className="text-3xl font-black tracking-tight">🔥 Trending Content Research</h1>
        <p className="mt-1 text-sm text-gray-500 font-medium">Discover trending hashtags, hooks, and content formats for your niche using Gemini AI research.</p>
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
              <div className="flex gap-2">
                {['instagram', 'facebook'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p as any)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase border transition-all ${
                      platform === p ? 'bg-[#222225] border-purple-500/40 text-white' : 'bg-[#141416] border-[#2D2D30] text-gray-500 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
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
            <div className="border border-[#2D2D30] rounded-2xl bg-[#0E0E10] p-12 text-center text-gray-600 flex flex-col items-center justify-center gap-3">
              <span className="text-4xl">📊</span>
              <span className="text-xs">Enter a topic to generate trending strategy and content formats.</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="border border-[#2D2D30] rounded-2xl bg-[#0E0E10] p-5 space-y-3">
                <div className="flex justify-between items-center border-b border-[#2D2D30] pb-2">
                  <span className="text-xs font-bold text-gray-400">RESEARCH RESULTS: {result.niche.toUpperCase()}</span>
                  <span className="text-[10px] font-mono text-purple-400">Live Sentiment: {result.sentiment}</span>
                </div>
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

                    <div className="p-3.5 bg-[#141416] border border-[#2D2D30]/60 rounded-xl space-y-2 font-mono">
                      <div className="text-[10px] leading-relaxed"><span className="text-purple-400 font-bold">HOOK:</span> "{idea.hook}"</div>
                      <div className="text-[10px] leading-relaxed"><span className="text-purple-400 font-bold">CONCEPT:</span> {idea.description}</div>
                      <div className="text-[10px] leading-relaxed border-t border-[#2D2D30]/40 pt-2 text-gray-300 whitespace-pre-wrap"><span className="text-purple-400 font-bold block mb-1">CAPTION COPY:</span>{idea.copy}</div>
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
