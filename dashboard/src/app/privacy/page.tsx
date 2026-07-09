import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy – FlowFyp',
  description: 'Privacy Policy for FlowFyp – Social Automation & Lead Generation Platform',
}

export default function PrivacyPolicyPage() {
  const lastUpdated = 'July 9, 2026'
  const appName = 'FlowFyp'
  const companyName = 'Zarss Marketing'
  const contactEmail = 'support@flowfyp.com'
  const appUrl = 'https://leadgen-automation-git-beta-agent-harrypeter07s-projects.vercel.app'

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '860px', margin: '0 auto', padding: '48px 24px', color: '#1a1a1a', lineHeight: '1.8', fontSize: '16px' }}>

      {/* Header */}
      <div style={{ borderBottom: '3px solid #1877F2', paddingBottom: '24px', marginBottom: '36px' }}>
        <h1 style={{ fontSize: '34px', fontWeight: '800', margin: '0 0 8px', color: '#0a0a0a' }}>
          Privacy Policy – {appName}
        </h1>
        <p style={{ margin: 0, color: '#555', fontSize: '15px' }}>
          Operated by <strong>{companyName}</strong>
        </p>
        <p style={{ margin: '6px 0 0', color: '#888', fontSize: '13px' }}>
          Last Updated: {lastUpdated}
        </p>
      </div>

      {/* 1. Introduction */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>1. Introduction</h2>
        <p>
          At <strong>{appName}</strong>, we value your privacy and are committed to protecting the information you share with us. This Privacy Policy explains how we collect, use, and safeguard data when you use our automation tools or connect your social media accounts (Instagram, Facebook, WhatsApp) with our services.
        </p>
        <p>
          By using {appName}, you agree to the practices described in this Privacy Policy.
        </p>
      </section>

      {/* 2. Information We Collect */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>2. Information We Collect</h2>
        <p>When you use {appName}, we may collect:</p>
        <ul>
          <li>Basic profile details (your name, email address, and profile picture)</li>
          <li>Basic Instagram, Facebook, and WhatsApp profile information (username, page name, profile picture)</li>
          <li>Permissions or insights you explicitly grant through the platform (e.g. follower counts, post reach)</li>
          <li>Messages or interactions <strong>only when required</strong> for automation workflows that <em>you</em> enable</li>
          <li>Technical information such as device type, browser, IP address, and usage logs for security and performance purposes</li>
        </ul>
        <p style={{ background: '#e8f4e8', border: '1px solid #b2d8b2', borderRadius: '8px', padding: '12px 16px', fontWeight: '600', color: '#1a5c1a' }}>
          ✅ We do <strong>NOT</strong> collect your Instagram, Facebook, or WhatsApp password.
        </p>
        <p style={{ background: '#e8f4e8', border: '1px solid #b2d8b2', borderRadius: '8px', padding: '12px 16px', fontWeight: '600', color: '#1a5c1a' }}>
          ✅ We connect to your accounts using official <strong>OAuth authorization</strong> provided by Meta — your login details are never shared with us.
        </p>
      </section>

      {/* 3. How We Use Information */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>3. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide you with access to the {appName} platform and its features</li>
          <li>Connect and manage your linked social media accounts on your behalf</li>
          <li>Schedule and publish content on your connected social accounts <em>as instructed by you</em></li>
          <li>Display incoming messages and conversations from Instagram, Facebook Messenger, and WhatsApp in a unified inbox</li>
          <li>Generate insights, analytics, and reports for your social media campaigns</li>
          <li>Operate automated workflows that you configure within the platform</li>
          <li>Send you important service notifications or updates</li>
          <li>Comply with applicable laws and Meta&apos;s Platform Policies</li>
        </ul>
      </section>

      {/* 4. What We Do NOT Do */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>4. What We Do NOT Do</h2>
        <ul>
          <li>We do <strong>not</strong> collect or store your social media passwords</li>
          <li>We do <strong>not</strong> sell, rent, or trade your personal data to third parties</li>
          <li>We do <strong>not</strong> use your data for advertising targeting outside of your own campaigns</li>
          <li>We do <strong>not</strong> access your accounts without your explicit permission</li>
          <li>We do <strong>not</strong> store message content permanently — messages are fetched live from Meta&apos;s servers when you view them</li>
          <li>We do <strong>not</strong> share your data with unauthorized parties</li>
        </ul>
      </section>

      {/* 5. Meta Platform & Permissions */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>5. Meta Platform &amp; Permissions</h2>
        <p>
          {appName} connects to Facebook, Instagram, and WhatsApp using Meta&apos;s official APIs. We comply with <a href="https://developers.facebook.com/policy" style={{ color: '#1877F2' }}>Meta&apos;s Platform Policies</a>. We only request the minimum permissions required to provide the features you choose to use.
        </p>
        <p>You can revoke {appName}&apos;s access to your Meta accounts at any time by visiting:</p>
        <ul>
          <li><a href="https://www.facebook.com/settings?tab=applications" style={{ color: '#1877F2' }}>Facebook Settings → Apps &amp; Websites</a></li>
          <li>Instagram → Settings → Security → Apps &amp; Websites</li>
        </ul>
      </section>

      {/* 6. Data Sharing */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>6. Data Sharing</h2>
        <p>We may share data only in the following limited circumstances:</p>
        <ul>
          <li><strong>Service Providers:</strong> Trusted infrastructure providers (hosting, database) that help us operate the platform, bound by confidentiality agreements</li>
          <li><strong>Meta Platforms:</strong> Data is transmitted to Meta&apos;s APIs as required to operate your connected account features</li>
          <li><strong>Legal Requirements:</strong> If required by law or valid legal process</li>
        </ul>
        <p>We <strong>do not sell</strong> your data.</p>
      </section>

      {/* 7. Data Retention */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>7. Data Retention</h2>
        <ul>
          <li>Account profile data is kept while your account is active</li>
          <li>Message and conversation data is fetched in real-time and <strong>not permanently stored</strong></li>
          <li>When you close your account, your data is deleted within 30 days</li>
          <li>You may request deletion at any time (see Section 9)</li>
        </ul>
      </section>

      {/* 8. Security */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>8. Security</h2>
        <p>
          We take reasonable technical and organizational measures to protect your information. All data is transmitted over secure HTTPS connections. We regularly review our practices to maintain a high standard of data protection.
        </p>
      </section>

      {/* 9. Data Deletion */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>9. Data Deletion Request</h2>
        <p>You can request deletion of your data at any time:</p>
        <ol>
          <li>Go to {appName} → Settings → Connected Accounts → Disconnect accounts</li>
          <li>Email us at <a href={`mailto:${contactEmail}`} style={{ color: '#1877F2' }}>{contactEmail}</a> with subject: <em>&quot;Delete My Data&quot;</em></li>
        </ol>
        <p>We will confirm and complete the deletion within <strong>30 days</strong>.</p>
      </section>

      {/* 10. Your Rights */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>10. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the data we hold about you</li>
          <li>Correct inaccurate information</li>
          <li>Delete your data (see Section 9)</li>
          <li>Disconnect your social media accounts at any time</li>
          <li>Withdraw consent for data processing</li>
        </ul>
      </section>

      {/* 11. Children */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>11. Children&apos;s Privacy</h2>
        <p>
          {appName} is intended for business and professional use only. We do not knowingly collect information from anyone under the age of 13. If we become aware of such a case, we will promptly delete the information.
        </p>
      </section>

      {/* 12. Changes */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>12. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy periodically. When we do, we will revise the &quot;Last Updated&quot; date at the top. We encourage you to review this page from time to time.
        </p>
      </section>

      {/* 13. Contact */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#0a0a0a' }}>13. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us:</p>
        <div style={{ background: '#f7f7f7', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '20px', fontSize: '15px' }}>
          <strong>{companyName}</strong><br />
          Platform: {appName}<br />
          Email: <a href={`mailto:${contactEmail}`} style={{ color: '#1877F2' }}>{contactEmail}</a><br />
          Website: <a href={appUrl} style={{ color: '#1877F2' }}>{appUrl}</a>
        </div>
      </section>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #ddd', paddingTop: '24px', marginTop: '40px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
        <p>&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</p>
        <p style={{ marginTop: '4px' }}>Last updated: {lastUpdated}</p>
      </div>
    </div>
  )
}
