import type {
  CategoryStatus,
  ProductStatus,
  SpecOption,
} from '@prisma/client';
import type {
  AdminCategoryPublic,
  AdminProductDetailPublic,
  AdminProductPublic,
  AdminSpecGroupPublic,
  AdminSpecOptionPublic,
} from '../types/admin-catalog.types.js';

interface CategorySource {
  id: string;
  name: string;
  sort: number;
  status: CategoryStatus;
  _count: {
    products: number;
  };
}

interface ProductSpecGroupSource {
  group: {
    id: string;
    name: string;
  };
}

interface ProductSource {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePriceCents: number;
  tags: unknown;
  status: ProductStatus;
  sort: number;
  categoryId: string;
  category: {
    id: string;
    name: string;
  };
  specGroups: ProductSpecGroupSource[];
  updatedAt: Date;
}

interface SpecGroupSource {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: number;
  maxSelect: number;
  sort: number;
  options: SpecOption[];
  _count: {
    products: number;
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function baseProductFields(product: ProductSource): AdminProductPublic {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    basePriceCents: product.basePriceCents,
    tags: toStringArray(product.tags),
    status: product.status,
    sort: product.sort,
    category: product.category,
    specGroups: product.specGroups.map((item) => item.group),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function toAdminCategory(
  category: CategorySource,
): AdminCategoryPublic {
  return {
    id: category.id,
    name: category.name,
    sort: category.sort,
    status: category.status,
    productCount: category._count.products,
  };
}

export function toAdminProduct(product: ProductSource): AdminProductPublic {
  return baseProductFields(product);
}

export function toAdminProductDetail(
  product: ProductSource,
): AdminProductDetailPublic {
  return {
    ...baseProductFields(product),
    categoryId: product.categoryId,
    specGroupIds: product.specGroups.map((item) => item.group.id),
  };
}

export function toAdminSpecOption(option: SpecOption): AdminSpecOptionPublic {
  return {
    id: option.id,
    groupId: option.groupId,
    name: option.name,
    priceDeltaCents: option.priceDeltaCents,
    isDefault: option.isDefault,
    isAvailable: option.isAvailable,
    sort: option.sort,
  };
}

export function toAdminSpecGroup(
  group: SpecGroupSource,
): AdminSpecGroupPublic {
  return {
    id: group.id,
    name: group.name,
    required: group.required,
    multiSelect: group.multiSelect,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    sort: group.sort,
    productCount: group._count.products,
    options: group.options.map(toAdminSpecOption),
  };
}
