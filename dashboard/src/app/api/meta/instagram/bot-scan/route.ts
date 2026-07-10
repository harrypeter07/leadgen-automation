import { NextRequest, NextResponse } from 'next/server'
import { ensureMetaConfig } from '@/lib/meta/runtime-config'

const IG_BASE = 'https://graph.instagram.com/v25.0'
const MY_IG_ID = '17841411718913026'

// ── Bot Scoring Algorithm ────────────────────────────────────────────────────
// Based on rules used by HypeAuditor, Modash, SparkToro & Insta analytics tools
export interface BotScoreResult {
  userId: string
  username: string
  displayName: string
  profilePic: string | null
  source: 'dm' | 'comment' | 'mention'
  signals: BotSignal[]
  botScore: number          // 0–100 (higher = more bot-like)
  verdict: 'likely_bot' | 'suspicious' | 'probably_real' | 'real'
  followsCount: number
  followersCount: number
  mediaCount: number
  bio: string
  interactionHistory: string[]
}

export interface BotSignal {
  rule: string
  description: string
  score: number
  severity: 'low' | 'medium' | 'high'
}

function scoreAccount(profile: {
  username: string
  biography?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
  name?: string
}, interactions: string[]): BotSignal[] {
  const signals: BotSignal[] = []
  const username = profile.username || ''
  const bio = profile.biography || ''
  const followers = profile.followers_count ?? 0
  const follows = profile.follows_count ?? 0
  const posts = profile.media_count ?? 0

  // 1. Username pattern analysis
  const digitRatio = (username.match(/\d/g) || []).length / Math.max(username.length, 1)
  if (digitRatio > 0.5) {
    signals.push({ rule: 'high_digit_ratio', description: `Username is ${Math.round(digitRatio*100)}% digits (e.g. user9847261)`, score: 25, severity: 'high' })
  } else if (digitRatio > 0.3) {
    signals.push({ rule: 'moderate_digit_ratio', description: `Username has many numbers (${Math.round(digitRatio*100)}%)`, score: 12, severity: 'medium' })
  }

  // 2. Username ends with random numbers
  if (/[_\.]\d{4,}$/.test(username) || /\d{5,}/.test(username)) {
    signals.push({ rule: 'random_number_suffix', description: 'Username ends with a long number sequence', score: 20, severity: 'high' })
  }

  // 3. Very short username with numbers
  if (username.length <= 8 && /\d/.test(username)) {
    signals.push({ rule: 'short_numbered_username', description: 'Very short username with numbers', score: 10, severity: 'medium' })
  }

  // 4. No biography / empty bio
  if (!bio || bio.trim().length === 0) {
    signals.push({ rule: 'no_bio', description: 'Account has no bio description', score: 15, severity: 'medium' })
  }

  // 5. Generic/spam bio patterns
  const spamBioPatterns = ['follow for follow', 'f4f', 'follow back', 'dm for promo', 'link in bio', 'earn money', '💯', 'follow me', 'i follow back']
  const bioLower = bio.toLowerCase()
  const spamMatches = spamBioPatterns.filter(p => bioLower.includes(p))
  if (spamMatches.length > 0) {
    signals.push({ rule: 'spam_bio', description: `Bio contains spam phrases: "${spamMatches[0]}"`, score: 18, severity: 'high' })
  }

  // 6. Zero posts
  if (posts === 0) {
    signals.push({ rule: 'no_posts', description: 'Account has zero posts', score: 25, severity: 'high' })
  } else if (posts < 3) {
    signals.push({ rule: 'very_few_posts', description: `Only ${posts} post(s) — likely ghost account`, score: 15, severity: 'medium' })
  }

  // 7. High following-to-follower ratio
  const ratio = follows / Math.max(followers, 1)
  if (ratio > 20) {
    signals.push({ rule: 'extreme_follow_ratio', description: `Following ${follows} but only ${followers} followers (${ratio.toFixed(0)}x ratio)`, score: 35, severity: 'high' })
  } else if (ratio > 10) {
    signals.push({ rule: 'high_follow_ratio', description: `Follow ratio is ${ratio.toFixed(0)}x (following far more than followers)`, score: 22, severity: 'high' })
  } else if (ratio > 5) {
    signals.push({ rule: 'elevated_follow_ratio', description: `Follow ratio is ${ratio.toFixed(1)}x`, score: 12, severity: 'medium' })
  }

  // 8. Very low followers (< 50) with many follows
  if (followers < 50 && follows > 200) {
    signals.push({ rule: 'low_followers_mass_following', description: `Only ${followers} followers but following ${follows} accounts`, score: 20, severity: 'high' })
  }

  // 9. Mass follower count (paid followers indicator)
  if (followers > 10000 && follows < 100 && posts < 10) {
    signals.push({ rule: 'suspicious_high_followers', description: `${followers} followers with only ${posts} posts — likely bought followers`, score: 18, severity: 'medium' })
  }

  // 10. Interaction quality — only sends very short/generic messages
  const avgMsgLen = interactions.length > 0
    ? interactions.reduce((a, m) => a + m.length, 0) / interactions.length
    : 0
  const genericMsgs = ['hi', 'hello', 'hey', 'hii', 'nice', 'cool', 'great', '👍', '❤️', 'follow me', 'check my page']
  const isGeneric = interactions.every(m => genericMsgs.some(g => m.toLowerCase().trim() === g || m.trim().length <= 4))
  if (interactions.length > 0 && isGeneric) {
    signals.push({ rule: 'generic_interactions', description: 'Only sent generic/low-quality messages (hi, hey, nice)', score: 10, severity: 'low' })
  }

  // 11. Display name same as username (no personalization)
  const name = profile.name || ''
  if (name && name.toLowerCase().replace(/[^a-z0-9]/g,'') === username.toLowerCase().replace(/[^a-z0-9]/g,'')) {
    signals.push({ rule: 'name_equals_username', description: 'Display name is identical to username (no personalization)', score: 5, severity: 'low' })
  }

  return signals
}

