const path = require('path');
const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic env helper to reload .env changes without server restart
function getEnv(key, fallback = '') {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath));
      if (parsed[key] !== undefined) return parsed[key];
    }
  } catch (err) {}
  return process.env[key] || fallback;
}

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static frontend assets & HTML pages with automatic clean URLs (.html extension resolution)
app.use(express.static(path.join(__dirname), {
  extensions: ['html', 'htm']
}));

// Clean URL routing fallback for pages (e.g. /contact, /about, /work, /services)
app.get('/:page', (req, res, next) => {
  const page = req.params.page;
  const filePath = path.join(__dirname, `${page}.html`);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const gmailPass = getEnv('GMAIL_APP_PASSWORD');
  const mailerConfigured = Boolean(gmailPass && gmailPass !== 'your_16_character_app_password');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mailerConfigured
  });
});

// FormSubmit fallback dispatcher
function sendViaFormSubmit(data) {
  return new Promise((resolve, reject) => {
    const recipient = getEnv('NOTIFICATION_EMAIL', 'info.veritract@gmail.com');
    const postData = JSON.stringify({
      _subject: `New Inquiry: ${data.fullName} - ${data.company}`,
      _template: 'table',
      _captcha: 'false',
      'Contact Name': data.fullName,
      'Email': data.workEmail,
      'Company': data.company,
      'Website': data.website,
      'Role': data.role,
      'Company Size': data.size,
      'Budget Range': data.budget,
      'Project Details': data.details
    });

    const options = {
      hostname: 'formsubmit.co',
      path: `/ajax/${encodeURIComponent(recipient)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://veritract.site',
        'Referer': 'https://veritract.ai/contact.html',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve({ success: false, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// Contact form API endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      workEmail,
      companyName,
      companyWebsite,
      userRole,
      companySize,
      budgetRange,
      projectDetails
    } = req.body;

    // Validate essential fields
    if (!firstName || !workEmail || !projectDetails) {
      return res.status(400).json({
        success: false,
        error: 'Please fill out all required fields (First Name, Work Email, and Project Details).'
      });
    }

    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || 'Website Visitor';
    const company = companyName ? companyName.trim() : 'Not provided';
    const website = companyWebsite ? companyWebsite.trim() : 'Not provided';
    const role = userRole || 'Not specified';
    const size = companySize || 'Not specified';
    const budget = budgetRange || 'Not specified';
    const details = projectDetails.trim();

    console.log(`[Form Submission] From: ${fullName} <${workEmail}> | Company: ${company} | Budget: ${budget}`);

    const gmailUser = getEnv('GMAIL_USER', 'info.veritract@gmail.com');
    const gmailAppPassword = getEnv('GMAIL_APP_PASSWORD');
    const recipientEmail = getEnv('NOTIFICATION_EMAIL', 'info.veritract@gmail.com');

    const isGmailConfigured = Boolean(
      gmailAppPassword &&
      gmailAppPassword.trim() !== '' &&
      gmailAppPassword !== 'your_16_character_app_password'
    );

    // Path A: Gmail SMTP with App Password
    if (isGmailConfigured) {
      try {
        console.log(`Attempting delivery via Gmail SMTP for ${gmailUser}...`);
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: gmailUser,
            pass: gmailAppPassword.replace(/\s+/g, '')
          }
        });

        const emailSubject = `🚀 New Inquiry: ${fullName} - ${company !== 'Not provided' ? company : 'VeriTract Contact'}`;

        const textContent = `
NEW INQUIRY FROM VERITRACT WEBSITE
----------------------------------
Contact Name:   ${fullName}
Email:          ${workEmail}
Company:        ${company}
Website:        ${website}
Role:           ${role}
Company Size:   ${size}
Budget Range:   ${budget}

PROJECT DETAILS:
${details}

Submitted at: ${new Date().toLocaleString()}
Reply directly to this email to respond to ${workEmail}.
`;

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0b0d; color: #f3f4f6; margin: 0; padding: 24px; }
    .card { max-width: 620px; margin: 0 auto; background-color: #121216; border: 1px solid rgba(255, 102, 0, 0.35); border-radius: 12px; overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #18181d 0%, #0d0d10 100%); padding: 28px; border-bottom: 2px solid #FF6600; text-align: left; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header span.brand { color: #FF6600; }
    .header p { margin: 6px 0 0 0; color: #9ca3af; font-size: 13px; }
    .body { padding: 28px; }
    .badge { display: inline-block; padding: 6px 12px; background: rgba(255, 102, 0, 0.15); color: #FF6600; border-radius: 999px; font-size: 12px; font-weight: 600; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; padding: 10px 12px; color: #9ca3af; font-size: 13px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.08); width: 35%; }
    td { padding: 10px 12px; color: #f3f4f6; font-size: 14px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.08); }
    td a { color: #FF6600; text-decoration: none; }
    .message-block { background: #18181e; border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3px solid #FF6600; border-radius: 6px; padding: 16px; margin-top: 10px; font-size: 14px; line-height: 1.6; color: #e5e7eb; white-space: pre-wrap; }
    .footer { padding: 18px 28px; background-color: #0d0d10; border-top: 1px solid rgba(255, 255, 255, 0.08); text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1><span class="brand">VERITRACT</span> // New Client Inquiry</h1>
      <p>Received through the website contact form</p>
    </div>
    <div class="body">
      <div class="badge">Budget: ${budget}</div>
      <table>
        <tr>
          <th>Full Name</th>
          <td>${fullName}</td>
        </tr>
        <tr>
          <th>Email Address</th>
          <td><a href="mailto:${workEmail}">${workEmail}</a></td>
        </tr>
        <tr>
          <th>Company</th>
          <td>${company}</td>
        </tr>
        <tr>
          <th>Website</th>
          <td>${website !== 'Not provided' ? `<a href="${website}" target="_blank">${website}</a>` : 'Not provided'}</td>
        </tr>
        <tr>
          <th>Role</th>
          <td>${role}</td>
        </tr>
        <tr>
          <th>Company Size</th>
          <td>${size}</td>
        </tr>
        <tr>
          <th>Budget</th>
          <td><strong>${budget}</strong></td>
        </tr>
      </table>

      <div style="font-size: 13px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Project Details / Message</div>
      <div class="message-block">${details}</div>
    </div>
    <div class="footer">
      Hit "Reply" in your email client to answer directly to ${workEmail}.
    </div>
  </div>
</body>
</html>
`;

        const mailOptions = {
          from: `"${fullName} (via VeriTract)" <${gmailUser}>`,
          to: recipientEmail,
          replyTo: workEmail,
          subject: emailSubject,
          text: textContent,
          html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [EMAIL SENT VIA GMAIL] Message ID: ${info.messageId}`);
        return res.status(200).json({
          success: true,
          message: 'Thank you! Your inquiry has been sent to our team. We reply within 1 business day.'
        });
      } catch (smtpErr) {
        console.warn('⚠️ Gmail SMTP failed, falling back to FormSubmit delivery...', smtpErr.message);
      }
    }

    // Path B: Instant FormSubmit delivery (Zero setup required)
    console.log(`Dispatching inquiry via FormSubmit to ${recipientEmail}...`);
    const fsResult = await sendViaFormSubmit({
      fullName,
      workEmail,
      company,
      website,
      role,
      size,
      budget,
      details
    });

    console.log('[FormSubmit Result]', fsResult);

    if (fsResult.success === 'true' || fsResult.success === true) {
      return res.status(200).json({
        success: true,
        message: 'Thank you! Your inquiry has been sent to our team. We reply within 1 business day.'
      });
    }

    if (fsResult.message && fsResult.message.includes('Activation')) {
      return res.status(200).json({
        success: true,
        needsActivation: true,
        message: 'Inquiry received! Check info.veritract@gmail.com and click the 1-time "Activate Form" link to enable automatic inbox delivery.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Thank you! Your inquiry has been received. We reply within 1 business day.'
    });

  } catch (error) {
    console.error('❌ [ERROR IN CONTACT HANDLER]:', error);
    return res.status(500).json({
      success: false,
      error: 'Unable to deliver message at this moment. Please reach out to info.veritract@gmail.com directly.'
    });
  }
});

// Custom 404 handler
app.use((req, res) => {
  const notFoundPath = path.join(__dirname, '404.html');
  if (fs.existsSync(notFoundPath)) {
    return res.status(404).sendFile(notFoundPath);
  }
  res.status(404).send('Page not found');
});

// Start Express server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 VeriTract server listening on port ${PORT}`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`📧 Contact Endpoint: POST http://localhost:${PORT}/api/contact`);
  console.log(`===============================================`);
});
