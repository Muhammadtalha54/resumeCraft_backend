import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../config/db';

export class SupportController {
  /**
   * User: Submit a customer support ticket
   */
  static async createTicket(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { subject, message, priority = 'MEDIUM' } = req.body;

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!subject || !message) {
        return res.status(400).json({ error: 'Subject and message are required.' });
      }

      const ticket = await prisma.supportTicket.create({
        data: {
          userId,
          subject,
          message,
          priority
        }
      });

      return res.status(201).json({ message: 'Support ticket submitted successfully', ticket });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to create ticket' });
    }
  }

  /**
   * User: Get user's submitted support tickets
   */
  static async getUserTickets(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const tickets = await prisma.supportTicket.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
      return res.json({ tickets });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Admin: List all customer support tickets with user email & info
   */
  static async getAllTicketsAdmin(req: AuthRequest, res: Response) {
    try {
      const tickets = await prisma.supportTicket.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, plan: true, status: true }
          }
        }
      });
      return res.json({ tickets });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Admin: Update support ticket status (OPEN | IN_PROGRESS | RESOLVED)
   */
  static async updateTicketStatus(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value.' });
      }

      const updated = await prisma.supportTicket.update({
        where: { id },
        data: { status }
      });

      return res.json({ message: 'Ticket status updated', ticket: updated });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}
