const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const playwright = require('playwright');
const browserManager = require('../worker/browserManager');
const logger = require('../worker/logger');

class ChatgptBrowserService {
  constructor() {
    this.activeContext = null;
    this.activePage = null;
  }

  /**
   * Helper to download a remote image to a temporary local file path
   */
  async _downloadToTempFile(url, index) {
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
      });
      const ext = url.split('.').pop().split('?')[0] || 'jpg';
      const tempPath = path.join(os.tmpdir(), `chatgpt_upload_${Date.now()}_${index}.${ext}`);
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(tempPath));
        writer.on('error', reject);
      });
    } catch (err) {
      logger.error(`[ChatGPT Service] Failed to download image ${url}: ${err.message}`);
      throw new Error(`Failed to download reference image: ${err.message}`);
    }
  }

  /**
   * Automates the ChatGPT web flow to generate text or images
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Options including sessionToken, imageUrls, tabMode, customSelectors
   * @param {Function} logCallback - Function to send progress logs to the frontend
   */
  async generate(prompt, options = {}, logCallback = () => {}) {
    const {
      sessionToken,
      imageUrls = [],
      tabMode = 'reuse',
      customSelectors = {}
    } = options;

    if (!sessionToken) {
      throw new Error('ChatGPT session token is required.');
    }

    // Default OpenAI selectors
    const selectors = {
      textarea: 'textarea[placeholder="Ask anything"], textarea#prompt-textarea',
      fileInput: 'input[type="file"]',
      sendButton: 'button[data-testid="send-button"], button#composer-submit-button',
      stopButton: 'button[data-testid="stop-button"]',
      assistantBubble: 'div[role="assistant"], div[data-message-author-role="assistant"]',
      markdownText: 'div.markdown',
      generatedImage: 'img[src*="oaiusercontent.com"]',
      ...customSelectors
    };

    const tempFiles = [];
    let page = null;
    let context = null;

    try {
      // 1. Download reference images if present
      if (imageUrls && imageUrls.length > 0) {
        logCallback(`Downloading ${imageUrls.length} reference image(s) to temp folder...`);
        for (let i = 0; i < imageUrls.length; i++) {
          const tempPath = await this._downloadToTempFile(imageUrls[i], i);
          tempFiles.push(tempPath);
          logCallback(`Downloaded image ${i + 1} to: ${path.basename(tempPath)}`);
        }
      }

      // 2. Initialize Browser Context & Page
      const browser = await browserManager.launch();

      if (tabMode === 'reuse' && this.activeContext && this.activePage) {
        logCallback('Reusing existing ChatGPT browser context and tab...');
        context = this.activeContext;
        page = this.activePage;
      } else {
        // Shutdown any active reused tab if switching to new mode
        if (tabMode === 'new') {
          await this.cleanupReused();
        }

        logCallback('Creating a fresh browser context and tab for ChatGPT...');
        
        // Launch a persistent or new context
        const ctxRes = await browserManager.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          viewport: { width: 1280, height: 800 }
        });
        context = ctxRes.context;

        // Set ChatGPT authorization session cookie
        logCallback('Injecting ChatGPT authentication session token...');
        if (sessionToken.includes('=')) {
          const cookiePairs = sessionToken.split(';');
          const cookiesToAdd = [];
          for (const pair of cookiePairs) {
            const parts = pair.split('=');
            if (parts.length >= 2) {
              const name = parts[0].trim();
              const value = parts.slice(1).join('=').trim();
              cookiesToAdd.push({
                name,
                value,
                domain: '.chatgpt.com',
                path: '/',
                secure: true,
                httpOnly: true
              });
            }
          }
          await context.addCookies(cookiesToAdd);
        } else {
          await context.addCookies([
            {
              name: '__Secure-next-auth.session-token',
              value: sessionToken,
              domain: '.chatgpt.com',
              path: '/',
              secure: true,
              httpOnly: true
            }
          ]);
        }

        // Add stealth script to bypass Turnstile browser detection
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
          });
        });

        const pageRes = await browserManager.newPage(ctxRes.contextId, context);
        page = pageRes.page;

        if (tabMode === 'reuse') {
          this.activeContext = context;
          this.activePage = page;
        }
      }

      // 3. Navigate to ChatGPT
      logCallback('Navigating to https://chatgpt.com/ ...');
      const currentUrl = page.url();
      if (!currentUrl.includes('chatgpt.com')) {
        await page.goto('https://chatgpt.com/', { waitUntil: 'load', timeout: 45000 });
      } else {
        logCallback('Already on chatgpt.com. Reusing state.');
      }

      // 4. Verify login state
      logCallback('Verifying login session status...');
      try {
        await page.waitForSelector(selectors.textarea, { timeout: 15000 });
        logCallback('✓ Successfully authenticated and prompt textarea detected.');
      } catch (err) {
        // If textarea not found, it might be showing login/landing page
        const pageTitle = await page.title();
        logger.error(`[ChatGPT Service] Textarea not found. Page title: ${pageTitle}`);
        throw new Error('Authentication failed or ChatGPT prompt textarea is missing. Verify your __Secure-next-auth.session-token.');
      }

      // 5. Upload files if any
      if (tempFiles.length > 0) {
        logCallback(`Uploading ${tempFiles.length} reference image(s) into ChatGPT...`);
        
        // Locate file input
        const fileInputHandle = await page.locator(selectors.fileInput).first();
        if (fileInputHandle) {
          await fileInputHandle.setInputFiles(tempFiles);
          logCallback('✓ Upload payload queued in file input.');
          
          // Wait briefly for upload progress to finalize in UI
          await page.waitForTimeout(2500);
        } else {
          logCallback('⚠️ Warning: File input selector not found. Attempting to proceed without upload.');
        }
      }

      // 6. Enter prompt & submit
      logCallback(`Typing prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`);
      const inputLocator = page.locator(selectors.textarea).first();
      await inputLocator.focus({ force: true });
      await page.waitForTimeout(500);
      await page.keyboard.type(prompt, { delay: 5 });
      
      logCallback('Submitting message to ChatGPT...');
      const sendBtn = page.locator(selectors.sendButton).first();
      await sendBtn.click();

      // 7. Wait for generation to start and complete
      logCallback('Waiting for ChatGPT response generation to start...');
      try {
        await page.waitForSelector(selectors.assistantBubble, { state: 'visible', timeout: 15000 });
        logCallback('Generation in progress (Typing/DALL-E rendering)...');
      } catch (err) {
        throw new Error('Response bubble did not appear. Verification failed.');
      }

      // Wait for stop button to disappear
      await page.waitForSelector(selectors.stopButton, { state: 'detached', timeout: 60000 }).catch(() => {});

      // Adaptive streaming stabilization loop
      logCallback('Waiting for response stream to stabilize...');
      let prevLength = 0;
      let stableCount = 0;
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        const bubbles = page.locator(selectors.assistantBubble);
        const count = await bubbles.count();
        if (count > 0) {
          const lastText = await bubbles.nth(count - 1).innerText();
          if (lastText.length > 0 && lastText.length === prevLength) {
            stableCount++;
            if (stableCount >= 2) break;
          } else {
            stableCount = 0;
            prevLength = lastText.length;
          }
        }
      }
      logCallback('✓ Response generation finalized.');

      // 8. Analyze and extract the output (Image vs Text)
      logCallback('Parsing response content from the last message...');
      
      // Find the last assistant bubble message
      const assistantMessages = page.locator(selectors.assistantBubble);
      const messageCount = await assistantMessages.count();
      if (messageCount === 0) {
        throw new Error('Could not locate assistant message responses in conversation.');
      }
      
      const lastMessage = assistantMessages.nth(messageCount - 1);

      // Check if it contains a generated image
      const imageElement = lastMessage.locator(selectors.generatedImage);
      const hasImage = await imageElement.count() > 0;

      if (hasImage) {
        const imageUrl = await imageElement.first().getAttribute('src');
        logCallback(`📸 DALL-E 3 Image output detected!`);
        return {
          type: 'image',
          content: imageUrl,
          logs: `Successfully generated DALL-E 3 image: ${imageUrl}`
        };
      } else {
        // Fallback to text response
        const textElement = lastMessage.locator(selectors.markdownText);
        const textContent = await textElement.first().innerText();
        logCallback(`📝 Text output detected.`);
        return {
          type: 'text',
          content: textContent,
          logs: 'Successfully retrieved text response from ChatGPT.'
        };
      }
    } catch (err) {
      logCallback(`❌ Error during automation: ${err.message}`);
      logger.error(`[ChatGPT Service] Automation failure: ${err.message}`);
      throw err;
    } finally {
      // 9. Clean up temporary uploaded files
      if (tempFiles.length > 0) {
        logCallback('Cleaning up temporary image files...');
        for (const filePath of tempFiles) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            logger.warn(`Failed to delete temp file ${filePath}: ${e.message}`);
          }
        }
      }

      // 10. Clean up browser context if not reusing
      if (tabMode !== 'reuse') {
        logCallback('Closing browser context to free up memory...');
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
      }
    }
  }

  /**
   * Close and clear the active reused browser page and context
   */
  async cleanupReused() {
    if (this.activePage) {
      await this.activePage.close().catch(() => {});
      this.activePage = null;
    }
    if (this.activeContext) {
      await this.activeContext.close().catch(() => {});
      this.activeContext = null;
    }
  }
}

module.exports = new ChatgptBrowserService();
