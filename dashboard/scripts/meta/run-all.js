#!/usr/bin/env node
/**
 * scripts/meta/run-all.js
 * Master test runner for all Meta API integration tests.
 * Usage: node scripts/meta/run-all.js
 *        node scripts/meta/run-all.js --only facebook instagram
 */

const { execSync } = require('child_process')
const path = require('path')

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const ONLY = process.argv.includes('--only')
  ? process.argv.slice(process.argv.indexOf('--only') + 1)
  : null

const TESTS = [
  { name: 'status',      file: 'status.test.js' },
  { name: 'oauth',       file: 'oauth.test.js' },
  { name: 'permissions', file: 'permissions.test.js' },
  { name: 'facebook',    file: 'facebook.test.js' },
  { name: 'instagram',   file: 'instagram.test.js' },
  { name: 'messenger',   file: 'messenger.test.js' },
  { name: 'webhook',     file: 'webhook.test.js' },
  { name: 'publish',     file: 'publish.test.js' },
  { name: 'comments',    file: 'comments.test.js' },
  { name: 'insights',    file: 'insights.test.js' },
  { name: 'integration', file: 'integration.test.js' },
]

const toRun = ONLY ? TESTS.filter(t => ONLY.includes(t.name)) : TESTS

console.log(`\n🔵 FlowFyp Meta Test Suite`)
console.log(`📡 Target: ${BASE_URL}`)
console.log(`🧪 Tests: ${toRun.map(t => t.name).join(', ')}\n`)

const results = []
for (const test of toRun) {
  const filePath = path.join(__dirname, test.file)
  const start = Date.now()
  try {
    execSync(`node "${filePath}"`, {
      stdio: 'inherit',
      env: { ...process.env, TEST_BASE_URL: BASE_URL },
    })
    results.push({ name: test.name, status: '✅ PASSED', ms: Date.now() - start })
  } catch {
    results.push({ name: test.name, status: '❌ FAILED', ms: Date.now() - start })
  }
}

console.log('\n' + '─'.repeat(50))
console.log('📊 TEST SUMMARY')
console.log('─'.repeat(50))
for (const r of results) {
  console.log(`${r.status}  ${r.name.padEnd(20)} ${r.ms}ms`)
}
const passed = results.filter(r => r.status.includes('PASSED')).length
console.log(`\n${passed}/${results.length} tests passed`)
console.log('─'.repeat(50) + '\n')

if (passed < results.length) process.exit(1)
