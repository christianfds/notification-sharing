import { Router } from 'express';
import { UserRole } from '@prisma/client';

import authMiddleware from '../../middleware/auth.middleware';
import requireRole from '../../middleware/role.middleware';
import userService, { UserError, UserService } from './user.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validationError(message: string): UserError {
  return new UserError('VALIDATION_ERROR', message, 400);
}

function parseCreateBody(body: unknown): { username: string; password: string; role: UserRole } {
  if (!isRecord(body) || typeof body.username !== 'string' || typeof body.password !== 'string') {
    throw validationError('Username, password and role are required');
  }
  if (body.role !== UserRole.SECRETARY && body.role !== UserRole.PASTOR) {
    throw new UserError('INVALID_ROLE', 'Only Secretary and Pastor users can be created', 400);
  }

  return { username: body.username, password: body.password, role: body.role };
}

function parseUpdateBody(body: unknown): { username?: string; password?: string; role?: UserRole } {
  if (!isRecord(body)) throw validationError('Request body must be an object');

  const input: { username?: string; password?: string; role?: UserRole } = {};
  if ('username' in body) {
    if (typeof body.username !== 'string') throw validationError('Username must be a string');
    input.username = body.username;
  }
  if ('password' in body) {
    if (typeof body.password !== 'string') throw validationError('Password must be a string');
    input.password = body.password;
  }
  if ('role' in body) {
    if (typeof body.role !== 'string' || !Object.values(UserRole).includes(body.role as UserRole)) {
      throw new UserError('INVALID_ROLE', 'Invalid user role', 400);
    }
    input.role = body.role as UserRole;
  }
  if (Object.keys(input).length === 0) throw validationError('At least one user field is required');

  return input;
}

function parseStatusBody(body: unknown): boolean {
  if (!isRecord(body) || typeof body.isActive !== 'boolean') {
    throw validationError('isActive must be a boolean');
  }
  return body.isActive;
}

function sendUserError(res: Parameters<ReturnType<Router['get']>>[1], error: unknown): void {
  if (error instanceof UserError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
}

export function createUserRouter(service: UserService = userService): Router {
  const router = Router();
  router.use(authMiddleware, requireRole(UserRole.ADMIN));

  router.get('/', async (_req, res) => {
    try {
      res.status(200).json(await service.listUsers());
    } catch (error) {
      sendUserError(res, error);
    }
  });

  router.post('/', async (req, res) => {
    try {
      res.status(201).json(await service.createUser(parseCreateBody(req.body)));
    } catch (error) {
      sendUserError(res, error);
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      res.status(200).json(await service.updateUser(req.params.id, parseUpdateBody(req.body)));
    } catch (error) {
      sendUserError(res, error);
    }
  });

  router.patch('/:id/status', async (req, res) => {
    try {
      res.status(200).json(await service.setUserStatus(req.params.id, parseStatusBody(req.body), req.user!.id));
    } catch (error) {
      sendUserError(res, error);
    }
  });

  return router;
}

export default createUserRouter;
