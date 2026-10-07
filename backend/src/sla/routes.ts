import { Router } from 'express';

import type { UpdateSlaTargetsRequest } from '@smart-factory/types';

import {
  blockPasswordChangePending,
  requireAuth,
  requireRole,
  type AuthedRequest,
} from '../auth/middleware.ts';
import { getSlaTargets, updateSlaTargets } from './service.ts';

export const slaRouter = Router();

slaRouter.use('/sla-targets', requireAuth, blockPasswordChangePending);

slaRouter.get('/sla-targets', async (_req: AuthedRequest, res, next) => {
  try {
    res.json(await getSlaTargets());
  } catch (err) {
    next(err);
  }
});

slaRouter.put('/sla-targets', requireRole('ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    res.json(await updateSlaTargets(req.body as UpdateSlaTargetsRequest));
  } catch (err) {
    next(err);
  }
});
