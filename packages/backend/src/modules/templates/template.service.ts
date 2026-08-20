import { Prisma, PrismaClient } from '@prisma/client';

import prisma from '../../lib/prisma';

export type TemplateErrorCode =
  | 'VALIDATION_ERROR'
  | 'TEMPLATE_NOT_FOUND'
  | 'BUSINESS_RULE_VIOLATION';

export class TemplateError extends Error {
  public readonly code: TemplateErrorCode;
  public readonly statusCode: number;
  public readonly status: number;

  public constructor(code: TemplateErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'TemplateError';
    this.code = code;
    this.statusCode = statusCode;
    this.status = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface CreateTemplateInput {
  title: string;
  body: string;
  categoryId?: string;
}

export interface UpdateTemplateInput {
  title?: string;
  body?: string;
  categoryId?: string | null;
}

function validateContent(value: unknown, field: 'title' | 'body', maximum: number): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !/\S/.test(value)) {
    throw new TemplateError(
      'VALIDATION_ERROR',
      `Template ${field} must be between 1 and ${maximum} characters and contain non-whitespace characters`,
      400,
    );
  }

  return value;
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

export class TemplateService {
  public constructor(private readonly database: PrismaClient = prisma) {}

  public async createTemplate(input: CreateTemplateInput) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TemplateError('VALIDATION_ERROR', 'Template title and body are required', 400);
    }

    const title = validateContent(input.title, 'title', 100);
    const body = validateContent(input.body, 'body', 500);
    const categoryId = await this.validateCategory(input.categoryId);
    return this.database.template.create({ data: { title, body, categoryId }, include: { category: true } });
  }

  public async listTemplates() {
    return this.database.template.findMany({ include: { category: true }, orderBy: [{ isDefault: 'desc' }, { title: 'asc' }] });
  }

  public async updateTemplate(id: string, input: UpdateTemplateInput) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
      throw new TemplateError('VALIDATION_ERROR', 'At least one template field is required', 400);
    }

    const data: { title?: string; body?: string; categoryId?: string | null } = {};
    if (input.title !== undefined) data.title = validateContent(input.title, 'title', 100);
    if (input.body !== undefined) data.body = validateContent(input.body, 'body', 500);
    if (input.categoryId !== undefined) data.categoryId = await this.validateCategory(input.categoryId);

    try {
      return await this.database.template.update({ where: { id }, data, include: { category: true } });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new TemplateError('TEMPLATE_NOT_FOUND', 'Template not found', 404);
      }
      throw error;
    }
  }

  private async validateCategory(categoryId: string | null | undefined): Promise<string | null> {
    if (!categoryId) return null;
    const category = await this.database.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new TemplateError('VALIDATION_ERROR', 'Category not found', 400);
    return category.id;
  }

  public async deleteTemplate(id: string): Promise<void> {
    const template = await this.database.template.findUnique({ where: { id } });
    if (!template) {
      throw new TemplateError('TEMPLATE_NOT_FOUND', 'Template not found', 404);
    }
    if (template.isDefault) {
      throw new TemplateError(
        'BUSINESS_RULE_VIOLATION',
        'Default templates cannot be deleted',
        409,
      );
    }

    try {
      await this.database.template.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new TemplateError('TEMPLATE_NOT_FOUND', 'Template not found', 404);
      }
      throw error;
    }
  }
}

export default new TemplateService();
