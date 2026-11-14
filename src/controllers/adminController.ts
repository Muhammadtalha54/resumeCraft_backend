import { Request, Response } from 'express';
import { prisma } from '../config/db';

export class AdminController {
  /**
   * Get overall system dashboard metrics
   */
  static async getDashboardMetrics(req: Request, res: Response) {
    try {
      const totalUsers = await prisma.user.count();
      const totalActiveUsers = await prisma.user.count({ where: { status: 'ACTIVE' } });
      const totalBlockedUsers = await prisma.user.count({ where: { status: 'BLOCKED' } });
      
      const totalResumesGenerated = await prisma.resume.count();
      const totalAtsChecksRun = await prisma.resume.count({ where: { overallAtsScore: { gt: 0 } } });
      const totalJobsAppliedOverall = await prisma.jobApplication.count();
      const totalTemplates = await prisma.template.count();
      const openSupportTickets = await prisma.supportTicket.count({ where: { status: 'OPEN' } });

      const recentUsers = await prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          role: true,
          status: true,
          resumeCredits: true,
          atsCredits: true,
          createdAt: true
        }
      });

      const recentResumes = await prisma.resume.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } }
      });

      return res.json({
        success: true,
        metrics: {
          totalUsers,
          totalActiveUsers,
          totalBlockedUsers,
          totalResumesGenerated,
          totalAtsChecksRun,
          totalJobsAppliedOverall,
          totalActiveTemplates: totalTemplates,
          openSupportTickets
        },
        recentUsers,
        recentResumes
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Failed to fetch dashboard metrics.' });
    }
  }

  /**
   * List all registered users
   */
  static async listUsers(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          plan: true,
          resumeCredits: true,
          atsCredits: true,
          createdAt: true
        }
      });
      return res.json({ success: true, users });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Failed to load user list.' });
    }
  }

  /**
   * Block / Unblock User
   */
  static async toggleUserBlock(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User account not found.' });
      }

      if (user.role === 'ADMIN') {
        return res.status(400).json({ success: false, message: 'Administrator accounts cannot be blocked.' });
      }

      const newStatus = user.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { status: newStatus }
      });

      return res.json({
        success: true,
        message: `User ${user.email} has been successfully ${newStatus === 'BLOCKED' ? 'blocked from system access' : 'unblocked'}.`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          status: updatedUser.status
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Unable to change user status.' });
    }
  }

  /**
   * Admin: Grant or update user credits & plan
   */
  static async updateUserCredits(req: Request, res: Response) {
    try {
      const { userId, resumeCredits, atsCredits, plan, role } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'User ID is required.' });

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          resumeCredits: typeof resumeCredits === 'number' ? resumeCredits : undefined,
          atsCredits: typeof atsCredits === 'number' ? atsCredits : undefined,
          plan: plan || undefined,
          role: role || undefined
        }
      });

      return res.json({
        success: true,
        message: `Credits and plan updated for user ${updated.email}`,
        user: updated
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Failed to update user credits.' });
    }
  }
}
