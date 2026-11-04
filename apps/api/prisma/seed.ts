import {
  CategoryStatus,
  PrismaClient,
  ProductStatus,
  StaffRole,
  StaffStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, '../assets/seed');
const uploadsDir = resolve(here, '../uploads/seed');
const publicBaseUrl = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const STORE_ID = uuid(1);
const OWNER_ID = uuid(2);

const categories = [
  { id: uuid(101), name: '招牌咖啡', sort: 1 },
  { id: uuid(102), name: '经典咖啡', sort: 2 },
  { id: uuid(103), name: '非咖啡', sort: 3 },
  { id: uuid(104), name: '茶饮', sort: 4 },
  { id: uuid(105), name: '小食', sort: 5 },
] as const;

const specGroups = [
  {
    id: uuid(301),
    name: '杯型',
    required: true,
    multiSelect: false,
    minSelect: 1,
    maxSelect: 1,
    sort: 1,
    options: [
      { id: uuid(401), name: '中杯', priceDeltaCents: 0, isDefault: true, sort: 1 },
      { id: uuid(402), name: '大杯', priceDeltaCents: 300, isDefault: false, sort: 2 },
    ],
  },
  {
    id: uuid(302),
    name: '温度',
    required: true,
    multiSelect: false,
    minSelect: 1,
    maxSelect: 1,
    sort: 2,
    options: [
      { id: uuid(403), name: '热', priceDeltaCents: 0, isDefault: true, sort: 1 },
      { id: uuid(404), name: '冰', priceDeltaCents: 0, isDefault: false, sort: 2 },
      { id: uuid(405), name: '少冰', priceDeltaCents: 0, isDefault: false, sort: 3 },
      { id: uuid(406), name: '去冰', priceDeltaCents: 0, isDefault: false, sort: 4 },
    ],
  },
  {
    id: uuid(303),
    name: '糖度',
    required: true,
    multiSelect: false,
    minSelect: 1,
    maxSelect: 1,
    sort: 3,
    options: [
      { id: uuid(407), name: '标准', priceDeltaCents: 0, isDefault: true, sort: 1 },
      { id: uuid(408), name: '少糖', priceDeltaCents: 0, isDefault: false, sort: 2 },
      { id: uuid(409), name: '无糖', priceDeltaCents: 0, isDefault: false, sort: 3 },
    ],
  },
  {
    id: uuid(304),
    name: '奶基',
    required: true,
    multiSelect: false,
    minSelect: 1,
    maxSelect: 1,
    sort: 4,
    options: [
      { id: uuid(410), name: '牛奶', priceDeltaCents: 0, isDefault: true, sort: 1 },
      { id: uuid(411), name: '燕麦奶', priceDeltaCents: 300, isDefault: false, sort: 2 },
      { id: uuid(412), name: '椰奶', priceDeltaCents: 0, isDefault: false, sort: 3 },
    ],
  },
  {
    id: uuid(305),
    name: '加料',
    required: false,
    multiSelect: true,
    minSelect: 0,
    maxSelect: 3,
    sort: 5,
    options: [
      { id: uuid(413), name: '浓缩', priceDeltaCents: 400, isDefault: false, sort: 1 },
      { id: uuid(414), name: '奶油', priceDeltaCents: 300, isDefault: false, sort: 2 },
      { id: uuid(415), name: '糖浆', priceDeltaCents: 200, isDefault: false, sort: 3 },
    ],
  },
] as const;

