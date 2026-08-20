import { Router, Response } from 'express';
import { UserRole } from '@prisma/client';

import authMiddleware from '../../middleware/auth.middleware';
import requireRole from '../../middleware/role.middleware';
import {
  broadcastNotificationNew,
  broadcastNotificationSentAck,
  broadcastNotificationStatusUpdated,
  broadcastNotificationDeleted,
  broadcastNotificationRestored,
  broadcastNotificationUpdated,
} from '../websocket/websocket.server';
import notificationService, {
  CreateNotificationInput,
  ListNotificationsInput,
  NotificationError,
  NotificationService,
} from './notification.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validationError(message: string): NotificationError {
  return new NotificationError('VALIDATION_ERROR', message, 400);
}

function parseCreateBody(body: unknown): Omit<CreateNotificationInput, 'senderId'> {
  if (!isRecord(body)) throw validationError('Request body must be an object');
  if (typeof body.body !== 'string' || typeof body.categoryId !== 'string') {
    throw validationError('Notification body and category are required');
  }

  return { body: body.body, categoryId: body.categoryId };
}

function parseQueryValue(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw validationError(`${name} must be a single value`);
  return value;
}

function parseQueryNumber(value: unknown, name: string): number | undefined {
  const parsed = parseQueryValue(value, name);
  return parsed === undefined ? undefined : Number(parsed);
}

function parseUpdateBody(body: unknown): { body: string; categoryId: string } {
  if (!isRecord(body) || typeof body.body !== 'string' || typeof body.categoryId !== 'string') {
    throw validationError('Notification body and category are required');
  }
  return { body: body.body, categoryId: body.categoryId };
}

function parseListQuery(query: Record<string, unknown>): ListNotificationsInput {
  return {
    categoryId: parseQueryValue(query.categoryId, 'categoryId'),
    from: parseQueryValue(query.from, 'from'),
    to: parseQueryValue(query.to, 'to'),
    includeDeleted: parseQueryValue(query.includeDeleted, 'includeDeleted') === 'true',
    page: parseQueryNumber(query.page, 'page'),
    pageSize: parseQueryNumber(query.pageSize, 'pageSize'),
  };
}

function sendNotificationError(res: Response, error: unknown): void {
  if (error instanceof NotificationError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }

  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
}

export interface NotificationRouterDependencies {
  notificationService?: NotificationService;
  broadcastNew?: typeof broadcastNotificationNew;
  broadcastSentAck?: typeof broadcastNotificationSentAck;
}

export function createNotificationRouter({
  notificationService: service = notificationService,
  broadcastNew = broadcastNotificationNew,
  broadcastSentAck = broadcastNotificationSentAck,
}: NotificationRouterDependencies = {}): Router {
  const router = Router();

  router.use(authMiddleware);

  router.post('/', requireRole(UserRole.SECRETARY, UserRole.ADMIN), async (req, res) => {
    try {
      const created = await service.createNotification({ ...parseCreateBody(req.body), senderId: req.user!.id });
      const persisted = await service.getNotificationById(created.id);
      broadcastNew(persisted);
      broadcastSentAck(created.id, req.user!.id);
      res.status(201).json(created);
    } catch (error) {
      sendNotificationError(res, error);
    }
  });

  router.get('/', requireRole(UserRole.SECRETARY, UserRole.ADMIN, UserRole.PASTOR), async (req, res) => {
    try {
      const filters = parseListQuery(req.query as Record<string, unknown>);
      if (req.user!.role === UserRole.PASTOR) filters.includeDeleted = false;
      res.status(200).json(await service.listNotifications(filters));
    } catch (error) {
      sendNotificationError(res, error);
    }
  });

  router.get('/:id', requireRole(UserRole.SECRETARY, UserRole.ADMIN, UserRole.PASTOR), async (req, res) => {
    try {
      const id = parseQueryValue(req.params.id, 'id');
      if (id === undefined) throw validationError('id is required');
      res.status(200).json(await service.getNotificationById(id, req.user!.role !== UserRole.PASTOR));
    } catch (error) {
      sendNotificationError(res, error);
    }
  });

  router.patch('/:id/read-status', requireRole(UserRole.SECRETARY, UserRole.ADMIN), async (req, res) => {
    try {
      if (!isRecord(req.body) || typeof req.body.read !== 'boolean') {
        throw validationError('read must be a boolean');
      }

      const id = parseQueryValue(req.params.id, 'id');
      if (id === undefined) throw validationError('id is required');
      const notification = await service.setReadStatus(id, req.body.read);
      broadcastNotificationStatusUpdated(notification.id, notification.readAt);
      res.status(200).json(notification);
    } catch (error) {
      sendNotificationError(res, error);
    }
  });

  router.put('/:id', requireRole(UserRole.SECRETARY, UserRole.ADMIN), async (req, res) => {
    try {
      const id = parseQueryValue(req.params.id, 'id');
      if (id === undefined) throw validationError('id is required');
      const notification = await service.updateNotification(id, parseUpdateBody(req.body));
      broadcastNotificationUpdated(notification.id);
      res.status(200).json(notification);
    } catch (error) {
      sendNotificationError(res, error);
    }
  });

  router.delete('/:id', requireRole(UserRole.SECRETARY, UserRole.ADMIN), async (req, res) => {
    try {
      const id = parseQueryValue(req.params.id, 'id');
      if (id === undefined) throw validationError('id is required');
      await service.deleteNotification(id);
      broadcastNotificationDeleted(id);
      res.status(204).send();
    } catch (error) {
      sendNotificationError(res, error);
    }
  });

  router.patch('/:id/restore', requireRole(UserRole.SECRETARY, UserRole.ADMIN), async (req, res) => {
    try {
      const id = parseQueryValue(req.params.id, 'id');
      if (id === undefined) throw validationError('id is required');
      const notification = await service.restoreNotification(id);
      broadcastNotificationRestored(notification);
      res.status(200).json(notification);
    } catch (error) {
      sendNotificationError(res, error);
    }
  });

  return router;
}

export default createNotificationRouter;
