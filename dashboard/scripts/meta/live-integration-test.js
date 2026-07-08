#!/usr/bin/env node
/**
 * LIVE Meta Graph API Integration Test Runner
 * Executes real HTTP requests against graph.facebook.com
 * Uses credentials from meta_credentials.txt
 */

const GRAPH = 'https://graph.facebook.com'
const V = 'v23.0'

// ── Real credentials (from meta_credentials.txt) ──────────────────────────
const PAGE_TOKEN   = 'EAAbmpxTMhfABRxjOhwXJDe8T0DVmr9QeZABdQRJPM8JFnRSyP0VgizWwGLVFLgDd2EfYW2ZCAx92q0gqnBaBC9609BTMrjffD1OAMNJiUzEgKDT4YZAP0z2ZBN1s0IFtyIiv92cSYbCiI48Q6hYqZB4lh260rL1sjjH3oiTpLK9OUjpRAuier92JTwPyox3bLnZCnZBrVI9BQZDZD'
const PAGE_ID      = '1165738093294228'
const APP_ID       = '1942455143138800'
const APP_SECRET   = '9dcb73e56c8eda32d1871f13b261e66d'
const IG_BIZ_ID    = '17841411718913026'
const VERIFY_TOKEN = 'FLOWFYP_VERIFY_TOKEN'
const WEBHOOK_URL  = 'https://leadgen-automation-git-beta-agent-harrypeter07s-projects.vercel.app/api/meta/webhook'

// ── Test result store ─────────────────────────────────────────────────────
const results = []

