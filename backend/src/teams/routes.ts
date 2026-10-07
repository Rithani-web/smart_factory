import { Router } from 'express';

import type { TeamRequest } from '@smart-factory/types';

import {
  blockPasswordChangePending,
  requireAuth,
  requireRole,
  type AuthedRequest,
} from '../auth/middleware.ts';
import { assertTechnicianIds, createTeam, listTeams, updateTeam } from './service.ts';

export const teamsRouter = Router();

teamsRouter.use('/teams', requireAuth, blockPasswordChangePending);

// FR-104: viewable by any authenticated user, editable by Admins only.
teamsRouter.get('/teams', async (_req: AuthedRequest, res, next) => {
  try {
    res.json(await listTeams());
  } catch (err) {
    next(err);
  }
});

async function handleWrite(req: AuthedRequest, res: import('express').Response, id?: string) {
  const input = req.body as TeamRequest;
  await assertTechnicianIds(input.memberIds ?? []);
  const dto = id ? await updateTeam(id, input) : await createTeam(input);
  res.status(id ? 200 : 201).json(dto);
}

teamsRouter.post('/teams', requireRole('ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    await handleWrite(req, res);
  } catch (err) {
    next(err);
  }
});

teamsRouter.put('/teams/:id', requireRole('ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    await handleWrite(req, res, req.params.id);
  } catch (err) {
    next(err);
  }
});