const products = [
  {
    id: uuid(201),
    categoryIndex: 0,
    name: '生椰拿铁',
    description: '椰乳与浓缩咖啡，招牌热销。',
    priceCents: 2200,
    tags: ['招牌', '热销'],
    groupIndexes: [0, 1, 2, 3, 4],
    sort: 1,
  },
  {
    id: uuid(202),
    categoryIndex: 0,
    name: '焦糖玛奇朵',
    description: '焦糖甜香与奶泡，口感柔和。',
    priceCents: 2500,
    tags: ['招牌'],
    groupIndexes: [0, 1, 2, 3, 4],
    sort: 2,
  },
  {
    id: uuid(203),
    categoryIndex: 0,
    name: '燕麦拿铁',
    description: '燕麦奶的谷物香气，清爽不腻。',
    priceCents: 2400,
    tags: ['热销'],
    groupIndexes: [0, 1, 2, 3, 4],
    sort: 3,
  },
  {
    id: uuid(204),
    categoryIndex: 1,
    name: '美式',
    description: '浓缩加水，干净利落。',
    priceCents: 1500,
    tags: [],
    groupIndexes: [0, 1, 4],
    sort: 1,
  },
  {
    id: uuid(205),
    categoryIndex: 1,
    name: '拿铁',
    description: '浓缩与牛奶的经典比例。',
    priceCents: 1800,
    tags: ['热销'],
    groupIndexes: [0, 1, 2, 3, 4],
    sort: 2,
  },
  {
    id: uuid(206),
    categoryIndex: 1,
    name: '卡布奇诺',
    description: '厚奶泡与浓缩，口感饱满。',
    priceCents: 1800,
    tags: [],
    groupIndexes: [0, 1, 2, 3, 4],
    sort: 3,
  },
  {
    id: uuid(207),
    categoryIndex: 1,
    name: '摩卡',
    description: '巧克力与咖啡，甜感明显。',
    priceCents: 2200,
    tags: [],
    groupIndexes: [0, 1, 2, 3, 4],
    sort: 4,
  },
  {
    id: uuid(208),
    categoryIndex: 2,
    name: '抹茶拿铁',
    description: '抹茶与牛奶，清新回甘。',
    priceCents: 2200,
    tags: [],
    groupIndexes: [0, 1, 2, 3, 4],
    sort: 1,
  },
  {
    id: uuid(209),
    categoryIndex: 2,
    name: '热巧克力',
    description: '可可与牛奶，温暖浓郁。',
    priceCents: 2000,
    tags: [],
    groupIndexes: [0, 1, 4],
    sort: 2,
  },
  {
    id: uuid(210),
    categoryIndex: 3,
    name: '柠檬茶',
    description: '鲜柠檬与茶底，酸甜清爽。',
    priceCents: 1600,
    tags: ['新品'],
    groupIndexes: [0, 1, 2],
    sort: 1,
  },
  {
    id: uuid(211),
    categoryIndex: 3,
    name: '白桃乌龙',
    description: '白桃香气与乌龙茶底。',
    priceCents: 1800,
    tags: ['新品'],
    groupIndexes: [0, 1, 2],
    sort: 2,
  },
  {
    id: uuid(212),
    categoryIndex: 4,
    name: '可颂',
    description: '黄油可颂，现烤加热。',
    priceCents: 1200,
    tags: [],
    groupIndexes: [],
    sort: 1,
  },
] as const;

const seedImages = ['coffee-1.png', 'coffee-2.png', 'coffee-3.png'];

async function copySeedImages(): Promise<void> {
  await mkdir(uploadsDir, { recursive: true });
  for (const file of seedImages) {
    const source = join(assetsDir, file);
    if (!existsSync(source)) {
      throw new Error(`Seed image missing: ${source}`);
    }
    await copyFile(source, join(uploadsDir, file));
  }
}

async function seedStore(): Promise<void> {
  await prisma.store.upsert({
    where: { id: STORE_ID },
    update: {
      name: 'ToCoffee 示例店',
      address: '广州市天河区示例路 88 号',
      phone: '020-00000000',
      businessHours: [
        { day: 1, open: '08:00', close: '20:00' },
        { day: 2, open: '08:00', close: '20:00' },
        { day: 3, open: '08:00', close: '20:00' },
        { day: 4, open: '08:00', close: '20:00' },
        { day: 5, open: '08:00', close: '20:00' },
        { day: 6, open: '08:00', close: '20:00' },
        { day: 7, open: '08:00', close: '20:00' },
      ],
      isAcceptingOrders: true,
      prepMinutes: 8,
      perOrderMinutes: 2,
      pickupNotice: '到店后报取餐码，在吧台取咖啡',
      pickupCodePrefix: 'A',
    },
    create: {
      id: STORE_ID,
      name: 'ToCoffee 示例店',
      address: '广州市天河区示例路 88 号',
      phone: '020-00000000',
      businessHours: [
        { day: 1, open: '08:00', close: '20:00' },
        { day: 2, open: '08:00', close: '20:00' },
        { day: 3, open: '08:00', close: '20:00' },
        { day: 4, open: '08:00', close: '20:00' },
        { day: 5, open: '08:00', close: '20:00' },
        { day: 6, open: '08:00', close: '20:00' },
        { day: 7, open: '08:00', close: '20:00' },
      ],
      isAcceptingOrders: true,
      prepMinutes: 8,
      perOrderMinutes: 2,
      pickupNotice: '到店后报取餐码，在吧台取咖啡',
      pickupCodePrefix: 'A',
    },
  });
}

