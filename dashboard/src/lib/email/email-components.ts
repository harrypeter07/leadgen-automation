// dashboard/src/lib/email/email-components.ts

export interface EmailVariables {
  firstName?: string;
  company?: string;
  email?: string;
  ctaUrl?: string;
  ctaText?: string;
  amount?: string;
  invoiceId?: string;
  alertDetails?: string;
  supportMessage?: string;
  token?: string;
  [key: string]: any;
}

/**
 * Bulletproof table-style button for Outlook and mobile compatibility.
 */
export function renderButton(text: string, url: string): string {
  return `
    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 25px 0;">
      <tr>
        <td align="left" bgcolor="#E3B859" style="border-radius: 6px;">
          <a href="${url}" target="_blank" style="background-color: #E3B859; border: 1px solid #E3B859; border-radius: 6px; color: #141416; display: inline-block; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; line-height: 44px; text-align: center; text-decoration: none; width: 180px; -webkit-text-size-adjust: none; mso-hide: all;">${text}</a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Base email layout wrapper following responsive deliverability best practices.
 */
export function wrapInLayout(title: string, bodyContent: string, isMarketing: boolean = false): string {
  const unsubscribeLink = isMarketing 
    ? `<p style="margin: 15px 0 0 0; font-size: 11px; color: #999999;">No longer want emails? <a href="{{unsubscribeUrl}}" style="color: #E3B859; text-decoration: underline;">Unsubscribe here</a>.</p>` 
    : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>${title}</title>
      <style>
        :root {
          color-scheme: light dark;
          supported-color-schemes: light dark;
        }
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100% !important;
            padding: 15px !important;
          }
          .body-text {
            font-size: 15px !important;
            line-height: 1.5 !important;
          }
        }
        @media (prefers-color-scheme: dark) {
          body {
            background-color: #121212 !important;
            color: #e0e0e0 !important;
          }
          .email-wrapper {
            background-color: #121212 !important;
          }
          .email-card {
            background-color: #1e1e1e !important;
            border-color: #333333 !important;
          }
          .body-text, .header-title {
            color: #e0e0e0 !important;
          }
          .bg-light {
            background-color: #262626 !important;
          }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; width: 100% !important; background-color: #f7f7f7; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-wrapper" style="background-color: #f7f7f7; padding: 20px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; width: 100%;">
              <!-- Brand Header -->
              <tr>
                <td style="padding: 10px 0 20px 0; text-align: left;">
                  <span style="font-size: 18px; font-weight: bold; color: #1a1a1a; letter-spacing: 1px; text-transform: uppercase;">LeadGen Automation</span>
                </td>
              </tr>
              <!-- Content Body -->
              <tr>
                <td class="email-card" bgcolor="#ffffff" style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 8px; text-align: left;">
                  ${bodyContent}
                </td>
              </tr>
              <!-- Footer Section -->
              <tr>
                <td style="padding: 25px 30px; text-align: left; font-size: 12px; color: #888888; line-height: 1.5;">
                  <p style="margin: 0; font-weight: bold;">LeadGen Automation</p>
                  <p style="margin: 5px 0 0 0;">Questions? Just reply directly to this email to contact support.</p>
                  ${unsubscribeLink}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Replace generic variables inside string templates.
 */
export function interpolateVariables(template: string, vars: EmailVariables): string {
  let output = template;
  
  // Resolve greeting fallbacks
  const greetingName = vars.firstName ? vars.firstName : 'there';
  output = output.replace(/\{\{\s*greetingName\s*\}\}/g, greetingName);
  
  // Resolve other standard parameters
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    output = output.replace(regex, String(val || ''));
  }
  
  // Clean up any remaining double brackets
  output = output.replace(/\{\{\s*.*?\s*\}\}/g, '');
  return output;
}

/**
 * Master Template Engine that compiles 9 core transaction type layouts.
 */
export function generateTemplate(type: string, bodyContent: string, vars: EmailVariables): { subject: string; html: string } {
  let subject = 'Operational Notification';
  let innerBody = '';
  let isMarketing = false;

  const headerStyle = `margin: 0 0 20px 0; font-size: 22px; font-weight: bold; color: #1a1a1a;`;
  const textStyle = `margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #444444;`;

  switch (type.toLowerCase()) {
    case 'welcome':
      subject = 'Welcome to LeadGen Automation';
      innerBody = `
        <h2 class="header-title" style="${headerStyle}">Welcome onboard!</h2>
        <p class="body-text" style="${textStyle}">Hi {{greetingName}},</p>
        <p class="body-text" style="${textStyle}">Your workspace is ready. We have configured the scraping and outreach dashboard for you so you can start launching lead extraction pipelines right away.</p>
        <p class="body-text" style="${textStyle}">Let's sign in to explore your active modules:</p>
        ${renderButton(vars.ctaText || 'Get Started', vars.ctaUrl || '#')}
        <p class="body-text" style="${textStyle}">If you have any questions along the way, simply reply to this message and our support team will help you out.</p>
      `;
      break;

    case 'passwordreset':
      subject = 'Reset your password';
      innerBody = `
        <h2 class="header-title" style="${headerStyle}">Password Reset Requested</h2>
        <p class="body-text" style="${textStyle}">Hi {{greetingName}},</p>
        <p class="body-text" style="${textStyle}">We received a request to change the password associated with your account.</p>
        <p class="body-text" style="${textStyle}">Click the link below to set a new password. This link is valid for 60 minutes:</p>
        ${renderButton('Reset Password', vars.ctaUrl || '#')}
        <p class="body-text" style="${textStyle}">If you did not request this change, you can safely ignore this email.</p>
      `;
      break;

    case 'verification':
      subject = 'Verify your email address';
      innerBody = `
        <h2 class="header-title" style="${headerStyle}">Verify Your Email</h2>
        <p class="body-text" style="${textStyle}">Hi {{greetingName}},</p>
        <p class="body-text" style="${textStyle}">Thank you for joining us. Please confirm your email address to activate your dashboard account.</p>
        ${renderButton('Verify Email', vars.ctaUrl || '#')}
        <p class="body-text" style="${textStyle}">Confirming your email ensures you receive notifications about successful scraper runs.</p>
      `;
      break;

    case 'invoice':
      subject = `Invoice ${vars.invoiceId || ''} - LeadGen Automation`;
      innerBody = `
        <h2 class="header-title" style="${headerStyle}">Invoice details</h2>
        <p class="body-text" style="${textStyle}">Hi {{greetingName}},</p>
        <p class="body-text" style="${textStyle}">Your invoice is now available for download. A charge of <strong>{{amount}}</strong> has been processed successfully.</p>
        <table border="0" cellpadding="10" cellspacing="0" class="bg-light" style="width:100%; background-color:#f9f9f9; border-radius:6px; margin: 15px 0;">
          <tr>
            <td style="font-size:13px; color:#555;"><strong>Invoice ID:</strong> {{invoiceId}}</td>
            <td style="font-size:13px; color:#555; text-align:right;"><strong>Amount Paid:</strong> {{amount}}</td>
          </tr>
        </table>
        ${renderButton('View Invoice', vars.ctaUrl || '#')}
        <p class="body-text" style="${textStyle}">Thank you for your business!</p>
      `;
      break;

    case 'notification':
      subject = vars.subject || 'New Notification';
      innerBody = `
        <h2 class="header-title" style="${headerStyle}">Operational Update</h2>
        <p class="body-text" style="${textStyle}">Hi {{greetingName}},</p>
        <p class="body-text" style="${textStyle}">${bodyContent}</p>
        ${vars.ctaUrl ? renderButton(vars.ctaText || 'View Details', vars.ctaUrl) : ''}
      `;
      break;

    case 'systemalert':
      subject = 'System Alert Notification';
      innerBody = `
        <h2 class="header-title" style="${headerStyle} color: #d9534f;">System Alert Triggered</h2>
        <p class="body-text" style="${textStyle}">Attention Ops Team,</p>
        <p class="body-text" style="${textStyle}">A system event requiring review has occurred on your scraper instance.</p>
        <table border="0" cellpadding="15" cellspacing="0" style="width:100%; border:1px solid #d9534f; background-color:#fdf7f7; border-radius:6px; margin: 15px 0;">
          <tr>
            <td style="font-family: monospace; font-size:13px; color:#c9302c;">{{alertDetails}}</td>
          </tr>
        </table>
        ${vars.ctaUrl ? renderButton('Inspect Logs', vars.ctaUrl) : ''}
      `;
      break;

    case 'supportreply':
      subject = 'Re: Support Request Update';
      innerBody = `
        <h2 class="header-title" style="${headerStyle}">Support Ticket Response</h2>
        <p class="body-text" style="${textStyle}">Hi {{greetingName}},</p>
        <p class="body-text" style="${textStyle}">Our team has posted an update regarding your ticket:</p>
        <blockquote style="border-left: 3px solid #E3B859; padding-left: 15px; margin: 15px 0; color: #555; font-style: italic;">
          {{supportMessage}}
        </blockquote>
        ${vars.ctaUrl ? renderButton('Reply to Ticket', vars.ctaUrl) : ''}
      `;
      break;

    case 'magiclink':
      subject = 'Sign in to your account';
      innerBody = `
        <h2 class="header-title" style="${headerStyle}">Secure Magic Sign-In</h2>
        <p class="body-text" style="${textStyle}">Hi {{greetingName}},</p>
        <p class="body-text" style="${textStyle}">Click the link below to securely access your LeadGen Automation dashboard. This link will automatically log you in without requiring a password:</p>
        ${renderButton('Sign In Now', vars.ctaUrl || '#')}
        <p class="body-text" style="${textStyle}">This link will expire in 15 minutes. If you did not request this login link, please disregard this email.</p>
      `;
      break;

    case 'outreach':
    default:
      subject = vars.subject || 'Website Outreach Inquiry';
      isMarketing = true; // includes unsubscribe footer links
      innerBody = `
        <div class="body-text" style="${textStyle}">
          ${bodyContent.replace(/\n/g, '<br />')}
        </div>
      `;
      break;
  }

  // Bind parameters
  const interpolated = interpolateVariables(innerBody, vars);
  const html = wrapInLayout(subject, interpolated, isMarketing);

  return { subject, html };
}
