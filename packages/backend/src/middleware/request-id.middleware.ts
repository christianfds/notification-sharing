import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

import logger from '../lib/logger';

export default function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  const startedAt = process.hrtime.bigint();

  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.info('http.request.completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    }, requestId);
  });
  next();
}
