import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/errors/error-codes.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../dto/admin-category.dto.js';
import type {
  CreateProductDto,
  UpdateProductDto,
} from '../dto/admin-product.dto.js';
import type {
  CreateSpecGroupDto,
  CreateSpecOptionDto,
  UpdateSpecGroupDto,
  UpdateSpecOptionDto,
} from '../dto/admin-spec.dto.js';
import {
  toAdminCategory,
  toAdminProduct,
  toAdminProductDetail,
  toAdminSpecGroup,
  toAdminSpecOption,
} from '../mappers/admin-catalog.mapper.js';
import type {
  AdminCategoryPublic,
  AdminProductDetailPublic,
  AdminProductPublic,
  AdminSpecGroupPublic,
  AdminSpecOptionPublic,
} from '../types/admin-catalog.types.js';

const categoryInclude = {
  _count: { select: { products: true } },
} satisfies Prisma.CategoryInclude;

const productInclude = {
  category: { select: { id: true, name: true } },
  specGroups: {
    orderBy: { sort: 'asc' },
    include: { group: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ProductInclude;

const specGroupInclude = {
  options: { orderBy: { sort: 'asc' } },
  _count: { select: { products: true } },
} satisfies Prisma.SpecGroupInclude;

interface ProductListQuery {
  categoryId?: string;
  status?: 'ON_SALE' | 'SOLD_OUT' | 'OFF_SHELF';
  keyword?: string;
}

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(storeId: string): Promise<AdminCategoryPublic[]> {
    const categories = await this.prisma.category.findMany({
      where: { storeId },
      include: categoryInclude,
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });

    return categories.map(toAdminCategory);
  }

  async createCategory(
    storeId: string,
    dto: CreateCategoryDto,
  ): Promise<AdminCategoryPublic> {
    await this.assertCategoryNameAvailable(storeId, dto.name);

    const category = await this.prisma.category.create({
      data: {
        storeId,
        name: dto.name,
        sort: dto.sort ?? 0,
        status: dto.status ?? 'ACTIVE',
      },
      include: categoryInclude,
    });

    return toAdminCategory(category);
  }

  async updateCategory(
    storeId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<AdminCategoryPublic> {
    await this.getCategoryOrThrow(storeId, categoryId);

    if (dto.name !== undefined) {
      await this.assertCategoryNameAvailable(storeId, dto.name, categoryId);
    }

    const category = await this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.sort === undefined ? {} : { sort: dto.sort }),
        ...(dto.status === undefined ? {} : { status: dto.status }),
      },
      include: categoryInclude,
    });

    return toAdminCategory(category);
  }

  async archiveCategory(storeId: string, categoryId: string): Promise<void> {
    await this.getCategoryOrThrow(storeId, categoryId);

    await this.prisma.category.update({
      where: { id: categoryId },
      data: { status: 'DISABLED' },
    });
  }

  async listProducts(
    storeId: string,
    query: ProductListQuery,
  ): Promise<AdminProductPublic[]> {
    const where: Prisma.ProductWhereInput = { storeId };

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
    });

    return products.map(toAdminProduct);
  }

  async getProduct(
    storeId: string,
    productId: string,
  ): Promise<AdminProductDetailPublic> {
    const product = await this.getProductOrThrow(storeId, productId);
    return toAdminProductDetail(product);
  }

  async createProduct(
    storeId: string,
    dto: CreateProductDto,
  ): Promise<AdminProductDetailPublic> {
    await this.getCategoryOrThrow(storeId, dto.categoryId);
    const specGroupIds = await this.validateSpecGroups(
      storeId,
      dto.specGroupIds ?? [],
    );

    const product = await this.prisma.product.create({
      data: {
        storeId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        basePriceCents: dto.basePriceCents,
        tags: dto.tags ?? [],
        status: dto.status ?? 'ON_SALE',
        sort: dto.sort ?? 0,
        ...(specGroupIds.length
          ? {
              specGroups: {
                create: specGroupIds.map((groupId, index) => ({
                  groupId,
                  sort: index,
                })),
              },
            }
          : {}),
      },
    });

    return this.getProduct(storeId, product.id);
  }

  async updateProduct(
    storeId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<AdminProductDetailPublic> {
    await this.getProductOrThrow(storeId, productId);

    if (dto.categoryId !== undefined) {
      await this.getCategoryOrThrow(storeId, dto.categoryId);
    }

    const specGroupIds =
      dto.specGroupIds === undefined
        ? undefined
        : await this.validateSpecGroups(storeId, dto.specGroupIds);

    const data: Prisma.ProductUncheckedUpdateInput = {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.categoryId === undefined ? {} : { categoryId: dto.categoryId }),
      ...(dto.description === undefined
        ? {}
        : { description: dto.description }),
      ...(dto.imageUrl === undefined ? {} : { imageUrl: dto.imageUrl }),
      ...(dto.basePriceCents === undefined
        ? {}
        : { basePriceCents: dto.basePriceCents }),
      ...(dto.tags === undefined ? {} : { tags: dto.tags }),
      ...(dto.status === undefined ? {} : { status: dto.status }),
      ...(dto.sort === undefined ? {} : { sort: dto.sort }),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data });

      if (specGroupIds !== undefined) {
        await tx.productSpecGroup.deleteMany({ where: { productId } });
        if (specGroupIds.length) {
          await tx.productSpecGroup.createMany({
            data: specGroupIds.map((groupId, index) => ({
              productId,
              groupId,
              sort: index,
            })),
          });
        }
      }
    });

    return this.getProduct(storeId, productId);
  }

  async updateProductStatus(
    storeId: string,
    productId: string,
    status: 'ON_SALE' | 'SOLD_OUT' | 'OFF_SHELF',
  ): Promise<AdminProductDetailPublic> {
    await this.getProductOrThrow(storeId, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: { status },
    });

    return this.getProduct(storeId, productId);
  }

  async archiveProduct(storeId: string, productId: string): Promise<void> {
    await this.getProductOrThrow(storeId, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: { status: 'OFF_SHELF' },
    });
  }

  async listSpecGroups(storeId: string): Promise<AdminSpecGroupPublic[]> {
    const groups = await this.prisma.specGroup.findMany({
      where: { storeId },
      include: specGroupInclude,
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });

    return groups.map(toAdminSpecGroup);
  }

  async createSpecGroup(
    storeId: string,
    dto: CreateSpecGroupDto,
  ): Promise<AdminSpecGroupPublic> {
    await this.assertSpecGroupNameAvailable(storeId, dto.name);
    const selection = this.normalizeSelection(dto);

    const group = await this.prisma.specGroup.create({
      data: {
        storeId,
        name: dto.name,
        sort: dto.sort ?? 0,
        ...selection,
      },
      include: specGroupInclude,
    });

    return toAdminSpecGroup(group);
  }

  async updateSpecGroup(
    storeId: string,
    groupId: string,
    dto: UpdateSpecGroupDto,
  ): Promise<AdminSpecGroupPublic> {
    const group = await this.getSpecGroupOrThrow(storeId, groupId);

    if (dto.name !== undefined) {
      await this.assertSpecGroupNameAvailable(storeId, dto.name, groupId);
    }

    const selection = this.normalizeSelection({
      required: dto.required ?? group.required,
      multiSelect: dto.multiSelect ?? group.multiSelect,
      minSelect: dto.minSelect ?? group.minSelect,
      maxSelect: dto.maxSelect ?? group.maxSelect,
    });

    const updated = await this.prisma.specGroup.update({
      where: { id: groupId },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.sort === undefined ? {} : { sort: dto.sort }),
        ...selection,
      },
      include: specGroupInclude,
    });

    return toAdminSpecGroup(updated);
  }

  async deleteSpecGroup(storeId: string, groupId: string): Promise<void> {
    await this.getSpecGroupOrThrow(storeId, groupId);

    const references = await this.prisma.productSpecGroup.count({
      where: { groupId },
    });
    if (references > 0) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        '该规格组仍被商品使用，请先从商品中移除',
        409,
      );
    }

    await this.prisma.specGroup.delete({ where: { id: groupId } });
  }

  async createSpecOption(
    storeId: string,
    groupId: string,
    dto: CreateSpecOptionDto,
  ): Promise<AdminSpecOptionPublic> {
    await this.getSpecGroupOrThrow(storeId, groupId);

    if (dto.isDefault) {
      await this.clearDefaults(groupId);
    }

    const option = await this.prisma.specOption.create({
      data: {
        groupId,
        name: dto.name,
        priceDeltaCents: dto.priceDeltaCents ?? 0,
        isDefault: dto.isDefault ?? false,
        isAvailable: dto.isAvailable ?? true,
        sort: dto.sort ?? 0,
      },
    });

    return toAdminSpecOption(option);
  }

  async updateSpecOption(
    storeId: string,
    optionId: string,
    dto: UpdateSpecOptionDto,
  ): Promise<AdminSpecOptionPublic> {
    const option = await this.getSpecOptionOrThrow(storeId, optionId);

    if (
      dto.isAvailable === false &&
      option.isAvailable &&
      (await this.isLastAvailableOption(option.groupId, optionId))
    ) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        '规格组至少需要保留一个可用选项',
        409,
      );
    }

    if (dto.isDefault === true) {
      await this.clearDefaults(option.groupId, optionId);
    }

    const updated = await this.prisma.specOption.update({
      where: { id: optionId },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.priceDeltaCents === undefined
          ? {}
          : { priceDeltaCents: dto.priceDeltaCents }),
        ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault }),
        ...(dto.isAvailable === undefined
          ? {}
          : { isAvailable: dto.isAvailable }),
        ...(dto.sort === undefined ? {} : { sort: dto.sort }),
      },
    });

    return toAdminSpecOption(updated);
  }

  async deleteSpecOption(storeId: string, optionId: string): Promise<void> {
    const option = await this.getSpecOptionOrThrow(storeId, optionId);

    if (await this.isLastAvailableOption(option.groupId, optionId)) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        '规格组至少需要保留一个可用选项',
        409,
      );
    }

    await this.prisma.specOption.delete({ where: { id: optionId } });
  }

  private async assertCategoryNameAvailable(
    storeId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.category.findFirst({
      where: {
        storeId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new AppError(ERROR_CODES.CONFLICT, '分类名称已存在', 409);
    }
  }

  private async assertSpecGroupNameAvailable(
    storeId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.specGroup.findFirst({
      where: {
        storeId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new AppError(ERROR_CODES.CONFLICT, '规格组名称已存在', 409);
    }
  }

  private async getCategoryOrThrow(storeId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, storeId },
      include: categoryInclude,
    });

    if (!category) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '分类不存在', 404);
    }

    return category;
  }

  private async getProductOrThrow(storeId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId },
      include: productInclude,
    });

    if (!product) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '商品不存在', 404);
    }

    return product;
  }

  private async getSpecGroupOrThrow(storeId: string, groupId: string) {
    const group = await this.prisma.specGroup.findFirst({
      where: { id: groupId, storeId },
      include: specGroupInclude,
    });

    if (!group) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '规格组不存在', 404);
    }

    return group;
  }

  private async getSpecOptionOrThrow(storeId: string, optionId: string) {
    const option = await this.prisma.specOption.findFirst({
      where: {
        id: optionId,
        group: { storeId },
      },
    });

    if (!option) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '规格选项不存在', 404);
    }

    return option;
  }

  private async validateSpecGroups(
    storeId: string,
    specGroupIds: string[],
  ): Promise<string[]> {
    const uniqueIds = [...new Set(specGroupIds)];
    if (!uniqueIds.length) {
      return [];
    }

    const groups = await this.prisma.specGroup.findMany({
      where: { storeId, id: { in: uniqueIds } },
      include: {
        options: {
          where: { isAvailable: true },
          select: { id: true },
        },
      },
    });

    if (groups.length !== uniqueIds.length) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        '存在不属于当前门店的规格组',
        400,
      );
    }

    const emptyGroup = groups.find((group) => group.options.length === 0);
    if (emptyGroup) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        `规格组「${emptyGroup.name}」没有可用选项`,
        400,
      );
    }

    return uniqueIds;
  }

  private normalizeSelection(input: {
    required?: boolean;
    multiSelect?: boolean;
    minSelect?: number;
    maxSelect?: number;
  }): {
    required: boolean;
    multiSelect: boolean;
    minSelect: number;
    maxSelect: number;
  } {
    const required = input.required ?? true;
    const multiSelect = input.multiSelect ?? false;
    const maxSelect = multiSelect ? (input.maxSelect ?? 1) : 1;
    let minSelect = multiSelect
      ? (input.minSelect ?? (required ? 1 : 0))
      : required
        ? 1
        : 0;

    if (required && minSelect < 1) {
      minSelect = 1;
    }
    if (minSelect > maxSelect) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        '最少选择数不能大于最多选择数',
        400,
      );
    }

    return { required, multiSelect, minSelect, maxSelect };
  }

  private async clearDefaults(
    groupId: string,
    exceptOptionId?: string,
  ): Promise<void> {
    await this.prisma.specOption.updateMany({
      where: {
        groupId,
        isDefault: true,
        ...(exceptOptionId ? { id: { not: exceptOptionId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  private async isLastAvailableOption(
    groupId: string,
    optionId: string,
  ): Promise<boolean> {
    const option = await this.prisma.specOption.findUnique({
      where: { id: optionId },
      select: { isAvailable: true },
    });
    if (!option?.isAvailable) {
      return false;
    }

    const [availableCount, references] = await Promise.all([
      this.prisma.specOption.count({
        where: { groupId, isAvailable: true },
      }),
      this.prisma.productSpecGroup.count({ where: { groupId } }),
    ]);

    return availableCount <= 1 && references > 0;
  }
}
