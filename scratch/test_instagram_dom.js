// c:/Users/ASUS/Documents/SECOND SEMISTER/INTERNSHIP/auto-mt/leadgen/scratch/test_instagram_dom.js

const path = require('path');
const backendDir = 'c:/Users/ASUS/Documents/SECOND SEMISTER/INTERNSHIP/auto-mt/leadgen/backend';
const browserManager = require(path.join(backendDir, 'worker/browserManager'));

async function main() {
  console.log('🚀 Running DOM debugger for @basantjoshiii...');
  
  let contextId = null;
  let pageId = null;
  
  try {
    const contextObj = await browserManager.newContext();
    contextId = contextObj.contextId;
    const pageObj = await browserManager.newPage(contextId, contextObj.context);
    pageId = pageObj.pageId;
    
    // Inject sessionid if available
    if (process.env.INSTAGRAM_SESSION_ID) {
      console.log('Injecting session cookie...');
      await contextObj.context.addCookies([
        {
          name: 'sessionid',
          value: process.env.INSTAGRAM_SESSION_ID,
          domain: '.instagram.com',
          path: '/',
          secure: true,
          httpOnly: true
        }
      ]);
    }
    
    const targetUrl = 'https://www.instagram.com/basantjoshiii/';
    console.log(`🌐 Navigating to: ${targetUrl}`);
    
    await pageObj.page.goto(targetUrl, { timeout: 25000, waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Print page title
    console.log('• Page Title:', await pageObj.page.title());
    
    const data = await pageObj.page.evaluate(() => {
      // Find all anchors
      const anchors = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText || '',
        href: a.getAttribute('href') || '',
        outerHTML: a.outerHTML.substring(0, 150)
      }));
      
      // Find all spans in header
      const headerSpans = Array.from(document.querySelectorAll('header span, main span')).map(s => s.innerText).filter(t => t && t.length > 0 && t.length < 200).slice(0, 30);
      
      return {
        anchors,
        headerSpans
      };
    });
    
    console.log('\n=======================================');
    console.log('🔗 ALL ANCHORS DETECTED ON PROFILE:');
    data.anchors.forEach(a => {
      console.log(`  - Text: "${a.text}", Href: "${a.href}", HTML: ${a.outerHTML}`);
    });
    console.log('\n=======================================');
    console.log('📝 SPANS DETECTED ON PROFILE:');
    console.log(data.headerSpans);
    console.log('=======================================');

  } catch (err) {
    console.error('❌ Failed:', err);
  } finally {
    if (pageId) await browserManager.releasePage(pageId);
    if (contextId) await browserManager.releaseContext(contextId);
    process.exit(0);
  }
}

main();
