import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';

import authMiddleware from '../../middleware/auth.middleware';
import requireRole from '../../middleware/role.middleware';
import categoryService, { CategoryError, CategoryService } from './category.service';
import { broadcastCategoryOrderUpdated } from '../websocket/websocket.server';

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
      const category = await service.createCategory({ name: getCategoryName(req) as string });
      broadcastCategoryOrderUpdated((await service.listCategories()).map((item) => item.id));
      res.status(201).json(category);
    } catch (error) {
      sendCategoryError(res, error);
    }
  });

  router.patch('/order', async (req, res) => {
    try {
      if (!Array.isArray(req.body?.categoryIds) || !req.body.categoryIds.every((id: unknown) => typeof id === 'string')) {
        throw new CategoryError('INVALID_CATEGORY_NAME', 'categoryIds must be an array', 400);
      }
      const categories = await service.reorderCategories(req.body.categoryIds);
      broadcastCategoryOrderUpdated(categories.map((category) => category.id));
      res.status(200).json(categories);
    } catch (error) {
      sendCategoryError(res, error);
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const category = await service.updateCategory(req.params.id, { name: getCategoryName(req) as string });
      broadcastCategoryOrderUpdated((await service.listCategories()).map((item) => item.id));
      res.status(200).json(category);
    } catch (error) {
      sendCategoryError(res, error);
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await service.deleteCategory(req.params.id);
      broadcastCategoryOrderUpdated((await service.listCategories()).map((item) => item.id));
      res.status(204).send();
    } catch (error) {
      sendCategoryError(res, error);
    }
  });

  return router;
}

export default createCategoryRouter;
