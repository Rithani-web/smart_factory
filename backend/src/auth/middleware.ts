import type { NextFunction, Request, Response } from 'express';

import { ERROR_CODES, type Role } from '@smart-factory/types';

import { httpError, unauthorized } from '../shared/errors.ts';
import { getPrisma } from '../shared/prisma.ts';
import { ACCESS_COOKIE, verifyAccessToken } from './tokens.ts';

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: Role;
    mustChangePassword: boolean;
  };
}

/** Verify the access-token cookie and attach the user. 401 when
 * missing/invalid (FR-001). */
export async function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (!token) {
      throw unauthorized();
    }
    const payload = verifyAccessToken(token);
    const user = await getPrisma().user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, role: true, mustChangePassword: true },
    });
    if (!user) {
      throw unauthorized();
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Role gate — 403 on mismatch (Constitution II: server-side only). */
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(httpError(403, ERROR_CODES.FORBIDDEN, 'You do not have permission to do that'));
      return;
    }
    next();
  };
}

/** FR-019 / research D10: a user with mustChangePassword may do nothing except
 * complete the password change. */
export function blockPasswordChangePending(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (req.user?.mustChangePassword) {
    next(
      httpError(
        403,
        ERROR_CODES.PASSWORD_CHANGE_REQUIRED,
        'You must set a new password before doing anything else',
      ),
    );
    return;
  }
  next();
}
