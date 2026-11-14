import nodemailer from 'nodemailer';

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function getSender() {
  return (
    process.env.SMTP_FROM ||
    `"${process.env.APP_NAME || 'ResumeCraft AI'}" <${process.env.SMTP_USER || 'no-reply@resumecraft.com'}>`
  );
}

export class EmailService {
  /**
   * Send OTP Verification Email (Registration)
   */
  static async sendOtpEmail(toEmail: string, otpCode: string, name: string) {
    try {
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      // If SMTP credentials not provided or using mock, log in console for development
      if (!user || !pass || user.includes('mock') || pass.includes('mock')) {
        console.log(`[EMAIL DEV MOCK] Verification Code for ${toEmail} (${name}): ${otpCode}`);
        return true;
      }

      const transporter = getTransporter();
      await transporter.sendMail({
        from: getSender(),
        to: toEmail,
        subject: 'ResumeCraft AI - Verification Code',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Welcome to ResumeCraft AI, ${name}!</h2>
            <p style="color: #475569; font-size: 14px; line-height: 22px;">Please use the verification code below to verify your account:</p>
            <div style="background: #f1f5f9; padding: 18px; text-align: center; border-radius: 8px; margin: 24px 0;">
              <span style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #174D3A;">${otpCode}</span>
            </div>
            <p style="color: #64748b; font-size: 13px;">This code expires in 15 minutes. If you did not request this, you can safely ignore this email.</p>
          </div>
        `
      });
      console.log(`[EMAIL SENT] Verification code successfully dispatched to ${toEmail}`);
      return true;
    } catch (err) {
      console.error('[EMAIL ERROR] Failed to send OTP verification email:', err);
      return false;
    }
  }

  /**
   * Send Password Reset Link & OTP Email
   */
  static async sendPasswordResetEmail(toEmail: string, resetLink: string, otpCode: string, name: string) {
    try {
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;

      // If SMTP credentials not provided or using mock, log in console for development
      if (!user || !pass || user.includes('mock') || pass.includes('mock')) {
        console.log(`[EMAIL DEV MOCK] Reset Password for ${toEmail} (${name}):`);
        console.log(`  Reset Link: ${resetLink}`);
        console.log(`  OTP Code:   ${otpCode}`);
        return true;
      }

      const transporter = getTransporter();
      await transporter.sendMail({
        from: getSender(),
        to: toEmail,
        subject: 'ResumeCraft AI - Password Reset Request',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Reset Your Password</h2>
            <p style="color: #475569; font-size: 14px; line-height: 22px;">Hello ${name},</p>
            <p style="color: #475569; font-size: 14px; line-height: 22px;">We received a request to reset your password. Click the secure link below to choose a new password on the web:</p>
            
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetLink}" style="background-color: #174D3A; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                Reset Password
              </a>
            </div>

            <p style="color: #475569; font-size: 13px; margin-top: 20px;">Or enter this 6-digit OTP code in your mobile application:</p>
            <div style="background: #f8fafc; padding: 12px; text-align: center; border-radius: 6px; margin: 12px 0;">
              <span style="font-size: 24px; font-weight: 700; letter-spacing: 5px; color: #174D3A;">${otpCode}</span>
            </div>

            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; line-height: 18px;">
              This link and code will expire in 30 minutes. If you did not initiate this request, your account is secure and you may safely ignore this email.
            </p>
          </div>
        `
      });
      console.log(`[EMAIL SENT] Password reset email successfully dispatched to ${toEmail}`);
      return true;
    } catch (err) {
      console.error('[EMAIL ERROR] Failed to send password reset email:', err);
      return false;
    }
  }
}
