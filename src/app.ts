import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { prisma } from './config/db';
import { AuthController } from './controllers/authController';
import { ResumeController } from './controllers/resumeController';
import { TemplateController } from './controllers/templateController';
import { JobController } from './controllers/jobController';
import { AdminController } from './controllers/adminController';
import { PaymentController } from './controllers/paymentController';
import { SupportController } from './controllers/supportController';
import { authenticate, requireAdmin } from './middlewares/auth';
import { initCronJobs } from './services/cronService';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// Health Check Endpoints (for Render and uptime monitoring)
app.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    service: 'ResumeCraft Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    service: 'ResumeCraft Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Initialize Background Cron Jobs (7-day history auto-purge)
initCronJobs();

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/verify-email', AuthController.verifyEmail);
app.post('/api/auth/resend-verification-otp', AuthController.resendVerificationOtp);
app.post('/api/auth/login', AuthController.login);
app.post('/api/auth/refresh-token', AuthController.refreshToken);
app.post('/api/auth/forgot-password', AuthController.forgotPassword);
app.post('/api/auth/reset-password', AuthController.resetPassword);
app.patch('/api/auth/update-password', authenticate, AuthController.updatePassword);
app.get('/api/auth/profile', authenticate, AuthController.getProfile);

// ==================== RESUME ROUTES ====================
app.post('/api/resumes/upload', authenticate, upload.single('resume'), ResumeController.uploadAndAnalyze);
app.post('/api/resumes/create-from-scratch', authenticate, ResumeController.createFromScratch);
app.post('/api/resumes/tailor', authenticate, ResumeController.tailorResume);
app.put('/api/resumes/:id/content', authenticate, ResumeController.updateContent);
app.get('/api/resumes/export/:id', authenticate, ResumeController.exportPDF);
app.get('/api/resumes/history', authenticate, ResumeController.getHistory);

// ==================== TEMPLATES ROUTES ====================
app.get('/api/templates', TemplateController.getActiveTemplates);
app.get('/api/admin/templates', authenticate, requireAdmin, TemplateController.getAllTemplatesAdmin);
app.post('/api/admin/templates', authenticate, requireAdmin, TemplateController.createTemplate);
app.patch('/api/admin/templates/:id/toggle', authenticate, requireAdmin, TemplateController.toggleTemplateStatus);

// ==================== JOB SEARCH & SCRAPING ROUTES ====================
app.get('/api/jobs/search', authenticate, JobController.searchJobs);
app.post('/api/jobs/apply', authenticate, JobController.trackJobApplication);

// ==================== SUPPORT TICKET ROUTES ====================
app.post('/api/support/tickets', authenticate, SupportController.createTicket);
app.get('/api/support/tickets', authenticate, SupportController.getUserTickets);
app.get('/api/admin/support/tickets', authenticate, requireAdmin, SupportController.getAllTicketsAdmin);
app.patch('/api/admin/support/tickets/:id/status', authenticate, requireAdmin, SupportController.updateTicketStatus);

// ==================== PAYMENT ROUTES ====================
app.get('/api/payments/plans', PaymentController.getPlans);
app.post('/api/payments/create-payment-intent', authenticate, PaymentController.createPaymentIntent);
app.post('/api/payments/confirm-payment', authenticate, PaymentController.confirmPayment);
app.post('/api/payments/checkout', authenticate, PaymentController.createCheckoutSession);
app.post('/api/payments/webhook', PaymentController.handleWebhook);

// ==================== ADMIN ROUTES ====================
app.get('/api/admin/dashboard', authenticate, requireAdmin, AdminController.getDashboardMetrics);
app.get('/api/admin/users', authenticate, requireAdmin, AdminController.listUsers);
app.patch('/api/admin/users/:id/block', authenticate, requireAdmin, AdminController.toggleUserBlock);
app.patch('/api/admin/users/credits', authenticate, requireAdmin, AdminController.updateUserCredits);

// ==================== GLOBAL USER-FRIENDLY ERROR HANDLER ====================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[SERVER ERROR]', err);
  const userMessage = err.userMessage || err.message || 'An unexpected error occurred. Please try again.';
  return res.status(err.status || 500).json({
    success: false,
    message: userMessage
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 ResumeCraft Backend running on http://localhost:${PORT}`);
});
