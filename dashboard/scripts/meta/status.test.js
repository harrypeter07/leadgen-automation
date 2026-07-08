#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n🔵 Status Tests')
;(async () => {
  await test('GET /api/meta/status returns providers', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/status')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    log('📦', 'Providers', JSON.stringify(Object.keys(data.providers || {})))
    assert(status === 200, `Expected 200 got ${status}`)
    assert(data.providers, 'Missing providers field')
    assert(typeof data.all_connected === 'boolean', 'Missing all_connected boolean')
  })
  await test('Status includes graph_api_version', async (call) => {
    const { data } = await call('GET', '/api/meta/status')
    assert(data.graph_api_version, 'Missing graph_api_version')
  })
  summary('Status Tests')
})()
