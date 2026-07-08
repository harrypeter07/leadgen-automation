#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n📘 Facebook Tests')
;(async () => {
  await test('GET /api/meta/facebook/page returns page info', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/facebook/page')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    log('📄', 'Response', JSON.stringify(data).slice(0, 80))
    assert(status === 200, `Expected 200 got ${status}`)
    assert(data.success !== undefined, 'Missing success field')
  })
  await test('GET /api/meta/facebook/post lists posts', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/facebook/post')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
  })
  await test('GET /api/meta/facebook/insights returns metrics', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/facebook/insights')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
  })
  await test('GET /api/meta/facebook/messages returns conversations', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/facebook/messages')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
  })
  await test('POST /api/meta/facebook/comments missing params returns 400', async (call, log) => {
    const { status } = await call('POST', '/api/meta/facebook/comments', {})
    assert(status === 400, `Expected 400 got ${status}`)
  })
  summary('Facebook Tests')
})()
