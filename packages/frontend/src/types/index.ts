// ─── Domain enums ────────────────────────────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  SECRETARY = 'SECRETARY',
  PASTOR = 'PASTOR',
}

// ─── Domain models ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;         // lowercase (canonical)
  displayName: string;  // original capitalisation
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  title: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  senderId: string;
  categoryId: string;
  category?: Category;
  sender?: User;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// ─── WebSocket events ─────────────────────────────────────────────────────────

export type WSEventType =
  | 'notification:new'
  | 'notification:sent_ack'
  | 'notification:status_updated'
  | 'notification:read'
  | 'error'
  | 'ping'
  | 'pong';

export interface WSEvent<T = unknown> {
  type: WSEventType;
  payload: T;
}

/** Server → Pastor / Admin */
export interface WSNotificationNew {
  id: string;
  title: string;
  body: string;
  category: Category;
  sentAt: string;
}

/** Server → Secretary / Admin */
export interface WSNotificationSentAck {
  notificationId: string;
}

/** Server → Secretary / Admin — emitted after Pastor marks as read */
export interface WSNotificationStatusUpdated {
  notificationId: string;
  readAt: string;
}

/** Client → Server — sent by Pastor / Admin */
export interface WSNotificationReadPayload {
  notificationId: string;
}

/** Server → Client — error response */
export interface WSErrorPayload {
  code: string;
  message: string;
}
