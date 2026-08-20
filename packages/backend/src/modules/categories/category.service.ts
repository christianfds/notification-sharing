import { Prisma, PrismaClient } from '@prisma/client';

import prisma from '../../lib/prisma';

export type CategoryErrorCode =
  | 'INVALID_CATEGORY_NAME'
  | 'CATEGORY_NAME_EXISTS'
  | 'CATEGORY_NOT_FOUND';

/** Error shape intended to be mapped directly by an HTTP router. */
export class CategoryError extends Error {
  public readonly code: CategoryErrorCode;
  public readonly statusCode: number;
  public readonly status: number;

  public constructor(code: CategoryErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'CategoryError';
    this.code = code;
    this.statusCode = statusCode;
    this.status = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface CategoryInput {
  name: string;
}

function normalizeName(value: string): { name: string; displayName: string } {
  const displayName = value.trim();

  if (displayName.length < 1 || displayName.length > 50 || !/\S/.test(displayName)) {
    throw new CategoryError(
      'INVALID_CATEGORY_NAME',
      'Category name must be between 1 and 50 characters and contain non-whitespace characters',
      400,
    );
  }

  return { name: displayName.toLowerCase(), displayName };
}

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export class CategoryService {
  public constructor(private readonly database: PrismaClient = prisma) {}

  public async createCategory(input: CategoryInput | string) {
    const value = typeof input === 'string' ? input : input?.name;
    if (typeof value !== 'string') {
      throw new CategoryError('INVALID_CATEGORY_NAME', 'Category name is required', 400);
    }

    const normalized = normalizeName(value);
    try {
      return await this.database.category.create({ data: normalized });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new CategoryError('CATEGORY_NAME_EXISTS', 'Category name already exists', 409);
      }
      throw error;
    }
  }

  public async listCategories() {
    return this.database.category.findMany({ orderBy: { name: 'asc' } });
  }

  public async updateCategory(id: string, input: CategoryInput | string) {
    const value = typeof input === 'string' ? input : input?.name;
    if (typeof value !== 'string') {
      throw new CategoryError('INVALID_CATEGORY_NAME', 'Category name is required', 400);
    }

    const normalized = normalizeName(value);
    try {
      return await this.database.category.update({ where: { id }, data: normalized });
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        throw new CategoryError('CATEGORY_NAME_EXISTS', 'Category name already exists', 409);
      }
      if (isPrismaError(error, 'P2025')) {
        throw new CategoryError('CATEGORY_NOT_FOUND', 'Category not found', 404);
      }
      throw error;
    }
  }

  public async deleteCategory(id: string): Promise<void> {
    try {
      await this.database.category.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new CategoryError('CATEGORY_NOT_FOUND', 'Category not found', 404);
      }
      throw error;
    }
  }
}

export default new CategoryService();
