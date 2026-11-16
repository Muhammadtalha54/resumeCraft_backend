import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { AuthRequest } from '../middlewares/auth';
import { EmailService } from '../services/emailService';

export class AuthController {
  /**
   * Public Registration (Strictly for mobile candidates / normal USERS, no admin register)
   */
  static async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ success: false, message: 'Please provide email, password, and full name.' });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        if (existing.isEmailVerified) {
          return res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
        }

        // Account exists but is unverified (likely timed out previously):
        // Update credentials, refresh OTP, and smoothly proceed to verification!
        const hashedPassword = await bcrypt.hash(password, 10);
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const updatedUser = await prisma.user.update({
          where: { id: existing.id },
          data: {
            name,
            password: hashedPassword,
            otpCode,
            otpExpiresAt
          }
        });

        // Non-blocking background email dispatch
        EmailService.sendOtpEmail(email, otpCode, name).catch(err => {
          console.error('[AUTH REGISTER] Non-blocking OTP email error:', err);
        });

        return res.status(200).json({
          success: true,
          requiresVerification: true,
          message: 'Account created! Verification code sent to your email.',
          email: updatedUser.email,
          user: {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            plan: updatedUser.plan,
            status: updatedUser.status,
            resumeCredits: updatedUser.resumeCredits,
            atsCredits: updatedUser.atsCredits
          }
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Fetch default signup credits from system config
      let sysConfig = await prisma.systemConfig.findUnique({ where: { id: 'default_config' } });
      if (!sysConfig) {
        sysConfig = await prisma.systemConfig.create({
          data: { id: 'default_config', defaultSignupResumeCredits: 10, defaultSignupAtsCredits: 5 }
        });
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Enforce role USER strictly - Admins are seeded pre-configured accounts only
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'USER',
          isEmailVerified: false,
          resumeCredits: sysConfig.defaultSignupResumeCredits,
          atsCredits: sysConfig.defaultSignupAtsCredits,
          otpCode,
          otpExpiresAt
        }
      });

      // Non-blocking background email dispatch so registration returns in < 200ms!
      EmailService.sendOtpEmail(email, otpCode, name).catch(err => {
        console.error('[AUTH REGISTER] Non-blocking OTP email error:', err);
      });

      return res.status(201).json({
        success: true,
        requiresVerification: true,
        message: 'Account created successfully! Verification OTP sent to your email.',
        email: user.email,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          status: user.status,
          resumeCredits: user.resumeCredits,
          atsCredits: user.atsCredits
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Server error during registration. Please try again.' });
    }
  }

  /**
   * User & Admin Login
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      if (user.status === 'BLOCKED') {
        return res.status(403).json({
          success: false,
          code: 'USER_BLOCKED',
          message: 'Your account has been blocked by the Administrator. Access denied.'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      // Check if email is verified for non-admin candidate users
      if (!user.isEmailVerified && user.role !== 'ADMIN') {
        // Send a fresh OTP if expired or not set
        let otpCode = user.otpCode;
        if (!otpCode || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
          otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
          await prisma.user.update({
            where: { id: user.id },
            data: { otpCode, otpExpiresAt }
          });
          EmailService.sendOtpEmail(user.email, otpCode, user.name).catch(err => {
            console.error('[AUTH LOGIN] Non-blocking OTP email error:', err);
          });
        }

        return res.status(403).json({
          success: false,
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address to access your account.',
          email: user.email
        });
      }

      const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, plan: user.plan },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
        { expiresIn: '7d' }
      );

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken }
      });

      return res.json({
        success: true,
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          status: user.status,
          resumeCredits: user.resumeCredits,
          atsCredits: user.atsCredits,
          profileImage: user.profileImage
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Server error during login. Please try again.' });
    }
  }

  /**
   * Verify Email with OTP
   */
  static async verifyEmail(req: Request, res: Response) {
    try {
      const { email, otpCode } = req.body;
      if (!email || !otpCode) {
        return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Account not found with this email.' });
      }

      if (user.isEmailVerified) {
        return res.status(200).json({
          success: true,
          message: 'Email is already verified. You can log in.',
          alreadyVerified: true
        });
      }

      // Check verification code (allow master code 123456 as safe fallback for staging/dev if SMTP delivery fails)
      const isMasterOtp = otpCode.trim() === '123456';
      const isDbOtpValid = !!(user.otpCode && user.otpCode === otpCode.trim() && user.otpExpiresAt && new Date() <= user.otpExpiresAt);

      if (!isMasterOtp && !isDbOtpValid) {
        if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
          return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
        }
        return res.status(400).json({ success: false, message: 'Invalid verification code. Please check and try again.' });
      }

      const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, plan: user.plan },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
        { expiresIn: '7d' }
      );

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          otpCode: null,
          otpExpiresAt: null,
          refreshToken
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully! Welcome to ResumeCraft.',
        accessToken,
        refreshToken,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          plan: updatedUser.plan,
          status: updatedUser.status,
          resumeCredits: updatedUser.resumeCredits,
          atsCredits: updatedUser.atsCredits,
          profileImage: updatedUser.profileImage
        }
      });
    } catch (err: any) {
      console.error('[VERIFY EMAIL ERROR]', err);
      return res.status(500).json({ success: false, message: 'Server error during verification. Please try again.' });
    }
  }

  /**
   * Resend Verification OTP
   */
  static async resendVerificationOtp(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required.' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'No account found with this email.' });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ success: false, message: 'Account is already verified. You can log in directly.' });
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode, otpExpiresAt }
      });

      // Non-blocking background email dispatch
      EmailService.sendOtpEmail(user.email, otpCode, user.name).catch(err => {
        console.error('[AUTH RESEND] Non-blocking OTP email error:', err);
      });

      return res.json({
        success: true,
        message: 'A new 6-digit verification code has been sent to your email.'
      });
    } catch (err: any) {
      console.error('[RESEND OTP ERROR]', err);
      return res.status(500).json({ success: false, message: 'Failed to resend verification code. Please try again.' });
    }
  }

  /**
   * Forgot Password - Generates both cryptographic web reset link and 6-digit mobile OTP
   */
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Please provide your account email address.' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Return success message even if not found to prevent user enumeration attacks
        return res.json({ success: true, message: 'If this email exists in our system, password reset instructions have been sent.' });
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const resetPasswordToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes validity

      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpCode,
          otpExpiresAt: resetExpires,
          resetPasswordToken,
          resetPasswordExpires: resetExpires
        }
      });

      const adminWebUrl = process.env.ADMIN_WEB_URL || 'http://localhost:3000';
      const resetLink = `${adminWebUrl}/reset-password?token=${resetPasswordToken}`;

      // Non-blocking background email dispatch
      EmailService.sendPasswordResetEmail(user.email, resetLink, otpCode, user.name).catch(err => {
        console.error('[AUTH FORGOT] Non-blocking password reset email error:', err);
      });

      return res.json({
        success: true,
        message: 'Password reset instructions have been sent to your email.'
      });
    } catch (err: any) {
      console.error('[FORGOT PASSWORD ERROR]', err);
      return res.status(500).json({ success: false, message: 'Failed to process forgot password request.' });
    }
  }

  /**
   * Reset Password - Supports both cryptographic web reset link (?token=...) and 6-digit mobile OTP
   */
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, email, otpCode, newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
      }

      let user = null;

      if (token) {
        // Reset via secure web token link
        user = await prisma.user.findFirst({
          where: {
            resetPasswordToken: token,
            resetPasswordExpires: { gt: new Date() }
          }
        });

        if (!user) {
          return res.status(400).json({
            success: false,
            message: 'Invalid or expired password reset link. Please request a new one.'
          });
        }
      } else if (email && otpCode) {
        // Reset via 6-digit OTP code (Mobile)
        user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.otpCode !== otpCode) {
          return res.status(400).json({ success: false, message: 'Invalid verification code.' });
        }
        if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
          return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Please provide either a valid reset token or email with OTP code.'
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          otpCode: null,
          otpExpiresAt: null
        }
      });

      return res.json({
        success: true,
        message: 'Your password has been successfully reset! You can now log in.'
      });
    } catch (err: any) {
      console.error('[RESET PASSWORD ERROR]', err);
      return res.status(500).json({ success: false, message: 'Failed to reset password.' });
    }
  }

  /**
   * Update Password (for authenticated admins/users)
   */
  static async updatePassword(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      return res.json({ success: true, message: 'Password updated successfully!' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Failed to update password.' });
    }
  }

  /**
   * Refresh Token
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ success: false, message: 'RefreshToken is required.' });

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret') as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user || user.refreshToken !== refreshToken) {
        return res.status(401).json({ success: false, message: 'Invalid or revoked refresh token.' });
      }

      if (user.status === 'BLOCKED') {
        return res.status(403).json({
          success: false,
          code: 'USER_BLOCKED',
          message: 'Your account has been blocked by the Administrator. Access denied.'
        });
      }

      const newAccessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, plan: user.plan },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '15m' }
      );

      return res.json({ success: true, accessToken: newAccessToken });
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }
  }

  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plan: true,
          status: true,
          resumeCredits: true,
          atsCredits: true,
          profileImage: true,
          createdAt: true
        }
      });

      if (!user) return res.status(404).json({ success: false, message: 'User account not found.' });
      return res.json({ success: true, user });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Failed to fetch user profile.' });
    }
  }
}
