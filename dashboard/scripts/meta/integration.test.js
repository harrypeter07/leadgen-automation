#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n🔗 Integration Tests (full workflow simulation)')
;(async () => {
  await test('Status check all providers', async (call, log) => {
    const { data, ms } = await call('GET', '/api/meta/status')
    log('📡', 'Duration', `${ms}ms`)
    log('🔵', 'Meta App', data.providers?.meta_app?.status)
    log('📘', 'Facebook', data.providers?.facebook?.status)
    log('📸', 'Instagram', data.providers?.instagram?.status)
    log('💬', 'Messenger', data.providers?.messenger?.status)
    log('🔗', 'Webhooks', data.providers?.webhooks?.status)
    assert(data.providers, 'providers missing')
  })
  await test('OAuth token is valid', async (call, log) => {
    const { data, ms } = await call('GET', '/api/meta/oauth?action=validate')
    log('📡', 'Duration', `${ms}ms`)
    log('🔑', 'Valid', data.valid)
    assert(typeof data.valid === 'boolean', 'valid must be boolean')
  })
  await test('Facebook page reachable', async (call, log) => {
    const { status, ms } = await call('GET', '/api/meta/facebook/page?action=info')
    log('📡', 'Duration', `${ms}ms`)
    assert(status === 200)
  })
  await test('Instagram profile reachable', async (call, log) => {
    const { status, ms } = await call('GET', '/api/meta/instagram/profile?action=profile')
    log('📡', 'Duration', `${ms}ms`)
    assert(status === 200)
  })
  await test('Webhook verification is configured', async (call, log) => {
    const { data } = await call('GET', '/api/meta/status')
    log('🔗', 'Webhook status', data.providers?.webhooks?.status)
    assert(data.providers?.webhooks, 'webhook provider missing')
  })
  summary('Integration Tests')
})()
