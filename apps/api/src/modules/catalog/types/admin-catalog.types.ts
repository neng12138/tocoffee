import type { CategoryStatus, ProductStatus } from '@prisma/client';

export interface AdminCategoryPublic {
  id: string;
  name: string;
  sort: number;
  status: CategoryStatus;
  productCount: number;
}

export interface AdminSpecOptionPublic {
  id: string;
  groupId: string;
  name: string;
  priceDeltaCents: number;
  isDefault: boolean;
  isAvailable: boolean;
  sort: number;
}

export interface AdminSpecGroupPublic {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelect: number;
  maxSelect: number;
  sort: number;
  productCount: number;
  options: AdminSpecOptionPublic[];
}

export interface AdminProductSpecGroupPublic {
  id: string;
  name: string;
}

export interface AdminProductPublic {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePriceCents: number;
  tags: string[];
  status: ProductStatus;
  sort: number;
  category: {
    id: string;
    name: string;
  };
  specGroups: AdminProductSpecGroupPublic[];
  updatedAt: string;
}

export interface AdminProductDetailPublic extends AdminProductPublic {
  categoryId: string;
  specGroupIds: string[];
}
