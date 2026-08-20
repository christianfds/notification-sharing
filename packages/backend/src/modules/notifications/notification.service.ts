import { Prisma, PrismaClient } from '@prisma/client';

import prisma from '../../lib/prisma';

export type NotificationErrorCode =
  | 'VALIDATION_ERROR'
  | 'CATEGORY_NOT_FOUND'
  | 'NOTIFICATION_NOT_FOUND';

export class NotificationError extends Error {
  public readonly code: NotificationErrorCode;
  public readonly statusCode: number;
  public readonly status: number;

  public constructor(code: NotificationErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
    this.statusCode = statusCode;
    this.status = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface CreateNotificationInput {
  body: string;
  categoryId: string;
  senderId: string;
}

export interface ListNotificationsInput {
  categoryId?: string;
  from?: Date | string;
  to?: Date | string;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface UpdateNotificationInput {
  body: string;
  categoryId: string;
}

export interface PaginatedNotifications {
  data: Awaited<ReturnType<PrismaClient['notification']['findMany']>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 50;
const MAX_DATE_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const notificationInclude = {
  category: true,
  sender: { select: { id: true, username: true, role: true } },
} as const;

function validateContent(value: unknown, field: 'body', maximum: number): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !/\S/.test(value)) {
    throw new NotificationError(
      'VALIDATION_ERROR',
      `Notification ${field} must be between 1 and ${maximum} characters and contain non-whitespace characters`,
      400,
    );
  }
  return value;
}

function parseDate(value: unknown, field: 'from' | 'to'): Date | undefined {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    throw new NotificationError('VALIDATION_ERROR', `${field} must be a valid date`, 400);
  }
  return date;
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError || isRecordWithCode(error)) &&
    error.code === code
  );
}

function isRecordWithCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string';
}

export class NotificationService {
  public constructor(private readonly database: PrismaClient = prisma) {}

  public async createNotification(input: CreateNotificationInput) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new NotificationError('VALIDATION_ERROR', 'Notification fields are required', 400);
    }

    const body = validateContent(input.body, 'body', 500);
    if (typeof input.categoryId !== 'string' || input.categoryId.length === 0) {
      throw new NotificationError('VALIDATION_ERROR', 'Notification category is required', 400);
    }
    if (typeof input.senderId !== 'string' || input.senderId.length === 0) {
      throw new NotificationError('VALIDATION_ERROR', 'Notification sender is required', 400);
    }

    const category = await this.database.category.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new NotificationError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    try {
      return await this.database.notification.create({
        data: {
          body,
          categoryId: input.categoryId,
          senderId: input.senderId,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      if (isPrismaError(error, 'P2003')) {
        throw new NotificationError('CATEGORY_NOT_FOUND', 'Category not found', 404);
      }
      throw error;
    }
  }

  public async listNotifications(input: ListNotificationsInput = {}): Promise<PaginatedNotifications> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new NotificationError('VALIDATION_ERROR', 'Invalid notification filters', 400);
    }

    const from = parseDate(input.from, 'from');
    const to = parseDate(input.to, 'to');
    if (from && to && (from > to || to.getTime() - from.getTime() > MAX_DATE_RANGE_MS)) {
      throw new NotificationError('VALIDATION_ERROR', 'Date range must be no more than 31 days', 400);
    }

    const page = input.page === undefined ? 1 : input.page;
    const pageSize = input.pageSize === undefined ? MAX_PAGE_SIZE : input.pageSize;
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new NotificationError('VALIDATION_ERROR', 'Page must be positive and pageSize must be between 1 and 50', 400);
    }
    if (input.categoryId !== undefined && (typeof input.categoryId !== 'string' || input.categoryId.length === 0)) {
      throw new NotificationError('VALIDATION_ERROR', 'categoryId must be a non-empty string', 400);
    }

    const sentAt: Prisma.DateTimeFilter = {};
    if (from) sentAt.gte = from;
    if (to) sentAt.lte = to;
    const where: Prisma.NotificationWhereInput = {
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.includeDeleted ? {} : { deletedAt: null }),
      ...(from || to ? { sentAt } : {}),
    };
      const [data, total] = await Promise.all([
      this.database.notification.findMany({
        where,
        include: notificationInclude,
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.notification.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  public async getNotificationById(id: string, includeDeleted = false) {
    const notification = await this.database.notification.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
      include: notificationInclude,
    });
    if (!notification) {
      throw new NotificationError('NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
    }
    return notification;
  }

  public async updateNotification(id: string, input: UpdateNotificationInput) {
    const body = validateContent(input.body, 'body', 500);
    if (!input.categoryId) {
      throw new NotificationError('VALIDATION_ERROR', 'Notification category is required', 400);
    }
    const category = await this.database.category.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      throw new NotificationError('CATEGORY_NOT_FOUND', 'Category not found', 404);
    }

    try {
      return await this.database.notification.update({
        where: { id },
        data: { body, categoryId: input.categoryId },
        include: notificationInclude,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotificationError('NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
      }
      throw error;
    }
  }

  public async deleteNotification(id: string): Promise<void> {
    try {
      await this.database.notification.update({ where: { id }, data: { deletedAt: new Date() } });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotificationError('NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
      }
      throw error;
    }
  }

  public async restoreNotification(id: string) {
    try {
      return await this.database.notification.update({
        where: { id },
        data: { deletedAt: null },
        include: notificationInclude,
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotificationError('NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
      }
      throw error;
    }
  }

  public async markAsRead(id: string) {
    const readAt = new Date();
    const result = await this.database.notification.updateMany({
      where: { id, readAt: null, deletedAt: null },
      data: { readAt },
    });
    if (result.count > 0) return this.getNotificationById(id);

    const notification = await this.database.notification.findFirst({ where: { id, deletedAt: null } });
    if (!notification) {
      throw new NotificationError('NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
    }
    return notification;
  }

  public async setReadStatus(id: string, read: boolean) {
    const notification = await this.database.notification.findFirst({ where: { id, deletedAt: null } });
    if (!notification) {
      throw new NotificationError('NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
    }

    if (read && notification.readAt === null) {
      return this.markAsRead(id);
    }

    if (!read && notification.readAt !== null) {
      return this.database.notification.update({
        where: { id },
        data: { readAt: null },
        include: notificationInclude,
      });
    }

    return this.getNotificationById(id);
  }
}

export default new NotificationService();
