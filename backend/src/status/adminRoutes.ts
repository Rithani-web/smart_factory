import { Router } from 'express';

import type { SetStatusMessageRequest } from '@smart-factory/types';

import {
  blockPasswordChangePending,
  requireAuth,
  requireRole,
  type AuthedRequest,
} from '../auth/middleware.ts';
import { badRequest, notFound } from '../shared/errors.ts';
import { getPrisma } from '../shared/prisma.ts';
import { getPublicStatus } from './service.ts';

/** Admin manual status overrides (FR-305): one active message per team. */
export const statusMessageRouter = Router();

statusMessageRouter.use(
  '/teams/:id/status-message',
  requireAuth,
  blockPasswordChangePending,
  requireRole('ADMIN'),
);

statusMessageRouter.put(
  '/teams/:id/status-message',
  async (req: AuthedRequest, res, next) => {
    try {
      const { message } = req.body as SetStatusMessageRequest;
      if (!message || !message.trim()) {
        throw badRequest('message is required');
      }
      if (message.trim().length > 280) {
        throw badRequest('message must be at most 280 characters');
      }
      const db = getPrisma();
      const team = await db.team.findUnique({ where: { id: req.params.id } });
      if (!team) {
        throw notFound('Team not found');
      }
      await db.statusMessage.upsert({
        where: { teamId: team.id },
        update: { message: message.trim(), authorId: req.user!.id, createdAt: new Date() },
        create: { teamId: team.id, message: message.trim(), authorId: req.user!.id },
      });
      res.json((await getPublicStatus(db)).teams.find((t) => t.teamId === team.id));
    } catch (err) {
      next(err);
    }
  },
);

statusMessageRouter.delete(
  '/teams/:id/status-message',
  async (req: AuthedRequest, res, next) => {
    try {
      const db = getPrisma();
      const team = await db.team.findUnique({ where: { id: req.params.id } });
      if (!team) {
        throw notFound('Team not found');
      }
      await db.statusMessage.deleteMany({ where: { teamId: team.id } });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
