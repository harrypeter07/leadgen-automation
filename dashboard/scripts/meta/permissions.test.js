#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n🛡️ Permissions Tests')
;(async () => {
  await test('GET /api/meta/permissions returns scopes', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/permissions')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    log('🔐', 'Token valid', data.token_valid)
    log('📋', 'Scopes count', data.scopes?.length || 0)
    assert([200, 400].includes(status), `Expected 200 or 400 got ${status}`)
  })
  summary('Permissions Tests')
})()
