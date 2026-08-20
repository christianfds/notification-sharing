import { Router, Response } from 'express';
import { UserRole } from '@prisma/client';

import authMiddleware from '../../middleware/auth.middleware';
import requireRole from '../../middleware/role.middleware';
import {
  broadcastNotificationNew,
  broadcastNotificationSentAck,
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
  if (typeof body.title !== 'string' || typeof body.body !== 'string' || typeof body.categoryId !== 'string') {
    throw validationError('Notification title, body and categoryId are required');
  }

  return { title: body.title, body: body.body, categoryId: body.categoryId };
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

function parseListQuery(query: Record<string, unknown>): ListNotificationsInput {
  return {
    categoryId: parseQueryValue(query.categoryId, 'categoryId'),
    from: parseQueryValue(query.from, 'from'),
    to: parseQueryValue(query.to, 'to'),
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
      res.status(200).json(await service.listNotifications(parseListQuery(req.query as Record<string, unknown>)));
    } catch (error) {
      sendNotificationError(res, error);
    }
  });

  router.get('/:id', requireRole(UserRole.SECRETARY, UserRole.ADMIN, UserRole.PASTOR), async (req, res) => {
    try {
      const id = parseQueryValue(req.params.id, 'id');
      if (id === undefined) throw validationError('id is required');
      res.status(200).json(await service.getNotificationById(id));
    } catch (error) {
      sendNotificationError(res, error);
    }
  });

  return router;
}

export default createNotificationRouter;
