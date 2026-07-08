#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n💭 Comments Tests')
;(async () => {
  await test('GET /api/meta/facebook/comments missing post_id returns 400', async (call) => {
    const { status } = await call('GET', '/api/meta/facebook/comments')
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('POST /api/meta/facebook/comments reply missing message returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/facebook/comments', { action: 'reply', comment_id: '123' })
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('GET /api/meta/instagram/comments missing media_id returns 400', async (call) => {
    const { status } = await call('GET', '/api/meta/instagram/comments')
    assert(status === 400, `Expected 400 got ${status}`)
  })
  await test('POST /api/meta/instagram/comments missing fields returns 400', async (call) => {
    const { status } = await call('POST', '/api/meta/instagram/comments', {})
    assert(status === 400, `Expected 400 got ${status}`)
  })
  summary('Comments Tests')
})()
