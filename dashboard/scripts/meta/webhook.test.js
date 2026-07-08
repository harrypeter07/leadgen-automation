#!/usr/bin/env node
const { test, assert, summary } = require('./lib/test-helper')
console.log('\n🔗 Webhook Tests')
;(async () => {
  await test('GET /api/meta/webhook challenge verification passes with correct token', async (call, log) => {
    const verifyToken = process.env.META_VERIFY_TOKEN || 'FLOWFYP_VERIFY_TOKEN'
    const url = `/api/meta/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=TEST_CHALLENGE_12345`
    const res = await fetch(`${require('./lib/test-helper').BASE_URL}${url}`)
    const text = await res.text()
    log('📡', 'HTTP', `${res.status}`)
    log('📋', 'Challenge', text)
    assert(res.status === 200, `Expected 200 got ${res.status}`)
    assert(text.includes('TEST_CHALLENGE_12345'), 'Challenge not echoed back')
  })
  await test('GET /api/meta/webhook wrong token returns 403', async (call, log) => {
    const url = '/api/meta/webhook?hub.mode=subscribe&hub.verify_token=WRONG_TOKEN&hub.challenge=xyz'
    const { status } = await call('GET', url)
    log('📡', 'HTTP', `${status}`)
    assert(status === 403, `Expected 403 got ${status}`)
  })
  await test('POST /api/meta/webhook receives and acknowledges event', async (call, log) => {
    const payload = { object: 'page', entry: [{ id: '123', messaging: [{ sender: { id: 'user1' }, message: { text: 'hello' } }] }] }
    const { status, data, ms } = await call('POST', '/api/meta/webhook', payload)
    log('📡', 'HTTP', `${status} (${ms}ms)`)
    log('📋', 'Response', JSON.stringify(data))
    assert(status === 200, `Expected 200 got ${status}`)
    assert(data.received === true, 'Missing received: true')
  })
  summary('Webhook Tests')
})()
