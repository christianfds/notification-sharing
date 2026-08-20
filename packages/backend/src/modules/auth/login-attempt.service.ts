import { PrismaClient } from '@prisma/client';
import prisma from '../../lib/prisma';

export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_ATTEMPT_FAILURE_LIMIT = 5;

export interface AccountLockedData {
  error: 'ACCOUNT_LOCKED';
  message: string;
  retryAfterSeconds: number;
}

export interface LoginAttemptLockStatus {
  locked: boolean;
  lockedUntil?: Date;
  retryAfterSeconds?: number;
}

/** Error shape intended to be passed directly to an HTTP error handler. */
export class AccountLockedError extends Error {
  readonly statusCode = 423;
  readonly status = 423;
  readonly code = 'ACCOUNT_LOCKED';
  readonly data: AccountLockedData;

  constructor(retryAfterSeconds: number) {
    const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
    const data: AccountLockedData = {
      error: 'ACCOUNT_LOCKED',
      message: 'Conta bloqueada por 15 minutos.',
      retryAfterSeconds: retryAfter,
    };

    super(data.message);
    this.name = 'AccountLockedError';
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LoginAttemptService {
  constructor(private readonly database: PrismaClient = prisma) {}

  /** Normalizes the key used for both lookup and persistence. */
  normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  async getLockStatus(
    username: string,
    now = new Date(),
  ): Promise<LoginAttemptLockStatus> {
    const normalizedUsername = this.normalizeUsername(username);
    const windowStart = new Date(now.getTime() - LOGIN_ATTEMPT_WINDOW_MS);
    const attempts = await this.database.loginAttempt.findMany({
      where: {
        username: normalizedUsername,
        attemptedAt: { gte: windowStart, lte: now },
      },
      orderBy: { attemptedAt: 'desc' },
      take: LOGIN_ATTEMPT_FAILURE_LIMIT,
      select: { success: true, attemptedAt: true },
    });

    if (
      attempts.length < LOGIN_ATTEMPT_FAILURE_LIMIT ||
      attempts.some((attempt) => attempt.success)
    ) {
      return { locked: false };
    }

    const lockedUntil = new Date(
      attempts[0].attemptedAt.getTime() + LOGIN_ATTEMPT_WINDOW_MS,
    );
    return {
      locked: true,
      lockedUntil,
      retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)),
    };
  }

  async assertNotLocked(username: string, now = new Date()): Promise<void> {
    const status = await this.getLockStatus(username, now);
    if (status.locked) {
      throw new AccountLockedError(status.retryAfterSeconds ?? 1);
    }
  }

  async recordAttempt(
    username: string,
    success: boolean,
    ipAddress?: string,
    attemptedAt = new Date(),
  ) {
    const normalizedUsername = this.normalizeUsername(username);
    const attempt = await this.database.loginAttempt.create({
      data: {
        username: normalizedUsername,
        success,
        ipAddress: ipAddress ?? null,
        attemptedAt,
      },
    });

    const lockStatus = success
      ? { locked: false }
      : await this.getLockStatus(normalizedUsername, attemptedAt);

    return { attempt, ...lockStatus };
  }

  async recordSuccess(username: string, ipAddress?: string, attemptedAt = new Date()) {
    return this.recordAttempt(username, true, ipAddress, attemptedAt);
  }

  async recordFailure(username: string, ipAddress?: string, attemptedAt = new Date()) {
    await this.assertNotLocked(username, attemptedAt);
    return this.recordAttempt(username, false, ipAddress, attemptedAt);
  }
}

export default LoginAttemptService;
