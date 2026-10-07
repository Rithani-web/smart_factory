import { Router } from 'express';

import { requireAuth, requireRole, blockPasswordChangePending, type AuthedRequest } from '../auth/middleware.ts';
import { createUser, listUsers } from './service.ts';

export const usersRouter = Router();

usersRouter.use('/users', requireAuth, blockPasswordChangePending, requireRole('ADMIN'));

usersRouter.post('/users', async (req: AuthedRequest, res, next) => {
  try {
    const result = await createUser(req.body ?? {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/users', async (_req: AuthedRequest, res, next) => {
  try {
    res.json(await listUsers());
  } catch (err) {
    next(err);
  }
});
