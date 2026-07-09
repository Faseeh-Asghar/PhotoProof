const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@photoproof.app';
const APP_NAME = 'PhotoProof';
const APP_URL = process.env.FRONTEND_URL || 'https://photoproof.app';

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email skipped - no API key] To: ${to}, Subject: ${subject}`);
    return;
  }

  try {
    const result = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    return result;
  } catch (err) {
    console.error('Email send error:', err.message);
    // Don't throw — email failure shouldn't break the request
  }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

async function sendApprovalEmail(email, name) {
  return sendEmail({
    to: email,
    subject: `✅ Your ${APP_NAME} account is now active!`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Inter, sans-serif; background: #f4f4f5; padding: 40px 0; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 40px 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">📸 ${APP_NAME}</h1>
          </div>
          <div style="padding: 40px 32px;">
            <h2 style="color: #111827; margin: 0 0 16px; font-size: 20px;">Welcome, ${name}! 🎉</h2>
            <p style="color: #4B5563; line-height: 1.6; margin: 0 0 24px;">
              Your account has been verified and activated. You can now log in and start processing student photos.
            </p>
            <a href="${APP_URL}/login"
               style="display: inline-block; background: linear-gradient(135deg, #4F46E5, #7C3AED);
                      color: white; text-decoration: none; padding: 14px 32px;
                      border-radius: 10px; font-weight: 600; font-size: 15px;">
              Login to Dashboard →
            </a>
            <p style="color: #9CA3AF; font-size: 13px; margin: 32px 0 0;">
              If you have any questions, reply to this email or contact admin.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

async function sendWelcomeEmail(email, name) {
  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME} — Registration Received`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Inter, sans-serif; background: #f4f4f5; padding: 40px 0; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <div style="background: linear-gradient(135deg, #0A0F1E, #1E293B); padding: 40px 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">📸 ${APP_NAME}</h1>
          </div>
          <div style="padding: 40px 32px;">
            <h2 style="color: #111827; margin: 0 0 16px; font-size: 20px;">Registration received, ${name}</h2>
            <p style="color: #4B5563; line-height: 1.6; margin: 0 0 16px;">
              Thank you for signing up to ${APP_NAME}. Your registration is under review.
            </p>
            <div style="background: #FEF9C3; border: 1px solid #FDE047; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #713F12; margin: 0; font-size: 14px; font-weight: 600;">⏳ Next Steps:</p>
              <ol style="color: #713F12; margin: 8px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                <li>Send your payment (JazzCash / EasyPaisa) to the number provided during registration</li>
                <li>Include your registered email in the payment note</li>
                <li>Wait for admin confirmation (usually within 24 hours)</li>
                <li>You'll receive an activation email once approved</li>
              </ol>
            </div>
            <p style="color: #9CA3AF; font-size: 13px; margin: 0;">
              Questions? Contact the admin directly.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

module.exports = { sendApprovalEmail, sendWelcomeEmail };
