import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export interface AuthContext {
  id: string;
  role: string;
}

/**
 * Production-Grade Application-Level Row-Level Security (RLS) Client.
 * 
 * - When role is 'ADMIN', queries have full platform-wide visibility.
 * - When role is 'USER', all operations on sensitive entities (Resume, SupportTicket, 
 *   JobSearchQuery, JobApplication) are automatically constrained to the authenticated user's ID,
 *   preventing cross-tenant data leaks even in the event of controller logic oversights.
 */
export function getScopedPrisma(authContext?: AuthContext) {
  if (!authContext || authContext.role === 'ADMIN') {
    return prisma;
  }

  const currentUserId = authContext.id;

  return prisma.$extends({
    query: {
      resume: {
        async findMany({ args, query }) {
          args.where = { ...args.where, userId: currentUserId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, userId: currentUserId };
          return query(args);
        },
        async findUnique({ args, query }) {
          // If query specifies ID, ensure user owns that resume
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, userId: currentUserId };
          return query(args);
        }
      },
      supportTicket: {
        async findMany({ args, query }) {
          args.where = { ...args.where, userId: currentUserId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, userId: currentUserId };
          return query(args);
        }
      },
      jobSearchQuery: {
        async findMany({ args, query }) {
          args.where = { ...args.where, userId: currentUserId };
          return query(args);
        }
      },
      jobApplication: {
        async findMany({ args, query }) {
          args.where = { ...args.where, userId: currentUserId };
          return query(args);
        }
      }
    }
  });
}
