import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

import { config } from '../../config';
import prisma from '../../lib/prisma';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_INACTIVE'
  | 'INVALID_REFRESH_TOKEN'
  | 'REFRESH_TOKEN_EXPIRED'
  | 'INVALID_ACCESS_TOKEN';

export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly statusCode: number;

  public constructor(code: AuthErrorCode, message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    role: UserRole;
  };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function durationInMilliseconds(duration: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

export class AuthService {
  public constructor(private readonly database = prisma) {}

  public async login(username: string, password: string): Promise<AuthTokens> {
    const normalizedUsername = normalizeUsername(username);
    const user = await this.database.user.findUnique({
      where: { username: normalizedUsername },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid username or password');
    }

    if (!user.isActive) {
      throw new AuthError('ACCOUNT_INACTIVE', 'User account is inactive', 403);
    }

    return this.issueTokens(user.id, user.username, user.role);
  }

  public async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const storedToken = await this.database.refreshToken.findUnique({
      where: { token: hashRefreshToken(refreshToken) },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt) {
      throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }

    if (storedToken.expiresAt <= new Date()) {
      throw new AuthError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
    }

    if (!storedToken.user.isActive) {
      throw new AuthError('ACCOUNT_INACTIVE', 'User account is inactive', 403);
    }

    await this.database.refreshToken.update({ where: { id: storedToken.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(
      storedToken.user.id,
      storedToken.user.username,
      storedToken.user.role,
    );
  }

  public async logout(refreshToken: string): Promise<void> {
    await this.database.refreshToken.updateMany({
      where: { token: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  public validateToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (
        typeof payload !== 'object' ||
        typeof payload.sub !== 'string' ||
        !Object.values(UserRole).includes(payload.role as UserRole) ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number'
      ) {
        throw new Error('Invalid access token payload');
      }

      return payload as AccessTokenPayload;
    } catch (_error) {
      throw new AuthError('INVALID_ACCESS_TOKEN', 'Invalid or expired access token');
    }
  }

  public async validateSession(payload: AccessTokenPayload): Promise<void> {
    const user = await this.database.user.findUnique({
      where: { id: payload.sub },
      select: { role: true, isActive: true },
    });
    if (!user || !user.isActive || user.role !== payload.role) {
      throw new AuthError('INVALID_ACCESS_TOKEN', 'Invalid or expired access token');
    }
  }

  private async issueTokens(
    userId: string,
    username: string,
    role: UserRole,
  ): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { sub: userId, role },
      config.jwtSecret,
      { expiresIn: durationInMilliseconds(config.accessTokenExpiresIn) / 1000 },
    );
    const refreshToken = randomBytes(32).toString('hex');

    await this.database.refreshToken.create({
      data: {
        userId,
        token: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + durationInMilliseconds(config.refreshTokenExpiresIn)),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, username, role },
    };
  }
}

export default new AuthService();
