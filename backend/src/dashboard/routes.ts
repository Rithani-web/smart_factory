import { Router } from 'express';

import {
  blockPasswordChangePending,
  requireAuth,
  type AuthedRequest,
} from '../auth/middleware.ts';
import { getDashboardSummary, resolveFilter } from './service.ts';

export const dashboardRouter = Router();

// Read-only for every authenticated role (FR-302) — role defaults applied in
// resolveFilter; pending-password gate stays consistent everywhere.
dashboardRouter.get(
  '/dashboard/summary',
  requireAuth,
  blockPasswordChangePending,
  async (req: AuthedRequest, res, next) => {
    try {
      const filter = await resolveFilter(
        req.user!.role,
        req.user!.id,
        (req.query.teamId as string) || null,
        (req.query.days as string) || null,
      );
      res.json(await getDashboardSummary(filter));
    } catch (err) {
      next(err);
    }
  },
);
