#!/usr/bin/env node
/**
 * scripts/meta/lib/test-helper.js
 * Shared utilities for all Meta test scripts
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

let passed = 0
let failed = 0
const errors = []

function log(icon, label, detail) {
  console.log(`  ${icon} ${label}${detail ? `: ${detail}` : ''}`)
}

async function call(method, path, body) {
  const start = Date.now()
  const url = `${BASE_URL}${path}`
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data, ms: Date.now() - start }
}

async function test(label, fn) {
  try {
    await fn(call, log)
    passed++
    log('✅', label, 'PASSED')
  } catch (err) {
    failed++
    errors.push({ label, error: err.message })
    log('❌', label, `FAILED — ${err.message}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

function summary(suiteName) {
  console.log('\n' + '─'.repeat(40))
  console.log(`📊 ${suiteName}: ${passed} passed, ${failed} failed`)
  if (errors.length) {
    errors.forEach(e => console.log(`   ❌ ${e.label}: ${e.error}`))
  }
  console.log('─'.repeat(40) + '\n')
  if (failed > 0) process.exit(1)
}

module.exports = { test, assert, call, log, summary, BASE_URL }
