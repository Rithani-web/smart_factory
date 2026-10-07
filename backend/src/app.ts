import cookieParser from 'cookie-parser';
import express from 'express';

import { authRouter } from './auth/routes.ts';
import { policiesRouter } from './escalation/routes.ts';
import { eventsRouter } from './events/routes.ts';
import { slaRouter } from './sla/routes.ts';
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

  app.use('/api', authRouter);
  app.use('/api', usersRouter);
  app.use('/api', teamsRouter);
  app.use('/api', policiesRouter);
  app.use('/api', slaRouter);
  app.use('/api', eventsRouter);

  // Uniform error shape must be registered LAST (research D9).
  app.use(errorMiddleware);
  return app;
}