async function seedOwner(): Promise<void> {
  const passwordHash = await hash('admin123', 10);
  await prisma.staff.upsert({
    where: { id: OWNER_ID },
    update: {
      storeId: STORE_ID,
      username: 'owner',
      passwordHash,
      name: '店主',
      role: StaffRole.OWNER,
      status: StaffStatus.ACTIVE,
    },
    create: {
      id: OWNER_ID,
      storeId: STORE_ID,
      username: 'owner',
      passwordHash,
      name: '店主',
      role: StaffRole.OWNER,
      status: StaffStatus.ACTIVE,
    },
  });
}

async function seedCategories(): Promise<void> {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {
        storeId: STORE_ID,
        name: category.name,
        sort: category.sort,
        status: CategoryStatus.ACTIVE,
      },
      create: {
        id: category.id,
        storeId: STORE_ID,
        name: category.name,
        sort: category.sort,
        status: CategoryStatus.ACTIVE,
      },
    });
  }
}

async function seedSpecGroups(): Promise<void> {
  for (const group of specGroups) {
    await prisma.specGroup.upsert({
      where: { id: group.id },
      update: {
        storeId: STORE_ID,
        name: group.name,
        required: group.required,
        multiSelect: group.multiSelect,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        sort: group.sort,
      },
      create: {
        id: group.id,
        storeId: STORE_ID,
        name: group.name,
        required: group.required,
        multiSelect: group.multiSelect,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        sort: group.sort,
      },
    });

    for (const option of group.options) {
      await prisma.specOption.upsert({
        where: { id: option.id },
        update: {
          groupId: group.id,
          name: option.name,
          priceDeltaCents: option.priceDeltaCents,
          isDefault: option.isDefault,
          isAvailable: true,
          sort: option.sort,
        },
        create: {
          id: option.id,
          groupId: group.id,
          name: option.name,
          priceDeltaCents: option.priceDeltaCents,
          isDefault: option.isDefault,
          isAvailable: true,
          sort: option.sort,
        },
      });
    }
  }
}

async function seedProducts(): Promise<void> {
  for (const [index, product] of products.entries()) {
    const category = categories[product.categoryIndex];
    const imageUrl = `${publicBaseUrl}/uploads/seed/${seedImages[index % seedImages.length]}`;

    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        storeId: STORE_ID,
        categoryId: category.id,
        name: product.name,
        description: product.description,
        imageUrl,
        basePriceCents: product.priceCents,
        tags: [...product.tags],
        status: ProductStatus.ON_SALE,
        sort: product.sort,
      },
      create: {
        id: product.id,
        storeId: STORE_ID,
        categoryId: category.id,
        name: product.name,
        description: product.description,
        imageUrl,
        basePriceCents: product.priceCents,
        tags: [...product.tags],
        status: ProductStatus.ON_SALE,
        sort: product.sort,
      },
    });

    for (const groupIndex of product.groupIndexes) {
      const group = specGroups[groupIndex];
      await prisma.productSpecGroup.upsert({
        where: {
          productId_groupId: { productId: product.id, groupId: group.id },
        },
        update: { sort: group.sort },
        create: { productId: product.id, groupId: group.id, sort: group.sort },
      });
    }
  }
}

async function main(): Promise<void> {
  await copySeedImages();
  await seedStore();
  await seedOwner();
  await seedCategories();
  await seedSpecGroups();
  await seedProducts();

  const [storeCount, staffCount, categoryCount, productCount, groupCount, optionCount] =
    await Promise.all([
      prisma.store.count(),
      prisma.staff.count(),
      prisma.category.count(),
      prisma.product.count(),
      prisma.specGroup.count(),
      prisma.specOption.count(),
    ]);

  console.log(
    `Seed complete: stores=${storeCount}, staff=${staffCount}, categories=${categoryCount}, products=${productCount}, specGroups=${groupCount}, specOptions=${optionCount}`,
  );
  console.log('Demo login: owner / admin123');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
