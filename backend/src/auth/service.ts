import bcrypt from 'bcryptjs';
import type { Response } from 'express';

import { ERROR_CODES, type Role } from '@smart-factory/types';

import { httpError, unauthorized } from '../shared/errors.ts';
import { getPrisma } from '../shared/prisma.ts';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  authCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './tokens.ts';

const sessionSelect = {
  id: true,
  name: true,
  role: true,
  mustChangePassword: true,
} as const;

export async function login(
  res: Response,
  email: string,
  password: string,
): Promise<{ id: string; name: string; role: string; mustChangePassword: boolean }> {
  if (!email || !password) {
    throw httpError(400, ERROR_CODES.VALIDATION, 'Email and password are required');
  }
  const user = await getPrisma().user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw httpError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email or password');
  }
  setSessionCookies(res, user.id, user.role);
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function refresh(
  res: Response,
  refreshToken: string | undefined,
): Promise<{ id: string; name: string; role: string; mustChangePassword: boolean }> {
  if (!refreshToken) {
    throw unauthorized();
  }
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorized('Session expired, please sign in again');
  }
  const user = await getPrisma().user.findUnique({
    where: { id: payload.sub },
    select: sessionSelect,
  });
  if (!user) {
    throw unauthorized();
  }
  setSessionCookies(res, user.id, user.role);
  return user;
}

export function logout(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export async function completePasswordChange(
  userId: string,
  newPassword: string,
): Promise<void> {
  if (!newPassword || newPassword.length < 8) {
    throw httpError(
      400,
      ERROR_CODES.VALIDATION,
      'New password must be at least 8 characters',
    );
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await getPrisma().user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}

function setSessionCookies(res: Response, userId: string, role: Role): void {
  const payload = { sub: userId, role };
  res.cookie(
    ACCESS_COOKIE,
    signAccessToken(payload),
    authCookieOptions(15 * 60),
  );
  res.cookie(
    REFRESH_COOKIE,
    signRefreshToken(payload),
    authCookieOptions(REFRESH_TTL_SECONDS),
  );
}
