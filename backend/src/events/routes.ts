import { Router } from 'express';

import type { Severity } from '@smart-factory/types';

import {
  blockPasswordChangePending,
  requireAuth,
  requireRole,
  type AuthedRequest,
} from '../auth/middleware.ts';
import { acknowledge, createEvent, getEventDetail, listEvents, reassign, resolve } from './service.ts';

export const eventsRouter = Router();

eventsRouter.use('/events', requireAuth, blockPasswordChangePending);

eventsRouter.get('/events', async (_req: AuthedRequest, res, next) => {
  try {
    res.json(await listEvents());
  } catch (err) {
    next(err);
  }
});

eventsRouter.get('/events/:id', async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getEventDetail(req.params.id));
  } catch (err) {
    next(err);
  }
});

eventsRouter.post(
  '/events',
  requireRole('ADMIN', 'TECHNICIAN'),
  async (req: AuthedRequest, res, next) => {
    try {
      const result = await createEvent(req.user!, req.body ?? {});
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

eventsRouter.post('/events/:id/acknowledge', async (req: AuthedRequest, res, next) => {
  try {
    res.json({ event: await acknowledge(req.user!, req.params.id) });
  } catch (err) {
    next(err);
  }
});

eventsRouter.post('/events/:id/resolve', async (req: AuthedRequest, res, next) => {
  try {
    const { resolutionNotes } = req.body as { resolutionNotes?: string };
    res.json({ event: await resolve(req.user!, req.params.id, resolutionNotes ?? '') });
  } catch (err) {
    next(err);
  }
});

eventsRouter.post(
  '/events/:id/reassign',
  requireRole('ADMIN'),
  async (req: AuthedRequest, res, next) => {
    try {
      const { technicianId } = req.body as { technicianId?: string };
      res.json({ event: await reassign(req.user!, req.params.id, technicianId ?? '') });
    } catch (err) {
      next(err);
    }
  },
);

// Severity re-export guard (kept for the exhaustive-values contract).
export type { Severity };
