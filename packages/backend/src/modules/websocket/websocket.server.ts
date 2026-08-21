import { IncomingMessage, Server as HttpServer } from 'node:http';
import { parse } from 'node:url';
import { UserRole } from '@prisma/client';
import WebSocket, { WebSocketServer as WsServer } from 'ws';

import AuthService, { AuthService as AuthServiceClass } from '../auth/auth.service';
import notificationService, { NotificationError, NotificationService } from '../notifications/notification.service';
import logger from '../../lib/logger';

export interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  role: UserRole;
  room: 'main';
}

const mainRoom = new Set<AuthenticatedWebSocket>();

function closeWithPolicyViolation(webSocket: WebSocket): void {
  webSocket.close(1008, 'Policy violation');
}

function getToken(request: IncomingMessage): string | undefined {
  const token = parse(request.url ?? '', true).query['token'];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

function sendEvent(webSocket: WebSocket, type: string, payload: unknown): void {
  if (webSocket.readyState !== WebSocket.OPEN) return;
  try {
    webSocket.send(JSON.stringify({ type, payload }));
  } catch (_error) {
    logger.warn('websocket.send_failed');
    webSocket.close();
  }
}

function sendError(webSocket: WebSocket, error: unknown): void {
  const code = error instanceof NotificationError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof NotificationError ? error.message : 'Internal server error';
  sendEvent(webSocket, 'error', { code, message });
}

function parseMessage(data: WebSocket.RawData): { type: string; payload?: unknown } {
  if (data.toString().length > 16 * 1024) {
    throw new NotificationError('VALIDATION_ERROR', 'WebSocket event is too large', 400);
  }
  let message: unknown;
  try {
    message = JSON.parse(data.toString());
  } catch (_error) {
    throw new NotificationError('VALIDATION_ERROR', 'WebSocket event must be valid JSON', 400);
  }
  if (typeof message !== 'object' || message === null || Array.isArray(message) || !('type' in message)) {
    throw new NotificationError('VALIDATION_ERROR', 'WebSocket event must be an object with a type', 400);
  }
  const type = (message as { type: unknown }).type;
  if (typeof type !== 'string') {
    throw new NotificationError('VALIDATION_ERROR', 'WebSocket event type is required', 400);
  }
  return message as { type: string; payload?: unknown };
}

function isRole(webSocket: AuthenticatedWebSocket, ...roles: UserRole[]): boolean {
  return roles.includes(webSocket.role);
}

function handleMessage(webSocket: AuthenticatedWebSocket, data: WebSocket.RawData, service: NotificationService): void {
  try {
    const event = parseMessage(data);
    if (event.type === 'ping') {
      logger.debug('websocket.ping', { userId: webSocket.userId, role: webSocket.role });
      sendEvent(webSocket, 'pong', {});
      return;
    }

    if (event.type !== 'notification:read') {
      throw new NotificationError('VALIDATION_ERROR', `Unsupported WebSocket event: ${event.type}`, 400);
    }
    if (!isRole(webSocket, UserRole.PASTOR, UserRole.ADMIN)) {
      sendEvent(webSocket, 'error', { code: 'FORBIDDEN', message: 'Insufficient permissions' });
      return;
    }

    const payload = event.payload;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload) ||
        typeof (payload as { notificationId?: unknown }).notificationId !== 'string' ||
        !(payload as { notificationId: string }).notificationId) {
      throw new NotificationError('VALIDATION_ERROR', 'notificationId is required', 400);
    }

    void service.markAsRead((payload as { notificationId: string }).notificationId).then((notification) => {
      logger.info('websocket.notification_read', { userId: webSocket.userId, notificationId: notification.id });
      broadcastNotificationStatusUpdated(notification.id, notification.readAt);
    }).catch((error: unknown) => sendError(webSocket, error));
  } catch (error) {
    logger.warn('websocket.message_error', { userId: webSocket.userId, error: error instanceof NotificationError ? error.code : 'internal' });
    sendError(webSocket, error);
  }
}

