import { Router } from 'express';

import { getPrisma } from '../shared/prisma.ts';
import { requireAuth, type AuthedRequest } from './middleware.ts';
import { REFRESH_COOKIE } from './tokens.ts';
import { completePasswordChange, login, logout, refresh } from './service.ts';

export const authRouter = Router();

authRouter.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    const user = await login(res, email ?? '', password ?? '');
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/auth/refresh', async (req, res, next) => {
  try {
    const user = await refresh(res, req.cookies?.[REFRESH_COOKIE] as string | undefined);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/auth/logout', (_req, res) => {
  logout(res);
  res.status(204).end();
});

authRouter.post(
  '/auth/complete-password-change',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const { newPassword } = req.body as { newPassword?: string };
      await completePasswordChange(req.user!.id, newPassword ?? '');
      const user = await getPrisma().user.findUniqueOrThrow({
        where: { id: req.user!.id },
        select: { id: true, name: true, role: true, mustChangePassword: true },
      });
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);
