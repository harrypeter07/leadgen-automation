#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n📊 Insights Tests')
;(async () => {
  await test('GET /api/meta/facebook/insights returns 200', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/facebook/insights')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
    assert(data.success !== undefined, 'Missing success field')
  })
  await test('GET /api/meta/facebook/insights with custom metric', async (call, log) => {
    const { status, ms } = await call('GET', '/api/meta/facebook/insights?metric=page_impressions&period=week')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
  })
  await test('GET /api/meta/instagram/insights returns 200', async (call, log) => {
    const { status, data, ms } = await call('GET', '/api/meta/instagram/insights')
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    assert(status === 200, `Expected 200 got ${status}`)
  })
  summary('Insights Tests')
})()
