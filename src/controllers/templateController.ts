import { Request, Response } from 'express';
import { prisma } from '../config/db';

export class TemplateController {
  /**
   * Get all active templates (Public / Mobile App endpoint)
   */
  static async getActiveTemplates(req: Request, res: Response) {
    try {
      const templates = await prisma.template.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' }
      });
      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;

      const formatted = templates.map((t) => ({
        ...t,
        thumbnailUrl: t.thumbnailUrl && t.thumbnailUrl.startsWith('/')
          ? `${baseUrl}${t.thumbnailUrl}`
          : t.thumbnailUrl
      }));

      return res.json({ templates: formatted });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to fetch templates' });
    }
  }

  /**
   * Admin: Get all templates (including inactive/drafts)
   */
  static async getAllTemplatesAdmin(req: Request, res: Response) {
    try {
      const templates = await prisma.template.findMany({
        orderBy: { createdAt: 'desc' }
      });
      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;

      const formatted = templates.map((t) => ({
        ...t,
        thumbnailUrl: t.thumbnailUrl && t.thumbnailUrl.startsWith('/')
          ? `${baseUrl}${t.thumbnailUrl}`
          : t.thumbnailUrl
      }));

      return res.json({ templates: formatted });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Admin: Create a new dynamic template
   */
  static async createTemplate(req: Request, res: Response) {
    try {
      const { name, description, category, layoutType, thumbnailUrl, isPremium, htmlContent, cssStyles } = req.body;
      if (!name || !description) {
        return res.status(400).json({ error: 'Name and description are required.' });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const template = await prisma.template.create({
        data: {
          slug: `${slug}-${Date.now()}`,
          name,
          description,
          category: category || 'Technology',
          layoutType: layoutType || 'SINGLE_COLUMN',
          thumbnailUrl: thumbnailUrl || 'https://via.placeholder.com/300x400',
          isPremium: Boolean(isPremium),
          isActive: true,
          htmlContent: htmlContent || '<div class="resume">{{FULL_NAME}}</div>',
          cssStyles: cssStyles || 'body { font-family: sans-serif; }'
        }
      });

      return res.status(201).json({ message: 'Template created successfully', template });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Admin: Toggle Template active status
   */
  static async toggleTemplateStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const existing = await prisma.template.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Template not found' });

      const updated = await prisma.template.update({
        where: { id },
        data: { isActive: !existing.isActive }
      });

      return res.json({ message: `Template status changed to ${updated.isActive ? 'Active' : 'Inactive'}`, template: updated });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}
