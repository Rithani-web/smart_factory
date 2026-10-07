import cookieParser from 'cookie-parser';
import express from 'express';

import { authRouter } from './auth/routes.ts';
import { dashboardRouter } from './dashboard/routes.ts';
import { policiesRouter } from './escalation/routes.ts';
import { eventsRouter } from './events/routes.ts';
import { publicStatusRouter } from './status/routes.ts';
import { slaRouter } from './sla/routes.ts';
import { statusMessageRouter } from './status/adminRoutes.ts';
import { teamsRouter } from './teams/routes.ts';
import { usersRouter } from './users/routes.ts';
import { errorMiddleware } from './shared/errors.ts';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // THE one unauthenticated surface (constitution v1.3.0) — mounted before any
  // auth-protected router. Data-minimal by contract test.
  app.use('/api', publicStatusRouter);

  app.use('/api', authRouter);
  app.use('/api', usersRouter);
  app.use('/api', teamsRouter);
  app.use('/api', statusMessageRouter);
  app.use('/api', policiesRouter);
  app.use('/api', slaRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', eventsRouter);

  // Uniform error shape must be registered LAST (research D9).
  app.use(errorMiddleware);
  return app;
}
