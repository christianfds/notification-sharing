import { Router, Request, Response } from 'express';

import { config } from '../../config';
import { AccountLockedError, LoginAttemptService } from './login-attempt.service';
import { AuthError, AuthService } from './auth.service';

const REFRESH_COOKIE = 'refreshToken';

function getRefreshToken(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookie = cookieHeader.split(';').find((item) => item.trim().startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) return undefined;

  try {
    return decodeURIComponent(cookie.trim().slice(REFRESH_COOKIE.length + 1));
  } catch (_error) {
    return undefined;
  }
}

function setRefreshCookie(res: Response, token: string): void {
  const maxAge = Math.floor(durationInMilliseconds(config.refreshTokenExpiresIn) / 1000);
  // Secure cookies are enabled in production. HTTP localhost cannot send a Secure cookie in development.
  const secure = config.nodeEnv === 'production';
  res.append(
    'Set-Cookie',
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`,
  );
}

function clearRefreshCookie(res: Response): void {
  const secure = config.nodeEnv === 'production';
  res.append(
    'Set-Cookie',
    `${REFRESH_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`,
  );
}

function durationInMilliseconds(duration: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) throw new Error(`Invalid duration: ${duration}`);

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return Number(match[1]) * multipliers[match[2]];
}

function sendAuthError(res: Response, error: unknown): void {
  if (error instanceof AccountLockedError) {
    res.status(error.statusCode).json(error.data);
    return;
  }

  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }

  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
}

export interface AuthRouterDependencies {
  authService?: AuthService;
  loginAttemptService?: LoginAttemptService;
}

export function createAuthRouter({
  authService = new AuthService(),
  loginAttemptService = new LoginAttemptService(),
}: AuthRouterDependencies = {}): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Username and password are required' });
      return;
    }

    const ipAddress = req.ip;
    try {
      await loginAttemptService.assertNotLocked(username);
      const tokens = await authService.login(username, password);
      await loginAttemptService.recordSuccess(username, ipAddress);
      setRefreshCookie(res, tokens.refreshToken);
      res.status(200).json({ accessToken: tokens.accessToken, user: tokens.user });
    } catch (error) {
      if (error instanceof AccountLockedError) {
        sendAuthError(res, error);
        return;
      }

      if (error instanceof AuthError) {
        try {
          const result = await loginAttemptService.recordFailure(username, ipAddress);
          if (result.locked) {
            sendAuthError(res, new AccountLockedError(result.retryAfterSeconds ?? 1));
            return;
          }
        } catch (recordError) {
          sendAuthError(res, recordError);
          return;
        }
      }

      sendAuthError(res, error);
    }
  });

  router.post('/refresh', async (req, res) => {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) {
      sendAuthError(res, new AuthError('INVALID_REFRESH_TOKEN', 'Invalid refresh token'));
      return;
    }

    try {
      const tokens = await authService.refreshToken(refreshToken);
      setRefreshCookie(res, tokens.refreshToken);
      res.status(200).json({ accessToken: tokens.accessToken, user: tokens.user });
    } catch (error) {
      sendAuthError(res, error);
    }
  });

  router.post('/logout', async (req, res) => {
    const refreshToken = getRefreshToken(req);
    try {
      if (refreshToken) await authService.logout(refreshToken);
      clearRefreshCookie(res);
      res.status(204).send();
    } catch (error) {
      sendAuthError(res, error);
    }
  });

  return router;
}

export default createAuthRouter;