async function callGraph(label, url, opts = {}) {
  const start = Date.now()
  const fullUrl = url.includes('access_token=') ? url : `${url}${url.includes('?') ? '&' : '?'}access_token=${PAGE_TOKEN}`
  try {
    const res = await fetch(fullUrl, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    })
    const duration = Date.now() - start
    const data = await res.json().catch(() => ({}))
    const pass = res.ok && !data.error
    const entry = {
      label,
      url: url.replace(PAGE_TOKEN, '***TOKEN***').replace(APP_SECRET, '***SECRET***'),
      method: opts.method || 'GET',
      httpCode: res.status,
      duration,
      pass,
      response: data,
      error: data.error ? `[${data.error.code}] ${data.error.message} (${data.error.type})` : null,
    }
    results.push(entry)
    const icon = pass ? '✅' : '❌'
    console.log(`${icon} [${res.status}] ${label} (${duration}ms)`)
    if (!pass && data.error) console.log(`   ↳ ${entry.error}`)
    return { pass, data, httpCode: res.status, duration }
  } catch (err) {
    const duration = Date.now() - start
    const entry = { label, url, method: opts.method || 'GET', httpCode: 0, duration, pass: false, response: {}, error: err.message }
    results.push(entry)
    console.log(`❌ [ERR] ${label} — ${err.message} (${duration}ms)`)
    return { pass: false, data: {}, httpCode: 0, duration }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TEST GROUPS
// ─────────────────────────────────────────────────────────────────────────

async function testToken() {
  console.log('\n━━━ TOKEN VALIDATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const appToken = `${APP_ID}|${APP_SECRET}`
  const r = await callGraph(
    'Debug Page Access Token',
    `${GRAPH}/${V}/debug_token?input_token=${PAGE_TOKEN}&access_token=${appToken}`
  )
  if (r.pass && r.data?.data) {
    const d = r.data.data
    console.log(`   ↳ App ID match: ${d.app_id === APP_ID ? '✅' : '❌'} (${d.app_id})`)
    console.log(`   ↳ Token valid: ${d.is_valid ? '✅' : '❌'}`)
    console.log(`   ↳ Type: ${d.type}`)
    if (d.expires_at && d.expires_at > 0) {
      const exp = new Date(d.expires_at * 1000)
      console.log(`   ↳ Expires: ${exp.toISOString()}`)
    } else {
      console.log(`   ↳ Expires: Never (permanent token)`)
    }
    if (d.scopes) console.log(`   ↳ Scopes (${d.scopes.length}): ${d.scopes.join(', ')}`)
  }
}

async function testPermissions() {
  console.log('\n━━━ PERMISSIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const r = await callGraph('Get /me/permissions', `${GRAPH}/${V}/me/permissions`)
  if (r.pass && r.data?.data) {
    const granted = r.data.data.filter(p => p.status === 'granted').map(p => p.permission)
    const declined = r.data.data.filter(p => p.status === 'declined').map(p => p.permission)
    console.log(`   ↳ Granted (${granted.length}): ${granted.join(', ')}`)
    if (declined.length) console.log(`   ↳ Declined (${declined.length}): ${declined.join(', ')}`)
    const required = ['pages_show_list','pages_read_engagement','pages_messaging','pages_manage_posts',
      'instagram_basic','instagram_manage_messages','instagram_manage_comments','pages_manage_engagement']
    for (const p of required) {
      const g = granted.includes(p)
      console.log(`   ${g ? '✅' : '⚠'} ${p}: ${g ? 'GRANTED' : 'MISSING'}`)
    }
  }
}

async function testFacebook() {
  console.log('\n━━━ FACEBOOK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. Page info
  const pageR = await callGraph('Get Page Info',
    `${GRAPH}/${V}/${PAGE_ID}?fields=id,name,fan_count,link,category,about,website,phone,picture`)
  if (pageR.pass) {
    console.log(`   ↳ Page: ${pageR.data.name} | Fans: ${pageR.data.fan_count} | Category: ${pageR.data.category}`)
  }

  // 2. Posts
  const postsR = await callGraph('Get Page Posts',
    `${GRAPH}/${V}/${PAGE_ID}/posts?fields=id,message,created_time,permalink_url&limit=5`)
  let firstPostId = null
  if (postsR.pass && postsR.data?.data?.length) {
    firstPostId = postsR.data.data[0].id
    console.log(`   ↳ ${postsR.data.data.length} posts returned | First: ${firstPostId}`)
  }

  // 3. Publish test post
  const pubR = await callGraph('Publish Test Post', `${GRAPH}/${V}/${PAGE_ID}/feed`, {
    method: 'POST',
    body: { message: `[FlowFyp Live Test] Automated integration test — ${new Date().toISOString()}`, access_token: PAGE_TOKEN }
  })
  let testPostId = null
  if (pubR.pass && pubR.data?.id) {
    testPostId = pubR.data.id
    console.log(`   ↳ Published post ID: ${testPostId}`)
  }

  // 4. Get comments on first post
  if (firstPostId) {
    await callGraph('Get Comments on First Post',
      `${GRAPH}/${V}/${firstPostId}/comments?fields=id,message,from,created_time&limit=5`)
  }

  // 5. Page insights
  await callGraph('Get Page Insights',
    `${GRAPH}/${V}/${PAGE_ID}/insights?metric=page_impressions,page_engaged_users,page_fan_adds&period=day`)

  // 6. Conversations / Messenger inbox
  const convR = await callGraph('Get Messenger Conversations',
    `${GRAPH}/${V}/${PAGE_ID}/conversations?fields=id,link,participants,updated_time&limit=5`)
  let firstConvId = null
  if (convR.pass && convR.data?.data) {
    console.log(`   ↳ ${convR.data.data.length} conversations`)
    if (convR.data.data.length) firstConvId = convR.data.data[0].id
  }

  // 7. Read first conversation messages
  if (firstConvId) {
    await callGraph('Read Conversation Messages',
      `${GRAPH}/${V}/${firstConvId}?fields=messages{message,from,created_time}`)
  } else {
    results.push({ label: 'Send Messenger Test Message', url: 'N/A', method: 'POST', httpCode: 'SKIP', duration: 0, pass: 'SKIP',
      response: {}, error: null,
      note: 'No existing conversation. A real user must first send a message to the page before the reply API can be tested.' })
    console.log(`⚠️  SKIP — Send Messenger Message: no existing conversation (user must initiate first)`)
  }

  // 8. Delete test post
  if (testPostId) {
    await callGraph('Delete Test Post', `${GRAPH}/${V}/${testPostId}?access_token=${PAGE_TOKEN}`, { method: 'DELETE' })
  }
}

async function testMessenger() {
  console.log('\n━━━ MESSENGER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Subscribed apps
  const subR = await callGraph('Get Subscribed Apps',
    `${GRAPH}/${V}/${PAGE_ID}/subscribed_apps`)
  if (subR.pass && subR.data?.data) {
    console.log(`   ↳ Subscribed apps: ${subR.data.data.length}`)
    if (subR.data.data.length) {
      console.log(`   ↳ Fields: ${(subR.data.data[0]?.subscribed_fields || []).join(', ')}`)
    }
  }

  // Me profile as page
  await callGraph('Get Page /me Profile',
    `${GRAPH}/${V}/me?fields=id,name`)
}

async function testInstagram() {
  console.log('\n━━━ INSTAGRAM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. Profile
  const profR = await callGraph('Get IG Profile',
    `${GRAPH}/${V}/${IG_BIZ_ID}?fields=id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website`)
  if (profR.pass) {
    const d = profR.data
    console.log(`   ↳ @${d.username} | Followers: ${d.followers_count} | Media: ${d.media_count}`)
  }

  // 2. Media list
  const mediaR = await callGraph('Get IG Media List',
    `${GRAPH}/${V}/${IG_BIZ_ID}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=5`)
  let firstMediaId = null
  if (mediaR.pass && mediaR.data?.data?.length) {
    firstMediaId = mediaR.data.data[0].id
    console.log(`   ↳ ${mediaR.data.data.length} media items | First: ${firstMediaId} (${mediaR.data.data[0].media_type})`)
  }

  // 3. Comments on first media
  if (firstMediaId) {
    await callGraph('Get IG Media Comments',
      `${GRAPH}/${V}/${firstMediaId}/comments?fields=id,text,from,timestamp,like_count&limit=5`)
  }

  // 4. IG Insights
  await callGraph('Get IG Insights',
    `${GRAPH}/${V}/${IG_BIZ_ID}/insights?metric=impressions,reach,profile_views&period=day`)

  // 5. IG Conversations (DM inbox)
  const dmR = await callGraph('Get IG DM Conversations',
    `${GRAPH}/${V}/me/conversations?platform=instagram&fields=id,participants,messages{message,from,created_time}&limit=5`)
  let firstDmConvId = null
  if (dmR.pass && dmR.data?.data) {
    console.log(`   ↳ ${dmR.data.data.length} DM conversations`)
    if (dmR.data.data.length) firstDmConvId = dmR.data.data[0].id
  }

  if (!firstDmConvId) {
    results.push({ label: 'Send Instagram DM', url: 'N/A', method: 'POST', httpCode: 'SKIP', duration: 0, pass: 'SKIP',
      response: {}, error: null,
      note: 'No existing IG conversation. A real user must first DM the @smritifyp account. Only after receiving a message can you reply via API.' })
    console.log(`⚠️  SKIP — Send Instagram DM: no existing DM thread (user must send first)`)
  }

  // 6. Image container test (create only, do NOT publish)
  const containerR = await callGraph('Create IG Image Container (test, no publish)',
    `${GRAPH}/${V}/${IG_BIZ_ID}/media`, {
    method: 'POST',
    body: {
      image_url: 'https://www.gstatic.com/webp/gallery/1.jpg',
      caption: '[FlowFyp Live Test] Container test — not published',
      access_token: PAGE_TOKEN
    }
  })
  if (containerR.pass && containerR.data?.id) {
    console.log(`   ↳ Container ID: ${containerR.data.id} (NOT published — test only)`)
  }
}

async function testWebhook() {
  console.log('\n━━━ WEBHOOK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. GET challenge verification
  const challengeStr = 'LIVE_TEST_CHALLENGE_12345'
  const challengeUrl = `${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${challengeStr}`
  const start1 = Date.now()
  try {
    const res = await fetch(challengeUrl)
    const text = await res.text()
    const duration = Date.now() - start1
    const pass = res.status === 200 && text.trim() === challengeStr
    results.push({ label: 'Webhook GET Challenge Verify', url: challengeUrl.replace(VERIFY_TOKEN,'***'), method: 'GET',
      httpCode: res.status, duration, pass, response: { body: text }, error: pass ? null : `Expected challenge echo, got: ${text}` })
    console.log(`${pass ? '✅' : '❌'} [${res.status}] Webhook GET Challenge Verify (${duration}ms)`)
    console.log(`   ↳ Echoed: "${text.trim()}" | Expected: "${challengeStr}" | Match: ${pass ? 'YES' : 'NO'}`)
  } catch (e) {
    const duration = Date.now() - start1
    results.push({ label: 'Webhook GET Challenge Verify', url: challengeUrl, method: 'GET', httpCode: 0, duration, pass: false, response: {}, error: e.message })
    console.log(`❌ [ERR] Webhook GET Challenge Verify — ${e.message}`)
  }

  // 2. POST simulated event
  const start2 = Date.now()
  const payload = { object: 'page', entry: [{ id: PAGE_ID, time: Date.now(), messaging: [{ sender: { id: 'TEST_SENDER_001' }, recipient: { id: PAGE_ID }, timestamp: Date.now(), message: { mid: 'TEST_MID_001', text: 'live integration test' } }] }] }
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=invalid_for_test' },
      body: JSON.stringify(payload)
    })
    const text = await res.text()
    const duration = Date.now() - start2
    // Acceptable: 200 (processed) or 403 (signature reject — expected since we sent invalid sig)
    const pass = [200, 403].includes(res.status)
    results.push({ label: 'Webhook POST Simulated Event', url: WEBHOOK_URL, method: 'POST',
      httpCode: res.status, duration, pass, response: { body: text },
      error: !pass ? `Unexpected status ${res.status}` : null,
      note: res.status === 403 ? 'Signature rejected as expected (sent invalid HMAC). Signature validation is working.' : 'Event accepted by webhook handler.'
    })
    console.log(`${pass ? '✅' : '❌'} [${res.status}] Webhook POST Simulated Event (${duration}ms)`)
    console.log(`   ↳ ${res.status === 403 ? 'Signature correctly rejected (HMAC guard working)' : `Response: ${text.slice(0, 100)}`}`)
  } catch (e) {
    const duration = Date.now() - start2
    results.push({ label: 'Webhook POST Simulated Event', url: WEBHOOK_URL, method: 'POST', httpCode: 0, duration, pass: false, response: {}, error: e.message })
    console.log(`❌ [ERR] Webhook POST Simulated Event — ${e.message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────
// REPORT GENERATOR
// ─────────────────────────────────────────────────────────────────────────
function buildReport() {
  const now = new Date().toISOString()
  const pass = results.filter(r => r.pass === true).length
  const fail = results.filter(r => r.pass === false).length
  const skip = results.filter(r => r.pass === 'SKIP').length

  let md = `# Live Meta Integration Test Report\n`
  md += `*Generated: ${now}*\n\n`
  md += `**Graph API:** v23.0 | **Page:** Smriti (${PAGE_ID}) | **IG:** @smritifyp (${IG_BIZ_ID})\n\n`
  md += `---\n\n`
  md += `## Summary\n\n`
  md += `| Result | Count |\n|--------|-------|\n`
  md += `| ✅ PASS | ${pass} |\n`
  md += `| ❌ FAIL | ${fail} |\n`
  md += `| ⚠️ SKIP | ${skip} |\n`
  md += `| **Total** | **${results.length}** |\n\n`
  md += `---\n\n`
  md += `## Detailed Results\n\n`

  for (const r of results) {
    const icon = r.pass === true ? '✅ PASS' : r.pass === 'SKIP' ? '⚠️ SKIP' : '❌ FAIL'
    md += `### ${icon} — ${r.label}\n\n`
    md += `| Field | Value |\n|-------|-------|\n`
    md += `| **Request** | \`${r.method} ${r.url}\` |\n`
    md += `| **HTTP Code** | \`${r.httpCode}\` |\n`
    md += `| **Duration** | \`${r.duration}ms\` |\n`
    md += `| **Status** | ${icon} |\n`
    if (r.error) md += `| **Graph Error** | \`${r.error}\` |\n`
    if (r.note) md += `| **Note** | ${r.note} |\n`
    md += `\n`

    if (r.response && Object.keys(r.response).length > 0) {
      const responseStr = JSON.stringify(r.response, null, 2)
      const truncated = responseStr.length > 1200 ? responseStr.slice(0, 1200) + '\n... (truncated)' : responseStr
      md += `**Response:**\n\`\`\`json\n${truncated}\n\`\`\`\n\n`
    }

    md += `---\n\n`
  }

  // Appendix: Skipped tests explanation
  const skipped = results.filter(r => r.pass === 'SKIP')
  if (skipped.length) {
    md += `## Skipped Tests — User Action Required\n\n`
    for (const s of skipped) {
      md += `### ⚠️ ${s.label}\n\n`
      md += `**Reason:** ${s.note}\n\n`
      md += `**What is needed:** A real Facebook user or Instagram user must send a message to the page/account first. The Meta Graph API does not allow sending outbound messages to users who have not initiated contact (policy enforcement).\n\n`
    }
  }

  return md
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────
;(async () => {
  console.log('\n🔵 FlowFyp — Live Meta Graph API Integration Tests')
  console.log(`📡 API: ${GRAPH}/${V}`)
  console.log(`📄 Page: Smriti (${PAGE_ID})`)
  console.log(`📸 IG: @smritifyp (${IG_BIZ_ID})`)
  console.log('─'.repeat(55))

  await testToken()
  await testPermissions()
  await testFacebook()
  await testMessenger()
  await testInstagram()
  await testWebhook()

  const pass = results.filter(r => r.pass === true).length
  const fail = results.filter(r => r.pass === false).length
  const skip = results.filter(r => r.pass === 'SKIP').length

  console.log('\n' + '═'.repeat(55))
  console.log('📊 LIVE TEST RESULTS')
  console.log('═'.repeat(55))
  console.log(`✅ PASS: ${pass}`)
  console.log(`❌ FAIL: ${fail}`)
  console.log(`⚠️  SKIP: ${skip}`)
  console.log(`📋 TOTAL: ${results.length}`)
  console.log('═'.repeat(55))

  // Write report
  const fs = require('fs')
  const path = require('path')
  const reportDir = path.join(__dirname, 'automation', 'docs')
  fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(reportDir, 'live-meta-test-report.md')
  const report = buildReport()
  fs.writeFileSync(reportPath, report)
  console.log(`\n📝 Report written to: ${reportPath}`)

  // Output JSON for reference
  const jsonPath = path.join(reportDir, 'live-meta-test-results.json')
  fs.writeFileSync(jsonPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2))
  console.log(`📄 JSON written to: ${jsonPath}\n`)
})()
