#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n🔑 OAuth Tests')
;(async () => {
  await test('GET /api/meta/oauth?action=url returns auth URL', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/oauth?action=url')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    log('🔗', 'Auth URL', data.auth_url?.slice(0, 60) + '...')
    assert(status === 200, `Expected 200 got ${status}`)
    assert(data.auth_url, 'Missing auth_url')
    assert(data.auth_url.includes('dialog/oauth'), 'URL must include dialog/oauth')
  })
  await test('GET /api/meta/oauth validates current token', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/oauth?action=validate')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    log('✔', 'Token valid', data.valid)
    assert(status === 200, `Expected 200 got ${status}`)
    assert(typeof data.valid === 'boolean', 'Missing valid field')
  })
  await test('POST /api/meta/oauth debug_token', async (call, log) => {
    const { status, data, ms } = await call('POST', '/api/meta/oauth', { action: 'debug_token' })
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert([200, 400].includes(status), `Expected 200 or 400 got ${status}`)
  })
  summary('OAuth Tests')
})()
