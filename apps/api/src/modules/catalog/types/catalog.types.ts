import type { ProductStatus } from '@prisma/client';

export interface SpecOptionPublic {
  id: string;
  name: string;
  priceDeltaCents: number;
  isDefault: boolean;
}

export interface SpecGroupPublic {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: number;
  maxSelect: number;
  options: SpecOptionPublic[];
}

export interface ProductPublic {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePriceCents: number;
  tags: string[];
  status: ProductStatus;
  specGroups: SpecGroupPublic[];
}

export interface ProductDetailPublic extends ProductPublic {
  category: {
    id: string;
    name: string;
  };
}

export interface MenuCategoryPublic {
  id: string;
  name: string;
  products: ProductPublic[];
}

export interface MenuPublic {
  categories: MenuCategoryPublic[];
}
