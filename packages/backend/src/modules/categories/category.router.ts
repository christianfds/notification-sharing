import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';

import authMiddleware from '../../middleware/auth.middleware';
import requireRole from '../../middleware/role.middleware';
import categoryService, { CategoryError, CategoryService } from './category.service';

function sendCategoryError(res: Response, error: unknown): void {
  if (error instanceof CategoryError) {
    res.status(error.statusCode).json({ error: error.code, message: error.message });
    return;
  }

  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
}

function getCategoryName(req: Request): unknown {
  const body = req.body;
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    ? (body as { name?: unknown }).name
    : undefined;
}

export interface CategoryRouterDependencies {
  categoryService?: CategoryService;
}

export function createCategoryRouter({
  categoryService: service = categoryService,
}: CategoryRouterDependencies = {}): Router {
  const router = Router();

  router.use(authMiddleware, requireRole(UserRole.SECRETARY, UserRole.ADMIN));

  router.get('/', async (_req, res) => {
    try {
      res.status(200).json(await service.listCategories());
    } catch (error) {
      sendCategoryError(res, error);
    }
  });

  router.post('/', async (req, res) => {
    try {
      res.status(201).json(await service.createCategory({ name: getCategoryName(req) as string }));
    } catch (error) {
      sendCategoryError(res, error);
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      res.status(200).json(await service.updateCategory(req.params.id, { name: getCategoryName(req) as string }));
    } catch (error) {
      sendCategoryError(res, error);
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await service.deleteCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      sendCategoryError(res, error);
    }
  });

  return router;
}

export default createCategoryRouter;
