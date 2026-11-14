import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { JobScraperService } from '../services/jobScraperService';
import { prisma } from '../config/db';

export class JobController {
  /**
   * Search & Scrape jobs based on filters (jobTitle, location, jobType, salaryExpectation)
   */
  static async searchJobs(req: AuthRequest, res: Response) {
    try {
      const { jobTitle, location, jobType, salaryExpectation } = req.query;
      const userId = req.user?.id;

      const filters = {
        jobTitle: (jobTitle as string) || 'Software Engineer',
        location: (location as string) || 'Remote',
        jobType: (jobType as string) || 'REMOTE',
        salaryExpectation: (salaryExpectation as string) || '$70,000 - $110,000 / year'
      };

      const jobListings = await JobScraperService.searchAndScrapeJobs(filters);

      if (userId) {
        await prisma.jobSearchQuery.create({
          data: {
            userId,
            queryText: filters.jobTitle,
            location: filters.location,
            jobType: filters.jobType,
            salaryExpectation: filters.salaryExpectation,
            results: JSON.stringify(jobListings)
          }
        });
      }

      return res.json({
        success: true,
        filters,
        totalJobsFound: jobListings.length,
        jobs: jobListings
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Failed to search and scrape jobs.' });
    }
  }

  /**
   * Track when a user clicks to apply for a job on external website
   */
  static async trackJobApplication(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { jobTitle, company, applyUrl } = req.body;

      if (!userId || !applyUrl) {
        return res.status(400).json({ success: false, message: 'Missing job application parameters.' });
      }

      const application = await prisma.jobApplication.create({
        data: {
          userId,
          jobTitle: jobTitle || 'Target Position',
          company: company || 'Employer',
          applyUrl
        }
      });

      return res.json({
        success: true,
        message: 'Job application tracked successfully.',
        applicationId: application.id,
        externalApplyUrl: applyUrl
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Failed to track application.' });
    }
  }
}
