#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n📸 Instagram Tests')
;(async () => {
  await test('GET /api/meta/instagram/profile returns profile', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/instagram/profile')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
    assert(data.success !== undefined, 'Missing success field')
  })
  await test('GET /api/meta/instagram/media returns media list', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/instagram/media')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
  })
  await test('GET /api/meta/instagram/insights returns metrics', async (call, log) => {
    const { status, ms } = await call('GET', '/api/meta/instagram/insights')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
  })
  await test('GET /api/meta/instagram/messages returns DMs', async (call, log) => {
    const { status, ms } = await call('GET', '/api/meta/instagram/messages')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
  })
  await test('POST /api/meta/instagram/comments missing params returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/instagram/comments', {})
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('GET /api/meta/instagram/comments missing media_id returns 400', async (call) => {
    const { status } = await call('GET', '/api/meta/instagram/comments')
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('POST /api/meta/instagram/post missing image_url returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/instagram/post', {})
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('POST /api/meta/instagram/reels missing video_url returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/instagram/reels', {})
    assert(status === 400, `Expected 400 got ${status}`)
  })
  summary('Instagram Tests')
})()
