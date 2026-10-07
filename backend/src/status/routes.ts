import { Router } from 'express';

import { getPrisma } from '../shared/prisma.ts';
import { getPublicStatus } from './service.ts';

/**
 * THE one unauthenticated surface (constitution v1.3.0): mounted on the public
 * router with NO auth middleware. Data-minimal by contract test (FR-311).
 */
export const publicStatusRouter = Router();

publicStatusRouter.get('/public/status', async (_req, res, next) => {
  try {
    res.json(await getPublicStatus(getPrisma()));
  } catch (err) {
    next(err);
  }
});
