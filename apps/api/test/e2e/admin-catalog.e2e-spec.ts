import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/database/prisma.service.js';
import { createTestApp } from '../setup/create-test-app.js';

interface StaffLoginResponse {
  token: string;
}

interface CategoryResponse {
  id: string;
  name: string;
  status: string;
}

interface SpecGroupResponse {
  id: string;
  name: string;
  options: Array<{ id: string; name: string; isDefault: boolean }>;
}

interface ProductResponse {
  id: string;
  name: string;
  status: string;
  categoryId: string;
}

describe('admin catalog management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token = '';
  let categoryId = '';
  let productId = '';
  let groupId = '';

  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const login = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: 'owner', password: 'admin123' })
      .expect(200);

    token = (login.body as StaffLoginResponse).token;
  });

  afterAll(async () => {
    if (productId) {
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    if (categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
    if (groupId) {
      await prisma.specGroup.deleteMany({ where: { id: groupId } });
    }
    await app.close();
  });

  it('rejects admin catalog requests without a staff token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/categories')
      .expect(401);

    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('lists, creates, updates and archives a category', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.categories).toHaveLength(5);

    const created = await request(app.getHttpServer())
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `测试分类-${suffix}`, sort: 99 })
      .expect(201);

    categoryId = (created.body as CategoryResponse).id;
    expect(created.body.status).toBe('ACTIVE');

    const updated = await request(app.getHttpServer())
      .patch(`/api/admin/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `测试分类改-${suffix}`, sort: 98 })
      .expect(200);

    expect(updated.body.name).toBe(`测试分类改-${suffix}`);

    await request(app.getHttpServer())
      .delete(`/api/admin/categories/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const archived = await request(app.getHttpServer())
      .get('/api/admin/categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const target = (archived.body.categories as CategoryResponse[]).find(
      (category) => category.id === categoryId,
    );
    expect(target?.status).toBe('DISABLED');
  });

  it('creates a spec group and options, and enforces the default option', async () => {
    const group = await request(app.getHttpServer())
      .post('/api/admin/spec-groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `测试规格-${suffix}`, required: true, sort: 99 })
      .expect(201);

    groupId = (group.body as SpecGroupResponse).id;

    const first = await request(app.getHttpServer())
      .post(`/api/admin/spec-groups/${groupId}/options`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '选项A', isDefault: true, priceDeltaCents: 0 })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`/api/admin/spec-groups/${groupId}/options`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '选项B', isDefault: true, priceDeltaCents: 300 })
      .expect(201);

    const groups = await request(app.getHttpServer())
      .get('/api/admin/spec-groups')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const saved = (groups.body.groups as SpecGroupResponse[]).find(
      (item) => item.id === groupId,
    );
    expect(saved?.options).toHaveLength(2);
    expect(saved?.options.find((item) => item.id === first.body.id)?.isDefault).toBe(
      false,
    );
    expect(saved?.options.find((item) => item.id === second.body.id)?.isDefault).toBe(
      true,
    );
  });

  it('creates a product with the spec group, updates it and archives it', async () => {
    const product = await request(app.getHttpServer())
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `测试商品-${suffix}`,
        categoryId: '00000000-0000-4000-8000-000000000105',
        basePriceCents: 1888,
        tags: ['测试'],
        specGroupIds: [groupId],
      })
      .expect(201);

    productId = (product.body as ProductResponse).id;
    expect(product.body.status).toBe('ON_SALE');
    expect(product.body.specGroupIds).toContain(groupId);

    const updated = await request(app.getHttpServer())
      .patch(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ basePriceCents: 1999, status: 'SOLD_OUT' })
      .expect(200);

    expect(updated.body.basePriceCents).toBe(1999);
    expect(updated.body.status).toBe('SOLD_OUT');

    const filtered = await request(app.getHttpServer())
      .get(`/api/admin/products?keyword=${encodeURIComponent(`测试商品-${suffix}`)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(filtered.body.products).toHaveLength(1);

    await request(app.getHttpServer())
      .patch(`/api/admin/products/${productId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ON_SALE' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detail.body.status).toBe('OFF_SHELF');
  });

  it('rejects deleting a spec group still used by a product', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/admin/spec-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    expect(response.body.code).toBe('CONFLICT');
  });

  it('uploads a product image', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/admin/uploads')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('89504e470d0a1a0a', 'hex'), {
        filename: 'test.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body.url).toMatch(/\/uploads\/products\/\d{4}\/\d{2}\/.+\.png$/);
  });
});
