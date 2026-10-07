import bcrypt from 'bcryptjs';

import { ERROR_CODES, type Role, type UserDTO } from '@smart-factory/types';

import { httpError } from '../shared/errors.ts';
import { getPrisma } from '../shared/prisma.ts';

const TEMP_PASSWORD_LENGTH = 12;

function toUserDTO(u: { id: string; name: string; role: Role }): UserDTO {
  // FR-018: email never leaves the server.
  return { id: u.id, name: u.name, role: u.role };
}

export async function createUser(
  input: { name?: string; email?: string; role?: Role },
): Promise<{ user: UserDTO; temporaryPassword: string }> {
  const { name, email, role } = input;
  if (!name || !email || !role) {
    throw httpError(400, ERROR_CODES.VALIDATION, 'name, email and role are required');
  }
  const existing = await getPrisma().user.findUnique({ where: { email } });
  if (existing) {
    throw httpError(409, ERROR_CODES.EMAIL_TAKEN, 'A user with this email already exists');
  }
  const temporaryPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  const user = await getPrisma().user.create({
    data: { name, email, role, passwordHash, mustChangePassword: true },
    select: { id: true, name: true, role: true },
  });
  return { user: toUserDTO(user), temporaryPassword };
}

export async function listUsers(): Promise<UserDTO[]> {
  const users = await getPrisma().user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true },
  });
  return users.map(toUserDTO);
}

export async function listTechnicians(): Promise<UserDTO[]> {
  const users = await getPrisma().user.findMany({
    where: { role: 'TECHNICIAN' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true },
  });
  return users.map(toUserDTO);
}

function generateTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
