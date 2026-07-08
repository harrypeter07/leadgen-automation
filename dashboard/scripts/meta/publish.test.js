#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n📤 Publish Tests')
;(async () => {
  await test('GET /api/meta/facebook/post lists posts from Graph API', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/facebook/post?limit=5')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
  })
  await test('POST /api/meta/facebook/post missing message returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/facebook/post', { action: 'publish' })
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('POST /api/meta/facebook/post missing action returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/facebook/post', {})
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('POST /api/meta/instagram/post without image_url returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/instagram/post', { caption: 'test' })
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('POST /api/meta/instagram/reels without video_url returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/instagram/reels', { caption: 'test' })
    assert(status === 400, `Expected 400 got ${status}`)
  })
  summary('Publish Tests')
})()
