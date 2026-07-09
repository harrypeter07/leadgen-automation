'use client'

import React, { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Post {
  id: string
  platform: 'facebook' | 'instagram'
  message?: string
  caption?: string
  created_time?: string
  timestamp?: string
  imageUrl?: string
  permalink?: string
}

interface Comment {
  id: string
  text: string
  message?: string // Facebook uses 'message'
  from?: { name?: string; username?: string; id?: string }
  timestamp?: string
  created_time?: string
  like_count?: number
  replies?: { data?: Array<{ id: string; text: string; from?: { name?: string; username?: string } }> }
}

export default function CommentManagerPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingComments, setLoadingComments] = useState(false)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [aiGeneratingId, setAiGeneratingId] = useState<string | null>(null)
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'facebook' | 'instagram'>('all')

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true)
    const fetched: Post[] = []

    try {
      const fbRes = await fetch('/api/meta/facebook/post?limit=10')
      const fbData = await fbRes.json()
      const fbPosts = fbData.data?.data ?? fbData.data ?? []
      if (Array.isArray(fbPosts)) {
        fbPosts.forEach((p: any) => {
          fetched.push({
            id: p.id,
            platform: 'facebook',
            message: p.message,
            created_time: p.created_time,
            permalink: p.permalink_url,
          })
        })
      }
    } catch (err) {
      console.error('FB posts fetch failed:', err)
    }

    try {
      const igRes = await fetch('/api/meta/instagram/media?limit=10')
      const igData = await igRes.json()
      const igMedia = igData.data?.data ?? igData.data ?? []
      if (Array.isArray(igMedia)) {
        igMedia.forEach((p: any) => {
          fetched.push({
            id: p.id,
            platform: 'instagram',
            caption: p.caption,
            created_time: p.timestamp,
            imageUrl: p.media_url,
            permalink: p.permalink,
          })
        })
      }
    } catch (err) {
      console.error('IG media fetch failed:', err)
    }

    // Sort by date desc
    fetched.sort((a, b) => {
      const tA = new Date(a.created_time || 0).getTime()
      const tB = new Date(b.created_time || 0).getTime()
      return tB - tA
    })

    setPosts(fetched)
    if (fetched.length > 0) {
      setSelectedPost(fetched[0])
    }
    setLoadingPosts(false)
  }, [])

  const fetchComments = useCallback(async (post: Post) => {
    setLoadingComments(true)
    setComments([])
    try {
      const endpoint = post.platform === 'instagram'
        ? `/api/meta/instagram/comments?media_id=${post.id}&limit=50`
        : `/api/meta/facebook/comments?post_id=${post.id}&limit=50`
      const res = await fetch(endpoint)
      const data = await res.json()
      const rawComments = data.data?.data ?? data.data ?? []
      setComments(rawComments)
    } catch (err) {
      console.error('Failed to load comments:', err)
      toast.error('Failed to load comments')
    }
    setLoadingComments(false)
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  useEffect(() => {
    if (selectedPost) {
      fetchComments(selectedPost)
    }
  }, [selectedPost, fetchComments])

  async function handleSendReply(commentId: string) {
    const text = replyTexts[commentId]
    if (!text?.trim() || !selectedPost) return
    setReplyingId(commentId)
    const toastId = toast.loading('Sending reply…')
    try {
      const endpoint = selectedPost.platform === 'instagram'
        ? '/api/meta/instagram/comments'
        : '/api/meta/facebook/comments'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          comment_id: commentId,
          message: text.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Reply posted!', { id: toastId })
        setReplyTexts(prev => ({ ...prev, [commentId]: '' }))
        fetchComments(selectedPost) // Reload
      } else {
        throw new Error(data.error?.message || data.error || 'Failed to post reply')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
    setReplyingId(null)
  }

  async function handleGenerateAIReply(commentId: string, commentText: string) {
    setAiGeneratingId(commentId)
    const toastId = toast.loading('Generating AI reply…')
    try {
      const res = await fetch('/api/meta/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commentText,
          persona: 'You are responding to a user comment on a business social media post. Keep it extremely brief (1-2 sentences), professional, warm, and engaging. Never sound like a generic bot.',
        }),
      })
      const data = await res.json()
      if (res.ok && data.reply) {
        setReplyTexts(prev => ({ ...prev, [commentId]: data.reply }))
        toast.success('AI reply suggested!', { id: toastId })
      } else {
        throw new Error(data.error || 'AI suggestion failed')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
    setAiGeneratingId(null)
  }

  async function handleHideComment(commentId: string, isHidden: boolean) {
    if (!selectedPost) return
    const toastId = toast.loading(isHidden ? 'Unhiding comment…' : 'Hiding comment…')
    try {
      const endpoint = selectedPost.platform === 'instagram'
        ? '/api/meta/instagram/comments'
        : '/api/meta/facebook/comments'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isHidden ? 'unhide' : 'hide',
          comment_id: commentId,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(isHidden ? 'Comment unhidden!' : 'Comment hidden!', { id: toastId })
        fetchComments(selectedPost)
      } else {
        throw new Error(data.error?.message || data.error || 'Failed to change comment status')
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId })
    }
  }

  const visiblePosts = filterPlatform === 'all' ? posts : posts.filter(p => p.platform === filterPlatform)

  return (
    <div className="space-y-6 text-white select-none">
      <div>
        <h1 className="text-3xl font-black tracking-tight">💬 Comment Manager</h1>
        <p className="mt-1 text-sm text-gray-500">Monitor and reply to comments on your Instagram and Facebook posts with Gemini AI support.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Post list */}
        <div className="lg:col-span-1 border border-[#2D2D30] rounded-2xl bg-[#0E0E10] overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-[#2D2D30] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400">SELECT POST ({visiblePosts.length})</span>
              <div className="flex gap-1 bg-[#141416] rounded-lg p-0.5 border border-[#2D2D30]">
                {['all', 'facebook', 'instagram'].map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterPlatform(p as any)}
                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-colors ${
                      filterPlatform === p ? 'bg-[#222225] text-white' : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {p === 'all' ? 'All' : p === 'facebook' ? 'FB' : 'IG'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingPosts ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-[#1A1A1C] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : visiblePosts.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-xs">No posts found.</div>
            ) : (
              visiblePosts.map(post => {
                const text = post.platform === 'instagram' ? post.caption : post.message
                return (
                  <button
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className={`w-full text-left p-4 border-b border-[#1A1A1C] transition-colors hover:bg-[#1A1A1C] flex gap-3 ${
                      selectedPost?.id === post.id ? 'bg-[#1A1A1C] border-l-2 border-l-purple-500' : ''
                    }`}
                  >
                    {post.imageUrl && (
                      <img src={post.imageUrl} alt="post" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs">{post.platform === 'instagram' ? '📸' : '📘'}</span>
                        <span className="text-[10px] text-gray-500">{new Date(post.created_time || '').toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-300 truncate leading-relaxed">{text || '(No caption)'}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right column: Comments list */}
        <div className="lg:col-span-2 border border-[#2D2D30] rounded-2xl bg-[#0E0E10] overflow-hidden flex flex-col h-[600px]">
          {selectedPost ? (
            <>
              <div className="p-4 border-b border-[#2D2D30] bg-[#141416] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Comments on Post</h3>
                  <p className="text-xs text-gray-300 truncate max-w-[400px] mt-0.5">
                    {selectedPost.platform === 'instagram' ? selectedPost.caption : selectedPost.message}
                  </p>
                </div>
                {selectedPost.permalink && (
                  <a href={selectedPost.permalink} target="_blank" rel="noreferrer" className="text-xs text-purple-400 hover:underline">
                    View Post ↗
                  </a>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingComments ? (
                  <div className="flex items-center justify-center h-full text-gray-500 animate-pulse text-xs">Loading comments…</div>
                ) : comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                    <span className="text-3xl">📭</span>
                    <span className="text-xs font-bold text-gray-400">No comments found on this post.</span>
                  </div>
                ) : (
                  comments.map(c => {
                    const cText = c.text || c.message || ''
                    const name = c.from?.name || (c.from?.username ? `@${c.from.username}` : 'Anonymous')
                    return (
                      <div key={c.id} className="p-4 rounded-xl border border-[#2D2D30] bg-[#141416] space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-black text-white">{name}</span>
                            <span className="text-[10px] text-gray-500 ml-2">
                              {c.timestamp || c.created_time ? new Date(c.timestamp || c.created_time || '').toLocaleTimeString() : ''}
                            </span>
                          </div>
                          <button
                            onClick={() => handleHideComment(c.id, false)}
                            className="text-[10px] text-gray-500 hover:text-white transition-colors"
                          >
                            Hide
                          </button>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed font-mono">{cText}</p>

                        {/* Existing replies */}
                        {c.replies?.data && c.replies.data.length > 0 && (
                          <div className="pl-4 border-l border-[#2D2D30] space-y-2 mt-2">
                            {c.replies.data.map(reply => (
                              <div key={reply.id} className="text-xs">
                                <span className="font-bold text-purple-400 mr-2">{reply.from?.name || 'Reply'}:</span>
                                <span className="text-gray-300 leading-relaxed">{reply.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply box */}
                        <div className="flex gap-2 pt-2 border-t border-[#2D2D30]/40">
                          <input
                            value={replyTexts[c.id] || ''}
                            onChange={e => setReplyTexts(prev => ({ ...prev, [c.id]: e.target.value }))}
                            placeholder="Write a reply…"
                            className="flex-1 bg-[#0E0E10] border border-[#2D2D30] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleGenerateAIReply(c.id, cText)}
                            disabled={aiGeneratingId === c.id}
                            className="px-2.5 py-2 rounded-xl bg-purple-950/40 border border-purple-900/30 text-purple-300 text-xs font-bold hover:bg-purple-900/30 transition-colors"
                          >
                            ✨ AI
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendReply(c.id)}
                            disabled={replyingId === c.id || !replyTexts[c.id]?.trim()}
                            className="px-3 py-2 rounded-xl bg-[#E3B859] text-[#141416] text-xs font-bold hover:bg-[#d4ac50] transition-colors disabled:opacity-40"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
              <span className="text-4xl">💬</span>
              <span className="text-xs">Select a post to manage comments.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
