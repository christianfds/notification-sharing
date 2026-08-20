import { Router, Response } from 'express';
import { UserRole } from '@prisma/client';

import authMiddleware from '../../middleware/auth.middleware';
import requireRole from '../../middleware/role.middleware';
import templateService, {
  TemplateError,
  TemplateService,
  CreateTemplateInput,
  UpdateTemplateInput,
} from './template.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validationError(message: string): TemplateError {
  return new TemplateError('VALIDATION_ERROR', message, 400);
}

function parseCreateBody(body: unknown): CreateTemplateInput {
  if (!isRecord(body) || typeof body.title !== 'string' || typeof body.body !== 'string') {
    throw validationError('Template title and body are required');
  }

  return { title: body.title, body: body.body };
}

function parseUpdateBody(body: unknown): UpdateTemplateInput {
  if (!isRecord(body)) throw validationError('Request body must be an object');

  const input: UpdateTemplateInput = {};
  if ('title' in body) {
    if (typeof body.title !== 'string') throw validationError('Template title must be a string');
    input.title = body.title;
  }
  if ('body' in body) {
    if (typeof body.body !== 'string') throw validationError('Template body must be a string');
    input.body = body.body;
  }
  if (Object.keys(input).length === 0) throw validationError('At least one template field is required');

  return input;
}

function sendTemplateError(res: Response, error: unknown): void {
  if (error instanceof TemplateError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }

  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
}

export interface TemplateRouterDependencies {
  templateService?: TemplateService;
}

export function createTemplateRouter({
  templateService: service = templateService,
}: TemplateRouterDependencies = {}): Router {
  const router = Router();

  router.use(authMiddleware, requireRole(UserRole.SECRETARY, UserRole.ADMIN));

  router.get('/', async (_req, res) => {
    try {
      res.status(200).json(await service.listTemplates());
    } catch (error) {
      sendTemplateError(res, error);
    }
  });

  router.post('/', async (req, res) => {
    try {
      res.status(201).json(await service.createTemplate(parseCreateBody(req.body)));
    } catch (error) {
      sendTemplateError(res, error);
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      res.status(200).json(await service.updateTemplate(req.params.id, parseUpdateBody(req.body)));
    } catch (error) {
      sendTemplateError(res, error);
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await service.deleteTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      sendTemplateError(res, error);
    }
  });

  return router;
}

export default createTemplateRouter;
