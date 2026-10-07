import { Router } from 'express';

import type { UpdatePoliciesRequest } from '@smart-factory/types';

import {
  blockPasswordChangePending,
  requireAuth,
  requireRole,
  type AuthedRequest,
} from '../auth/middleware.ts';
import { getPolicies, updatePolicies } from './policies.ts';

export const policiesRouter = Router();

policiesRouter.use(
  '/escalation-policies',
  requireAuth,
  blockPasswordChangePending,
);

policiesRouter.get('/escalation-policies', async (_req: AuthedRequest, res, next) => {
  try {
    res.json(await getPolicies());
  } catch (err) {
    next(err);
  }
});

policiesRouter.put(
  '/escalation-policies',
  requireRole('ADMIN'),
  async (req: AuthedRequest, res, next) => {
    try {
      res.json(await updatePolicies(req.body as UpdatePoliciesRequest));
    } catch (err) {
      next(err);
    }
  },
);
