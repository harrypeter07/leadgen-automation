#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n💬 Messenger Tests')
;(async () => {
  await test('GET /api/meta/facebook/messages returns conversations', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/facebook/messages')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
    assert(data.success !== undefined, 'Missing success field')
  })
  await test('POST /api/meta/facebook/messages missing params returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/facebook/messages', {})
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('POST /api/meta/instagram/messages missing params returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/instagram/messages', {})
    assert(status === 400, `Expected 400 got ${status}`)
  })
  summary('Messenger Tests')
})()
