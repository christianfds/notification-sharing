import bcrypt from 'bcryptjs';
import { Prisma, User, UserRole } from '@prisma/client';

import { config } from '../../config';
import prisma from '../../lib/prisma';

export type UserErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_ROLE'
  | 'USERNAME_TAKEN'
  | 'USER_NOT_FOUND'
  | 'ADMIN_SELF_DEACTIVATION'
  | 'SUPER_ADMIN_PROTECTED';

export class UserError extends Error {
  public readonly code: UserErrorCode;
  public readonly statusCode: number;

  public constructor(code: UserErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'UserError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  username?: string;
  password?: string;
  role?: UserRole;
}

type RequestingUser = string | { id: string };

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function validateUsername(username: unknown): string {
  if (typeof username !== 'string') {
    throw new UserError('VALIDATION_ERROR', 'Username must be a string', 400);
  }

  const normalized = normalizeUsername(username);
  if (normalized.length < 3 || normalized.length > 50 || !/\S/.test(normalized)) {
    throw new UserError('VALIDATION_ERROR', 'Username must be 3-50 characters and contain non-whitespace characters', 400);
  }

  return normalized;
}

function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new UserError('VALIDATION_ERROR', 'Password must be at least 8 characters', 400);
  }

  return password;
}

function validateCreatableRole(role: unknown): UserRole {
  if (![UserRole.SECRETARY, UserRole.PASTOR, UserRole.ADMIN].includes(role as UserRole)) {
    throw new UserError('INVALID_ROLE', 'Invalid user role', 400);
  }

  return role as UserRole;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError || isRecordWithCode(error)) &&
    error.code === 'P2002'
  );
}

function isRecordWithCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string';
}

export class UserService {
  public constructor(private readonly database = prisma) {}

  public async createUser(input: CreateUserInput): Promise<PublicUser>;
  public async createUser(username: string, password: string, role: UserRole): Promise<PublicUser>;
  public async createUser(
    inputOrUsername: CreateUserInput | string,
    password?: string,
    role?: UserRole,
  ): Promise<PublicUser> {
    const input =
      typeof inputOrUsername === 'string'
        ? { username: inputOrUsername, password, role }
        : inputOrUsername;
    const username = validateUsername(input.username);
    const validatedPassword = validatePassword(input.password);
    const validatedRole = validateCreatableRole(input.role);

    if (await this.database.user.findUnique({ where: { username } })) {
      throw new UserError('USERNAME_TAKEN', 'Username is already in use', 409);
    }

    try {
      const user = await this.database.user.create({
        data: {
          username,
          passwordHash: await bcrypt.hash(validatedPassword, config.bcryptRounds),
          role: validatedRole,
          isSuperAdmin: false,
        },
      });
      return this.publicUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new UserError('USERNAME_TAKEN', 'Username is already in use', 409);
      }
      throw error;
    }
  }

  public async listUsers(): Promise<PublicUser[]> {
    const users = await this.database.user.findMany({ orderBy: { username: 'asc' } });
    return users.map((user) => this.publicUser(user));
  }

  public async updateUser(userId: string, input: UpdateUserInput): Promise<PublicUser> {
    if (!input || typeof input !== 'object' || Object.keys(input).length === 0) {
      throw new UserError('VALIDATION_ERROR', 'At least one user field is required', 400);
    }

    const existing = await this.database.user.findUnique({ where: { id: userId } });
    if (!existing) throw new UserError('USER_NOT_FOUND', 'User not found', 404);
    if (existing.isSuperAdmin && input.password !== undefined) {
      throw new UserError('SUPER_ADMIN_PROTECTED', 'The Super Admin password cannot be changed', 422);
    }
    const data: { username?: string; passwordHash?: string; role?: UserRole } = {};
    if (input.username !== undefined) data.username = validateUsername(input.username);
    if (input.password !== undefined) {
      data.passwordHash = await bcrypt.hash(validatePassword(input.password), config.bcryptRounds);
    }
    if (input.role !== undefined) {
      if (!Object.values(UserRole).includes(input.role)) {
        throw new UserError('INVALID_ROLE', 'Invalid user role', 400);
      }
      if (existing.isSuperAdmin && input.role !== UserRole.ADMIN) {
        throw new UserError('SUPER_ADMIN_PROTECTED', 'Promote another Admin before changing the Super Admin role', 422);
      }
      data.role = input.role;
    }

    try {
      const user = await this.database.user.update({ where: { id: userId }, data });
      return this.publicUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new UserError('USERNAME_TAKEN', 'Username is already in use', 409);
      }
      if (this.isRecordNotFoundError(error)) {
        throw new UserError('USER_NOT_FOUND', 'User not found', 404);
      }
      throw error;
    }
  }

  public async setUserStatus(
    userId: string,
    isActive: boolean,
    requestingUser?: RequestingUser,
  ): Promise<PublicUser> {
    const user = await this.database.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserError('USER_NOT_FOUND', 'User not found', 404);

    const requesterId = typeof requestingUser === 'string' ? requestingUser : requestingUser?.id;
    if (!isActive && user.role === UserRole.ADMIN && requesterId === userId) {
      throw new UserError('ADMIN_SELF_DEACTIVATION', 'An Admin cannot deactivate their own account', 403);
    }
    if (!isActive && user.isSuperAdmin) {
      throw new UserError('SUPER_ADMIN_PROTECTED', 'The Super Admin must be replaced before deactivation', 422);
    }

    const updatedUser = await this.database.user.update({ where: { id: userId }, data: { isActive } });
    if (!isActive) {
      await this.database.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return this.publicUser(updatedUser);
  }

  public async getUserById(userId: string): Promise<PublicUser> {
    const user = await this.database.user.findUnique({ where: { id: userId } });
    if (!user) throw new UserError('USER_NOT_FOUND', 'User not found', 404);
    return this.publicUser(user);
  }

  private publicUser(user: User): PublicUser {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return (
      (error instanceof Prisma.PrismaClientKnownRequestError || isRecordWithCode(error)) &&
      error.code === 'P2025'
    );
  }
}

export default new UserService();