/** Attaches the WebSocket endpoint to an existing HTTP server. */
export function initializeWebSocketServer(
  httpServer: HttpServer,
  authService: AuthServiceClass = AuthService,
  service: NotificationService = notificationService,
): WsServer {
  const webSocketServer = new WsServer({ noServer: true, maxPayload: 16 * 1024 });

  httpServer.on('upgrade', (request, socket, head) => {
    if (parse(request.url ?? '', true).pathname !== '/ws') return;
    const allowedOrigin = process.env['CORS_ORIGIN'];
    if (request.headers.origin && allowedOrigin && request.headers.origin !== allowedOrigin) {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      void (async () => {
        const token = getToken(request);
        if (!token) {
          logger.warn('websocket.connection_rejected', { reason: 'missing_token' });
          closeWithPolicyViolation(webSocket);
          return;
        }

        try {
          const payload = authService.validateToken(token);
          await authService.validateSession(payload);
        const authenticatedWebSocket = webSocket as AuthenticatedWebSocket;
        authenticatedWebSocket.userId = payload.sub;
        authenticatedWebSocket.role = payload.role;
         authenticatedWebSocket.room = 'main';

          mainRoom.add(authenticatedWebSocket);
          logger.info('websocket.connected', { userId: authenticatedWebSocket.userId, role: authenticatedWebSocket.role });
         authenticatedWebSocket.on('message', (data) => handleMessage(authenticatedWebSocket, data, service));
          authenticatedWebSocket.once('close', () => {
            mainRoom.delete(authenticatedWebSocket);
            logger.info('websocket.disconnected', { userId: authenticatedWebSocket.userId });
          });
         authenticatedWebSocket.once('error', () => {
           mainRoom.delete(authenticatedWebSocket);
           logger.warn('websocket.error', { userId: authenticatedWebSocket.userId });
         });
         } catch (_error) {
          logger.warn('websocket.connection_rejected', { reason: 'authentication_failed' });
          closeWithPolicyViolation(webSocket);
        }
      })();
    });
  });

  return webSocketServer;
}

export function getMainRoomConnections(): ReadonlySet<AuthenticatedWebSocket> {
  return mainRoom;
}

export function broadcastToMainRoom(
  message: string | Buffer,
  shouldSend: (webSocket: AuthenticatedWebSocket) => boolean = () => true,
): void {
  for (const webSocket of mainRoom) {
    if (webSocket.readyState === WebSocket.OPEN && shouldSend(webSocket)) {
      try {
        webSocket.send(message);
      } catch (_error) {
        webSocket.close();
      }
    }
  }
}

export function broadcastNotificationNew(notification: {
  id: string;
  body: string;
  category: unknown;
  sentAt: Date;
}): void {
  broadcastToMainRoom(JSON.stringify({
    type: 'notification:new',
    payload: { ...notification, sentAt: notification.sentAt.toISOString() },
  }), (webSocket) => isRole(webSocket, UserRole.SECRETARY, UserRole.PASTOR, UserRole.ADMIN));
}

export function broadcastNotificationSentAck(notificationId: string, senderId: string): void {
  broadcastToMainRoom(JSON.stringify({
    type: 'notification:sent_ack',
    payload: { notificationId },
  }), (webSocket) => webSocket.userId === senderId && isRole(webSocket, UserRole.SECRETARY, UserRole.ADMIN));
}

export function broadcastNotificationStatusUpdated(notificationId: string, readAt: Date | null): void {
  broadcastToMainRoom(JSON.stringify({
    type: 'notification:status_updated',
    payload: { notificationId, readAt: readAt?.toISOString() ?? null },
  }), (webSocket) => isRole(webSocket, UserRole.SECRETARY, UserRole.PASTOR, UserRole.ADMIN));
}

export function broadcastCategoryOrderUpdated(categoryIds: string[]): void {
  broadcastToMainRoom(JSON.stringify({
    type: 'category:order_updated',
    payload: { categoryIds },
  }));
}

export function broadcastNotificationDeleted(notificationId: string): void {
  broadcastToMainRoom(JSON.stringify({
    type: 'notification:deleted',
    payload: { notificationId },
  }), (webSocket) => isRole(webSocket, UserRole.SECRETARY, UserRole.PASTOR, UserRole.ADMIN));
}

export function broadcastTemplateChanged(): void {
  broadcastToMainRoom(JSON.stringify({ type: 'template:changed', payload: {} }), (webSocket) => isRole(webSocket, UserRole.SECRETARY, UserRole.ADMIN));
}

export function broadcastNotificationUpdated(notificationId: string): void {
  broadcastToMainRoom(JSON.stringify({ type: 'notification:updated', payload: { notificationId } }), (webSocket) => isRole(webSocket, UserRole.SECRETARY, UserRole.PASTOR, UserRole.ADMIN));
}

export function broadcastNotificationRestored(notification: {
  id: string;
  body: string;
  category: unknown;
  sentAt: Date;
  readAt: Date | null;
}): void {
  broadcastToMainRoom(JSON.stringify({
    type: 'notification:restored',
    payload: { ...notification, sentAt: notification.sentAt.toISOString() },
  }), (webSocket) => isRole(webSocket, UserRole.SECRETARY, UserRole.PASTOR, UserRole.ADMIN));
}

export default initializeWebSocketServer;