function getVerdict(score: number): BotScoreResult['verdict'] {
  if (score >= 60) return 'likely_bot'
  if (score >= 35) return 'suspicious'
  if (score >= 15) return 'probably_real'
  return 'real'
}

async function igGet(path: string, token: string) {
  const url = `${IG_BASE}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`
  try {
    const res = await fetch(url)
    return await res.json()
  } catch { return null }
}

// GET /api/meta/instagram/bot-scan
export async function GET(req: NextRequest) {
  try {
    await ensureMetaConfig()
    const token = process.env.INSTAGRAM_ACCESS_TOKEN || ''
    if (!token) return NextResponse.json({ success: false, error: 'No Instagram token configured' }, { status: 400 })

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50')

    // ── Step 1: Collect known accounts from DMs ──────────────────────────────
    const knownAccounts: Map<string, { username: string; source: BotScoreResult['source']; interactions: string[] }> = new Map()

    // From DMs
    const convData = await igGet(`/me/conversations?fields=id,participants{id,username,name},messages{message,from}&limit=${Math.min(limit, 100)}`, token)
    if (convData?.data) {
      for (const conv of convData.data) {
        const msgs: Array<{ message?: string; from?: { id: string; username?: string } }> = conv.messages?.data || []
        for (const participant of conv.participants?.data || []) {
          if (participant.id === MY_IG_ID || participant.username === 'smritifyp') continue
          const existing = knownAccounts.get(participant.id) || { username: participant.username || '', source: 'dm' as const, interactions: [] }
          // Collect their messages
          const theirMsgs = msgs.filter(m => m.from?.id === participant.id).map(m => m.message || '').filter(Boolean)
          existing.interactions.push(...theirMsgs)
          knownAccounts.set(participant.id, existing)
        }
      }
    }

    // From post comments
    const mediaData = await igGet(`/me/media?fields=id,comments{id,text,from}&limit=10`, token)
    if (mediaData?.data) {
      for (const post of mediaData.data) {
        for (const comment of post.comments?.data || []) {
          if (!comment.from?.id || comment.from.id === MY_IG_ID) continue
          const existing = knownAccounts.get(comment.from.id) || { username: comment.from.username || '', source: 'comment' as const, interactions: [] }
          if (comment.text) existing.interactions.push(comment.text)
          knownAccounts.set(comment.from.id, existing)
        }
      }
    }

    // ── Step 2: Fetch profile data for each known account ────────────────────
    const results: BotScoreResult[] = []

    for (const [userId, info] of knownAccounts.entries()) {
      // Try fetching their profile
      let profileData: Record<string, unknown> = { id: userId, username: info.username }

      // Try to get profile details (works for accounts in our conversations)
      const profileRes = await igGet(`/${userId}?fields=id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url`, token)
      if (profileRes && !profileRes.error) {
        profileData = profileRes
      }

      const username = (profileData.username as string) || info.username || userId
      const bio = (profileData.biography as string) || ''
      const followers = (profileData.followers_count as number) || 0
      const follows = (profileData.follows_count as number) || 0
      const posts = (profileData.media_count as number) || 0
      const pic = (profileData.profile_picture_url as string) || null
      const name = (profileData.name as string) || username

      const signals = scoreAccount({
        username,
        biography: bio,
        followers_count: followers,
        follows_count: follows,
        media_count: posts,
        name,
      }, info.interactions)

      const totalScore = Math.min(signals.reduce((sum, s) => sum + s.score, 0), 100)

      results.push({
        userId,
        username,
        displayName: name,
        profilePic: pic,
        source: info.source,
        signals,
        botScore: totalScore,
        verdict: getVerdict(totalScore),
        followsCount: follows,
        followersCount: followers,
        mediaCount: posts,
        bio,
        interactionHistory: info.interactions,
      })
    }

    // Sort by bot score descending
    results.sort((a, b) => b.botScore - a.botScore)

    const summary = {
      total: results.length,
      likely_bot: results.filter(r => r.verdict === 'likely_bot').length,
      suspicious: results.filter(r => r.verdict === 'suspicious').length,
      probably_real: results.filter(r => r.verdict === 'probably_real').length,
      real: results.filter(r => r.verdict === 'real').length,
    }

    return NextResponse.json({ success: true, results, summary })
  } catch (err: unknown) {
    console.error('[BotScan] Error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
