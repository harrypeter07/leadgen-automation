// backend/scripts/postinstall.js

const { execSync } = require('child_process');
const path = require('path');

// Set browsers path to be relative to our project folder so they get packaged in the deploy image
const targetPath = path.resolve(__dirname, '../node_modules/playwright-core/.local-browsers');
process.env.PLAYWRIGHT_BROWSERS_PATH = targetPath;

console.log(`[Postinstall] Setting PLAYWRIGHT_BROWSERS_PATH to: ${targetPath}`);

try {
  console.log('[Postinstall] Downloading Playwright Chromium binary...');
  execSync('npx playwright install chromium', { stdio: 'inherit' });
  console.log('[Postinstall] Playwright Chromium installation completed successfully.');
} catch (err) {
  console.error('[Postinstall] Failed to download Playwright browsers:', err.message);
  process.exit(1);
}
