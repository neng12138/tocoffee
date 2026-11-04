import type { ProductStatus } from '@prisma/client';
import type {
  MenuCategoryPublic,
  ProductDetailPublic,
  ProductPublic,
  SpecGroupPublic,
  SpecOptionPublic,
} from '../types/catalog.types.js';

interface SpecOptionSource {
  id: string;
  name: string;
  priceDeltaCents: number;
  isDefault: boolean;
  isAvailable: boolean;
}

interface SpecGroupSource {
  group: {
    id: string;
    name: string;
    required: boolean;
    multiSelect: boolean;
    minSelect: number;
    maxSelect: number;
    options: SpecOptionSource[];
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
  specGroups: SpecGroupSource[];
}

interface ProductDetailSource extends ProductSource {
  category: {
    id: string;
    name: string;
  };
}

interface MenuCategorySource {
  id: string;
  name: string;
  products: ProductSource[];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function toSpecOption(option: SpecOptionSource): SpecOptionPublic {
  return {
    id: option.id,
    name: option.name,
    priceDeltaCents: option.priceDeltaCents,
    isDefault: option.isDefault,
  };
}

function toSpecGroup(source: SpecGroupSource): SpecGroupPublic {
  return {
    id: source.group.id,
    name: source.group.name,
    required: source.group.required,
    multiSelect: source.group.multiSelect,
    minSelect: source.group.minSelect,
    maxSelect: source.group.maxSelect,
    options: source.group.options
      .filter((option) => option.isAvailable)
      .map(toSpecOption),
  };
}

export function toProductPublic(product: ProductSource): ProductPublic {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    basePriceCents: product.basePriceCents,
    tags: toStringArray(product.tags),
    status: product.status,
    specGroups: product.specGroups.map(toSpecGroup),
  };
}

export function toProductDetail(
  product: ProductDetailSource,
): ProductDetailPublic {
  return {
    ...toProductPublic(product),
    category: product.category,
  };
}

export function toMenuCategory(
  category: MenuCategorySource,
): MenuCategoryPublic {
  return {
    id: category.id,
    name: category.name,
    products: category.products.map(toProductPublic),
  };
}
