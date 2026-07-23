'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Calendar as CalendarIcon, RefreshCw, Plus, Clock, ExternalLink, Image as ImageIcon, Heart, MessageCircle, Eye } from 'lucide-react'

interface CalendarPost {
  id: string
  platform: 'facebook' | 'instagram'
  title: string
  time: string
  type: 'ig' | 'fb'
  imageUrl?: string
  permalink?: string
  likes?: number
  comments?: number
  status?: string
}

export default function ContentCalendarPage() {
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'instagram' | 'facebook'>('all')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/meta/posts')
      const data = await res.json()
      if (res.ok && data.posts) {
        setPosts(data.posts)
      }
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const filteredPosts = filter === 'all' ? posts : posts.filter(p => p.platform === filter)

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Content Calendar & Publisher</h1>
            <p className="text-xs text-muted-foreground">Schedule, manage, and inspect multi-channel social posts.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchPosts} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button size="sm" asChild className="gap-1.5">
            <a href="/automation/publish">
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Post</span>
            </a>
          </Button>
        </div>
      </div>

      {/* Main Grid & Filters */}
      <Card>
        <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Scheduled & Published Feed</CardTitle>
          <div className="flex gap-1 bg-muted p-1 rounded-lg text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
            >
              All Channels
            </button>
            <button
              onClick={() => setFilter('instagram')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'instagram' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
            >
              Instagram
            </button>
            <button
              onClick={() => setFilter('facebook')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'facebook' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'}`}
            >
              Facebook
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <CalendarIcon className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium text-foreground">No content scheduled</p>
              <p>Create a post from the composer to see items in your content calendar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map(post => (
                <div key={post.id} className="rounded-xl border border-border bg-card p-4 space-y-3 flex flex-col justify-between hover:border-primary/50 transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-[10px] capitalize ${post.platform === 'instagram' ? 'text-pink-400 border-pink-500/30' : 'text-blue-400 border-blue-500/30'}`}>
                        {post.platform}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {post.time}
                      </span>
                    </div>
                    {post.imageUrl && (
                      <img src={post.imageUrl} alt={post.title} className="w-full h-36 object-cover rounded-lg border border-border" />
                    )}
                    <p className="text-xs text-foreground font-medium line-clamp-2">{post.title}</p>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-400" /> {post.likes || 0}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-blue-400" /> {post.comments || 0}</span>
                    </div>
                    {post.permalink && (
                      <a href={post.permalink} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-[11px]">
                        <span>View</span> <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
