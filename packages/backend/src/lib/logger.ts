import type { Request } from 'express';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogMetadata = Record<string, unknown>;

const sensitiveKey = /(password|hash|jwt|token|secret|key|authorization|cookie|header|body|content|credential)/i;

function safeValue(value: unknown, key = '', depth = 0): unknown {
  if (sensitiveKey.test(key)) return undefined;
  if (depth > 3) return '[truncated]';
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return typeof value === 'string' && value.length > 256 ? `${value.slice(0, 256)}…` : value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeValue(item, '', depth + 1)).filter((item) => item !== undefined);
  if (typeof value === 'object') {
    const result: LogMetadata = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const safe = safeValue(childValue, childKey, depth + 1);
      if (safe !== undefined) result[childKey] = safe;
    }
    return result;
  }
  return undefined;
}

function write(level: LogLevel, event: string, requestId?: string, metadata: LogMetadata = {}): void {
  const entry = safeValue({ timestamp: new Date().toISOString(), level, event, ...metadata, requestId: requestId ?? 'system' }) as LogMetadata;
  const output = JSON.stringify(entry);
  console[level](output);
}

export const logger = {
  debug: (event: string, metadata?: LogMetadata, requestId?: string) => write('debug', event, requestId, metadata),
  info: (event: string, metadata?: LogMetadata, requestId?: string) => write('info', event, requestId, metadata),
  warn: (event: string, metadata?: LogMetadata, requestId?: string) => write('warn', event, requestId, metadata),
  error: (event: string, metadata?: LogMetadata, requestId?: string) => write('error', event, requestId, metadata),
};

export function requestLogContext(request: Request): string | undefined {
  return request.requestId;
}

export default logger;
