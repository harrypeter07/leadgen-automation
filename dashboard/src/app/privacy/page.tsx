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
    <div style={{ fontFamily: 'Georgia, serif', maxWidth: '860px', margin: '0 auto', padding: '48px 24px', color: '#1a1a1a', lineHeight: '1.8' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #1877F2', paddingBottom: '24px', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 8px', color: '#0a0a0a' }}>
          Privacy Policy
        </h1>
        <p style={{ margin: 0, color: '#555', fontSize: '15px' }}>
          <strong>{appName}</strong> &mdash; Social Automation &amp; Lead Generation Platform
        </p>
        <p style={{ margin: '8px 0 0', color: '#888', fontSize: '13px' }}>
          Last Updated: {lastUpdated} &nbsp;|&nbsp; Effective Date: {lastUpdated}
        </p>
      </div>

      {/* Introduction */}
      <section style={{ marginBottom: '32px' }}>
        <p>
          Welcome to <strong>{appName}</strong>, operated by <strong>{companyName}</strong> (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use our platform at <a href={appUrl} style={{ color: '#1877F2' }}>{appUrl}</a> (the &quot;Service&quot;).
        </p>
        <p>
          By accessing or using {appName}, you agree to the terms of this Privacy Policy. If you do not agree, please discontinue use of the Service.
        </p>
      </section>

      {/* 1. Information We Collect */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          1. Information We Collect
        </h2>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>1.1 Information You Provide</h3>
        <ul>
          <li>Account credentials (name, email address, password)</li>
          <li>Business or organization name</li>
          <li>Meta Platform credentials you voluntarily connect (Facebook Pages, Instagram Business accounts, WhatsApp Business accounts)</li>
          <li>Content you compose, schedule, or publish through the platform</li>
        </ul>

        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>1.2 Information from Meta Platforms</h3>
        <p>When you connect your Meta accounts, we access the following data solely to provide the Service:</p>
        <ul>
          <li><strong>Facebook Pages:</strong> Page name, ID, fan count, posts, and conversations</li>
          <li><strong>Instagram Business Accounts:</strong> Profile info, media posts, comments, Direct Messages (DMs), and insights metrics</li>
          <li><strong>WhatsApp Business:</strong> Message templates, messaging logs</li>
          <li><strong>Messenger:</strong> Conversations, message history, participant information</li>
        </ul>
        <p>
          We access this data using Meta&apos;s official Graph API under the following permissions: <code>pages_messaging</code>, <code>instagram_manage_messages</code>, <code>instagram_basic</code>, <code>instagram_manage_comments</code>, <code>instagram_manage_insights</code>, <code>instagram_content_publish</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code>, <code>whatsapp_business_messaging</code>, and related permissions.
        </p>

        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>1.3 Automatically Collected Information</h3>
        <ul>
          <li>Log data (IP address, browser type, pages visited, time/date of access)</li>
          <li>Device information (device type, operating system)</li>
          <li>Usage analytics (features used, interactions within the platform)</li>
          <li>Webhook events delivered by Meta (message events, comment events, lead events)</li>
        </ul>
      </section>

      {/* 2. How We Use Information */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          2. How We Use Your Information
        </h2>
        <ul>
          <li>To authenticate your identity and provide access to the Service</li>
          <li>To connect and manage your linked Meta platform accounts</li>
          <li>To display, schedule, and publish content on your connected social accounts on your behalf</li>
          <li>To display and manage incoming messages and conversations from Instagram, Facebook Messenger, and WhatsApp</li>
          <li>To generate insights, analytics, and campaign reports</li>
          <li>To operate automated workflows and n8n-based automation pipelines that you configure</li>
          <li>To send you notifications about your account or Service updates</li>
          <li>To comply with legal obligations and enforce our Terms of Service</li>
        </ul>
      </section>

      {/* 3. Meta Platform Data */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          3. Meta Platform Data &amp; Compliance
        </h2>
        <p>
          {appName} uses the <strong>Meta for Developers</strong> platform and complies with <a href="https://developers.facebook.com/policy" style={{ color: '#1877F2' }}>Meta&apos;s Platform Policies</a> and <a href="https://www.facebook.com/legal/terms" style={{ color: '#1877F2' }}>Meta&apos;s Terms of Service</a>.
        </p>
        <ul>
          <li>We do not sell Meta user data to third parties</li>
          <li>We do not use Meta data for advertising targeting purposes outside of the user&apos;s own campaigns</li>
          <li>Access tokens and credentials are encrypted at rest using AES-256 encryption</li>
          <li>We only request permissions necessary to provide the features you enable</li>
          <li>Message data accessed via the Messenger and Instagram APIs is used solely to display and manage conversations within the platform</li>
          <li>We comply with the <strong>Instagram Platform Policy</strong>, <strong>WhatsApp Business Policy</strong>, and applicable <strong>GDPR</strong> and <strong>CCPA</strong> regulations</li>
        </ul>
      </section>

      {/* 4. Data Sharing */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          4. Data Sharing &amp; Disclosure
        </h2>
        <p>We do <strong>not</strong> sell, trade, or rent your personal information. We may share data with:</p>
        <ul>
          <li><strong>Service Providers:</strong> Supabase (database), Vercel (hosting), n8n (workflow automation) — all under strict data processing agreements</li>
          <li><strong>Meta Platforms:</strong> Data is transmitted to Meta APIs as required to operate connected account features</li>
          <li><strong>Legal Compliance:</strong> We may disclose information if required by law, regulation, or valid legal process</li>
          <li><strong>Business Transfers:</strong> In the event of a merger or acquisition, user data may be transferred as a business asset</li>
        </ul>
      </section>

      {/* 5. Data Retention */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          5. Data Retention
        </h2>
        <ul>
          <li>Account data is retained for the duration of your account and deleted within 30 days of account closure</li>
          <li>Message and conversation data fetched from Meta APIs is not permanently stored — it is fetched in real-time from Meta&apos;s servers</li>
          <li>Access tokens are stored encrypted and deleted when you disconnect an account</li>
          <li>Audit logs are retained for up to 90 days</li>
        </ul>
      </section>

      {/* 6. Security */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          6. Security
        </h2>
        <p>
          We implement industry-standard security measures including AES-256 encryption for all stored credentials and tokens, TLS/HTTPS for all data transmission, row-level security in our database, and periodic security audits. However, no method of electronic storage or transmission is 100% secure.
        </p>
      </section>

      {/* 7. User Rights */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          7. Your Rights
        </h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
          <li><strong>Correction:</strong> Request correction of inaccurate personal data</li>
          <li><strong>Deletion:</strong> Request deletion of your personal data (&quot;right to be forgotten&quot;)</li>
          <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
          <li><strong>Objection:</strong> Object to processing of your personal data</li>
          <li><strong>Revoke Consent:</strong> Disconnect your Meta accounts at any time from the platform settings</li>
        </ul>
        <p>To exercise any right, contact us at <a href={`mailto:${contactEmail}`} style={{ color: '#1877F2' }}>{contactEmail}</a>.</p>
      </section>

      {/* 8. Data Deletion */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          8. Data Deletion Instructions
        </h2>
        <p>
          You can request deletion of your data at any time by:
        </p>
        <ol>
          <li>Logging into {appName} → Settings → Connected Accounts → Disconnect all accounts</li>
          <li>Emailing us at <a href={`mailto:${contactEmail}`} style={{ color: '#1877F2' }}>{contactEmail}</a> with subject: <em>&quot;Data Deletion Request&quot;</em></li>
          <li>We will process your request within <strong>30 days</strong> and confirm deletion via email</li>
        </ol>
        <p>
          Additionally, you may revoke {appName}&apos;s access to your Meta accounts directly via <a href="https://www.facebook.com/settings?tab=applications" style={{ color: '#1877F2' }}>Facebook Settings → Apps &amp; Websites</a>.
        </p>
      </section>

      {/* 9. Cookies */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          9. Cookies
        </h2>
        <p>We use essential cookies for session management and authentication. We do not use third-party advertising or tracking cookies.</p>
      </section>

      {/* 10. Children's Privacy */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          10. Children&apos;s Privacy
        </h2>
        <p>
          {appName} is not intended for users under the age of 13. We do not knowingly collect personal data from children under 13. If we become aware of such data, we will delete it immediately.
        </p>
      </section>

      {/* 11. Changes */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          11. Changes to This Policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the &quot;Last Updated&quot; date. Continued use of the Service after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      {/* 12. Contact */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', borderLeft: '4px solid #1877F2', paddingLeft: '12px', color: '#0a0a0a' }}>
          12. Contact Us
        </h2>
        <p>For any privacy-related questions, data requests, or concerns, contact us at:</p>
        <div style={{ background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '8px', padding: '16px', fontFamily: 'monospace' }}>
          <strong>{companyName}</strong><br />
          Platform: {appName}<br />
          Email: <a href={`mailto:${contactEmail}`} style={{ color: '#1877F2' }}>{contactEmail}</a><br />
          Website: <a href={appUrl} style={{ color: '#1877F2' }}>{appUrl}</a>
        </div>
      </section>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #ddd', paddingTop: '24px', marginTop: '40px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
        <p>&copy; {new Date().getFullYear()} {companyName}. All rights reserved.</p>
        <p style={{ marginTop: '4px' }}>
          This privacy policy was last updated on {lastUpdated}.
        </p>
      </div>
    </div>
  )
}
